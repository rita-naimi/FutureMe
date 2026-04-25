'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Send, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatBubble } from '@/components/twin/ChatBubble';
import { PageTransition } from '@/components/PageTransition';
import { SuggestedQuestions } from '@/components/twin/SuggestedQuestions';
import { TwinAvatar } from '@/components/twin/TwinAvatar';
import { VoiceInput } from '@/components/twin/VoiceInput';
import type { OrbState } from '@/components/AIOrb';
import type { HealthInputs } from '@/lib/fhir';
import { getRedFlags } from '@/lib/red-flags';
import { createTwinProfile } from '@/lib/profile';
import { buildSystemPrompt } from '@/lib/twin-prompt';
import { useFutureMeStore } from '@/lib/store';

export default function TwinPage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const chatHistory = useFutureMeStore((state) => state.chatHistory);
  const addMessage = useFutureMeStore((state) => state.addMessage);
  const replaceLastAssistantMessage = useFutureMeStore((state) => state.replaceLastAssistantMessage);
  const extractHabitChange = useFutureMeStore((state) => state.extractHabitChange);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(() => chatHistory.some((message) => message.role === 'user'));
  const [toast, setToast] = useState<string | null>(null);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [voiceFocusActive, setVoiceFocusActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const speechPendingRef = useRef('');
  const speechActiveRef = useRef(false);
  const speechSessionRef = useRef(0);
  const speechCompleteRef = useRef<(() => void) | null>(null);

  const activeProfile = useMemo(() => {
    if (!profile) return null;
    return createTwinProfile(simulatedInputs ?? profile.inputs, profile.fhirSource);
  }, [profile, simulatedInputs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (chatHistory.some((message) => message.role === 'user')) {
      setHasInteracted(true);
    }
  }, [chatHistory]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      speechSessionRef.current += 1;
      speechQueueRef.current = [];
      speechPendingRef.current = '';
      speechActiveRef.current = false;
      speechCompleteRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!activeProfile || chatHistory.length > 0 || bootedRef.current) return;
    bootedRef.current = true;

    addMessage({
      role: 'assistant',
      content: `I've been waiting for you. I remember being ${activeProfile.inputs.age}. I remember thinking there was plenty of time.\n\nThere was time, but not as much as I thought. Ask me anything.`
    });

    const flags = getRedFlags(activeProfile.inputs);
    if (flags.length > 0) {
      const timer = window.setTimeout(() => {
        addMessage({ role: 'assistant', content: `⚠ ${flags[0].message}` });
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeProfile, addMessage, chatHistory.length]);

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    speechQueueRef.current = [];
    speechPendingRef.current = '';
    speechActiveRef.current = false;
    speechCompleteRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  const finishSpeechIfDone = useCallback((session: number) => {
    if (session !== speechSessionRef.current || speechActiveRef.current || speechQueueRef.current.length > 0 || speechPendingRef.current.trim()) return;
    const onComplete = speechCompleteRef.current;
    speechCompleteRef.current = null;
    onComplete?.();
  }, []);

  const drainSpeechQueue = useCallback(
    (session: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (session !== speechSessionRef.current || speechActiveRef.current) return;

      const nextSegment = speechQueueRef.current.shift();
      if (!nextSegment) {
        finishSpeechIfDone(session);
        return;
      }

      const utterance = createSpeechUtterance(nextSegment);
      if (!utterance) {
        drainSpeechQueue(session);
        return;
      }

      speechActiveRef.current = true;
      utterance.onend = () => {
        speechActiveRef.current = false;
        drainSpeechQueue(session);
      };
      utterance.onerror = () => {
        speechActiveRef.current = false;
        drainSpeechQueue(session);
      };
      window.speechSynthesis.speak(utterance);
    },
    [finishSpeechIfDone]
  );

  const queueSpeech = useCallback(
    (text: string, final = false, onComplete?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onComplete?.();
        return;
      }

      if (onComplete) speechCompleteRef.current = onComplete;
      speechPendingRef.current = `${speechPendingRef.current}${text}`;
      const { segments, remaining } = extractSpeakableSegments(speechPendingRef.current, final);
      speechPendingRef.current = remaining;

      if (segments.length > 0) {
        speechQueueRef.current.push(...segments);
        setOrbState('speaking');
        setIsSpeaking(true);
        drainSpeechQueue(speechSessionRef.current);
        return;
      }

      if (final) finishSpeechIfDone(speechSessionRef.current);
    },
    [drainSpeechQueue, finishSpeechIfDone]
  );

  const sendMessage = useCallback(
    async (text: string, forceVoiceReply = false, source: 'text' | 'voice' = 'text') => {
      if (!text.trim() || !activeProfile || isStreaming) return;
      const trimmed = text.trim();
      const shouldSpeakReply = forceVoiceReply || voiceRepliesEnabled;
      if (shouldSpeakReply) stopSpeech();
      setOrbState('thinking');
      if (source === 'voice') setVoiceFocusActive(true);
      setInput('');
      setHasInteracted(true);

      const outgoing = [...useFutureMeStore.getState().chatHistory, { role: 'user' as const, content: trimmed }];
      addMessage({ role: 'user', content: trimmed, inputMode: source });
      const beforeInputs = useFutureMeStore.getState().simulatedInputs;
      extractHabitChange(trimmed);
      const afterInputs = useFutureMeStore.getState().simulatedInputs;
      const habitChange = getHabitChangeToast(beforeInputs, afterInputs);
      if (habitChange) setToast(habitChange);

      setIsStreaming(true);
      addMessage({ role: 'assistant', content: '' });
      let fullResponse = '';

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt:
              source === 'voice'
                ? `${buildSystemPrompt(activeProfile)}\n\nVoice mode: reply like spoken conversation. Use 1 to 3 short, complete sentences. Do not use bullets, headings, numbered lists, emojis, or colon-style labels. Avoid fragments.`
                : buildSystemPrompt(activeProfile),
            messages: outgoing
          })
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat endpoint returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const event of events) {
            const line = event.split('\n').find((entry) => entry.startsWith('data: '));
            if (!line) continue;
            const data = line.slice(6);
            if (data === '[DONE]') {
              buffer = '';
              break;
            }
            const parsed = JSON.parse(data) as { text: string };
            fullResponse += parsed.text;
            replaceLastAssistantMessage(fullResponse);
            if (shouldSpeakReply) {
              queueSpeech(parsed.text);
            }
          }
        }

        if (shouldSpeakReply && fullResponse.trim()) {
          queueSpeech('', true, () => {
            setIsSpeaking(false);
            setOrbState('idle');
            setVoiceFocusActive(false);
          });
        } else if (source === 'voice') {
          setOrbState('idle');
          setVoiceFocusActive(false);
        } else {
          setOrbState('idle');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const fallback = `I lost the live connection for a moment. The simulation still has your profile, but the chat stream failed: ${message}`;
        replaceLastAssistantMessage(fallback);
        if (shouldSpeakReply) {
          stopSpeech();
          queueSpeech(fallback, true, () => {
            setIsSpeaking(false);
            setOrbState('idle');
            setVoiceFocusActive(false);
          });
        } else if (source === 'voice') {
          setOrbState('error');
          window.setTimeout(() => {
            setOrbState('idle');
            setVoiceFocusActive(false);
          }, 1600);
        } else {
          setOrbState('error');
          window.setTimeout(() => setOrbState('idle'), 1600);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [activeProfile, addMessage, extractHabitChange, isStreaming, queueSpeech, replaceLastAssistantMessage, stopSpeech, voiceRepliesEnabled]
  );

  const toggleVoiceReplies = useCallback(() => {
    if (voiceRepliesEnabled) {
      stopSpeech();
      setIsSpeaking(false);
      setOrbState('idle');
      setVoiceFocusActive(false);
      setVoiceRepliesEnabled(false);
      return;
    }

    setVoiceRepliesEnabled(true);
  }, [stopSpeech, voiceRepliesEnabled]);

  if (!profile || !activeProfile) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-8">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <TwinAvatar size="lg" active />
          <h1 className="mt-7 text-3xl font-bold text-white">No twin yet</h1>
          <p className="mt-3 text-slate-400">Create your health profile before starting the conversation.</p>
          <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950">
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  const showOpeningState = !hasInteracted && chatHistory.every((message) => message.role === 'assistant') && chatHistory.length <= 2;
  const voiceButtonLifted = voiceFocusActive || orbState === 'listening' || orbState === 'thinking' || orbState === 'speaking';

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-ivory to-ivory-dark pb-24 dark:bg-navy-950 dark:bg-none">
      <PageTransition>
        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast}
              initial={{ opacity: 0, y: -12, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -10, x: '-50%' }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed left-1/2 top-4 z-[80] rounded-full bg-twin px-5 py-2.5 text-sm font-medium text-navy-950 shadow-[0_18px_50px_rgba(0,201,167,0.28)]"
            >
              {toast}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <header className="sticky top-0 z-20 border-b border-black/10 bg-ivory/88 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/92">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <TwinAvatar active={isStreaming} />
            <div>
              <p className="font-medium text-slate-950 dark:text-white">
                {activeProfile.inputs.name}, age {activeProfile.inputs.age + 10}
              </p>
              <p className="text-xs text-twin">Your future self · Online</p>
            </div>
          </div>
        </header>

        <section className="relative mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-5xl flex-1 flex-col overflow-y-auto px-5 pb-48 pt-7 sm:px-8">
          {showOpeningState ? (
            <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center select-none sm:top-32">
              <span className="font-display text-[170px] leading-none text-slate-100/80 dark:text-white/[0.03] sm:text-[220px]">∞</span>
            </div>
          ) : null}
          <div className={`relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 ${showOpeningState ? 'sm:pt-2' : ''}`}>
            <AnimatePresence initial={false}>
              {chatHistory.map((message, index) => (
                <ChatBubble
                  key={`${message.role}-${index}`}
                  role={message.role}
                  content={message.content}
                  inputMode={message.inputMode}
                  streaming={isStreaming && index === chatHistory.length - 1 && message.role === 'assistant'}
                />
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showOpeningState ? (
              <div className="relative z-10 mx-auto mt-8 w-full max-w-3xl">
                <SuggestedQuestions onSelect={sendMessage} />
              </div>
            ) : null}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </section>

        <motion.div
          initial={false}
          animate={{
            bottom: voiceButtonLifted ? '10.8rem' : '5.65rem',
            left: voiceButtonLifted ? '50%' : 'max(calc((100vw - 48rem) / 2 + 0.35rem), 0.35rem)',
            x: voiceButtonLifted ? '-50%' : '0%',
            scale: voiceButtonLifted ? 1.38 : 1
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="fixed z-50"
        >
          <VoiceInput
            disabled={isStreaming}
            visualState={orbState}
            onCancelActive={() => {
              stopSpeech();
              setIsSpeaking(false);
              setOrbState('idle');
              setVoiceFocusActive(false);
            }}
            onError={() => {
              setOrbState('error');
              window.setTimeout(() => setOrbState('idle'), 1600);
            }}
            onListeningChange={(listening) => {
              setOrbState((currentState) => (listening ? 'listening' : currentState === 'listening' ? 'idle' : currentState));
              setVoiceFocusActive((active) => (listening ? true : active));
            }}
            onSubmitTranscript={(transcript) => {
              setVoiceRepliesEnabled(true);
              void sendMessage(transcript, true, 'voice');
            }}
          />
        </motion.div>

        <footer className="fixed inset-x-0 bottom-[4.75rem] z-30 border-t border-black/10 bg-ivory/88 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/92">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <div className="h-14 w-14 flex-shrink-0" aria-hidden="true" />
            <div className="min-h-11 flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 shadow-[0_10px_36px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask your future self anything..."
                className="max-h-32 w-full resize-none bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600"
                rows={1}
              />
            </div>
            <button
              type="button"
              onClick={toggleVoiceReplies}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border transition ${
                voiceRepliesEnabled
                  ? 'border-twin/40 bg-twin/15 text-twin'
                  : 'border-black/10 bg-white/80 text-slate-500 hover:border-twin/35 hover:text-twin dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400'
              }`}
              aria-label={voiceRepliesEnabled ? 'Turn off spoken replies' : 'Turn on spoken replies'}
              title={voiceRepliesEnabled ? (isSpeaking ? 'Speaking' : 'Voice replies on') : 'Voice replies off'}
            >
              {voiceRepliesEnabled ? <Volume2 className={`h-5 w-5 ${isSpeaking ? 'animate-pulse' : ''}`} /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-twin text-navy-950 transition disabled:opacity-30"
              aria-label="Send message"
              title="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </footer>
      </PageTransition>
    </main>
  );
}

function createSpeechUtterance(text: string) {
  if (typeof window === 'undefined') return null;
  const cleanText = cleanSpeechText(text);
  if (!cleanText) return null;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = navigator.language || 'fr-FR';
  utterance.rate = 0.99;
  utterance.pitch = 1.08;
  utterance.volume = 0.98;

  const preferredVoice = chooseFemaleVoice(window.speechSynthesis.getVoices(), utterance.lang);
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  }

  return utterance;
}

function extractSpeakableSegments(value: string, final: boolean) {
  let remaining = value;
  const segments: string[] = [];

  while (remaining.trim().length > 0) {
    const punctuationEnd = findSpeakableSegmentEnd(remaining, final);

    if (punctuationEnd > 0) {
      const segment = cleanSpeechText(remaining.slice(0, punctuationEnd));
      if (segment) segments.push(segment);
      remaining = remaining.slice(punctuationEnd);
      continue;
    }

    const cleanRemaining = cleanSpeechText(remaining);
    if (!final || cleanRemaining.length === 0) break;

    if (final) {
      const segment = cleanSpeechText(remaining);
      if (segment) segments.push(segment);
      remaining = '';
    }
  }

  return { segments, remaining };
}

function findSpeakableSegmentEnd(value: string, final: boolean) {
  const regex = /[.!?…]\s+/g;
  let match: RegExpExecArray | null;
  let matchCount = 0;

  while ((match = regex.exec(value)) !== null) {
    matchCount += 1;
    const index = match.index;
    const end = index + match[0].length;
    const candidate = cleanSpeechText(value.slice(0, end));
    if (final || candidate.length >= 86 || matchCount >= 2) return end;
  }

  return -1;
}

function cleanSpeechText(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`>#~[\](){}]/g, ' ')
    .replace(/(?:\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/[⚠⚡∞•→←↑↓—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chooseFemaleVoice(voices: SpeechSynthesisVoice[], language: string) {
  const languageCode = language.slice(0, 2);
  const candidates = voices.filter((voice) => voice.lang === language || voice.lang.startsWith(languageCode));
  const femaleVoiceNames = [
    'ava',
    'allison',
    'ava premium',
    'samantha',
    'victoria',
    'karen',
    'moira',
    'tessa',
    'serena',
    'amelie',
    'amélie',
    'aurelie',
    'aurélie',
    'audrey',
    'julie',
    'hortense',
    'marie',
    'celine',
    'céline',
    'thomasina',
    'zira',
    'susan',
    'female',
    'woman',
    'girl'
  ];

  return (
    candidates.find((voice) => femaleVoiceNames.some((name) => voice.name.toLowerCase().includes(name))) ??
    voices.find((voice) => femaleVoiceNames.some((name) => voice.name.toLowerCase().includes(name))) ??
    candidates[0] ??
    voices[0]
  );
}

function getHabitChangeToast(before: HealthInputs | null, after: HealthInputs | null) {
  if (!before || !after) return null;

  if (before.sleepHours !== after.sleepHours) {
    return `⚡ Simulation updated — sleep changed to ${after.sleepHours}h`;
  }
  if (before.exerciseDaysPerWeek !== after.exerciseDaysPerWeek) {
    return `⚡ Simulation updated — exercise changed to ${after.exerciseDaysPerWeek} days/week`;
  }
  if (before.dietQuality !== after.dietQuality) {
    return `⚡ Simulation updated — diet changed to ${after.dietQuality}/5`;
  }
  if (before.stressLevel !== after.stressLevel) {
    return `⚡ Simulation updated — stress changed to ${after.stressLevel}/5`;
  }
  if (before.alcoholDrinksPerWeek !== after.alcoholDrinksPerWeek) {
    return `⚡ Simulation updated — alcohol changed to ${after.alcoholDrinksPerWeek}/week`;
  }
  if (before.smokingStatus !== after.smokingStatus) {
    return `⚡ Simulation updated — smoking changed to ${after.smokingStatus}`;
  }

  return null;
}
