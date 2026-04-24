'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Send } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ChatBubble } from '@/components/twin/ChatBubble';
import { DemoQueryLoader } from '@/components/DemoSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { SuggestedQuestions } from '@/components/twin/SuggestedQuestions';
import { TwinAvatar } from '@/components/twin/TwinAvatar';
import { VoiceInput } from '@/components/twin/VoiceInput';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);

  const activeProfile = useMemo(() => {
    if (!profile) return null;
    return createTwinProfile(simulatedInputs ?? profile.inputs, profile.fhirSource);
  }, [profile, simulatedInputs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

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
        addMessage({ role: 'assistant', content: flags[0].message });
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeProfile, addMessage, chatHistory.length]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !activeProfile || isStreaming) return;
      const trimmed = text.trim();
      setInput('');

      const outgoing = [...useFutureMeStore.getState().chatHistory, { role: 'user' as const, content: trimmed }];
      addMessage({ role: 'user', content: trimmed });
      extractHabitChange(trimmed);

      setIsStreaming(true);
      addMessage({ role: 'assistant', content: '' });
      let fullResponse = '';

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: buildSystemPrompt(activeProfile),
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
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        replaceLastAssistantMessage(
          `I lost the live connection for a moment. The simulation still has your profile, but the chat stream failed: ${message}`
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [activeProfile, addMessage, extractHabitChange, isStreaming, replaceLastAssistantMessage]
  );

  if (!profile || !activeProfile) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-8">
        <Suspense fallback={null}>
          <DemoQueryLoader />
        </Suspense>
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <TwinAvatar size="lg" active />
          <h1 className="mt-7 text-3xl font-bold text-white">No twin yet</h1>
          <p className="mt-3 text-slate-400">Create a health profile or load a Synthea persona before starting the conversation.</p>
          <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950">
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-navy-950 pb-24">
      <Suspense fallback={null}>
        <DemoQueryLoader />
      </Suspense>
      <PageTransition>
        <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-950/92 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <TwinAvatar active={isStreaming} />
            <div>
              <p className="font-medium text-white">
                {activeProfile.inputs.name}, age {activeProfile.inputs.age + 10}
              </p>
              <p className="text-xs text-twin">Your future self · Online</p>
            </div>
          </div>
        </header>

        <section className="mx-auto flex min-h-[calc(100vh-15rem)] w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          <AnimatePresence initial={false}>
            {chatHistory.map((message, index) => (
              <ChatBubble
                key={`${message.role}-${index}`}
                role={message.role}
                content={message.content}
                streaming={isStreaming && index === chatHistory.length - 1 && message.role === 'assistant'}
              />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </section>

        {chatHistory.length <= 2 ? <SuggestedQuestions onSelect={sendMessage} /> : null}

        <footer className="fixed inset-x-0 bottom-[4.75rem] z-30 border-t border-white/10 bg-navy-950/92 p-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <VoiceInput onTranscript={setInput} />
            <div className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
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
                className="max-h-32 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                rows={1}
              />
            </div>
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
