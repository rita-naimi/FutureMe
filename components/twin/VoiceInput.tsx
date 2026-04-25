'use client';

import { useRef, useState } from 'react';
import { AIOrb } from '@/components/AIOrb';
import type { OrbState } from '@/components/AIOrb';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onerror: (() => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
}

interface VoiceInputProps {
  disabled?: boolean;
  onCancelActive?: () => void;
  onError?: () => void;
  onListeningChange?: (isListening: boolean) => void;
  onSubmitTranscript?: (text: string) => void;
  onTranscript?: (text: string) => void;
  visualState?: OrbState;
}

export function VoiceInput({
  disabled = false,
  onCancelActive,
  onError,
  onListeningChange,
  onSubmitTranscript,
  onTranscript,
  visualState = 'idle'
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const latestTranscriptRef = useRef('');
  const isStopState = isListening || visualState === 'speaking';
  const isDisabled = disabled && !isStopState;

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    if (visualState === 'speaking') {
      onCancelActive?.();
      return;
    }

    if (isDisabled) return;

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      onError?.();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    finalTranscriptRef.current = '';
    latestTranscriptRef.current = '';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      onListeningChange?.(true);
    };
    recognition.onerror = () => {
      setIsListening(false);
      onListeningChange?.(false);
      onError?.();
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onListeningChange?.(false);
      const transcript = (finalTranscriptRef.current || latestTranscriptRef.current).trim();
      if (transcript) onSubmitTranscript?.(transcript);
    };
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const transcript = `${finalTranscript || finalTranscriptRef.current} ${interimTranscript}`.trim();
      if (transcript) {
        latestTranscriptRef.current = transcript;
        onTranscript?.(transcript);
      }
      if (finalTranscript.trim()) finalTranscriptRef.current = finalTranscript.trim();
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={isDisabled}
      className="flex h-14 w-14 flex-shrink-0 items-center justify-center self-center rounded-full transition hover:scale-[1.03] disabled:opacity-40"
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      title={isListening ? 'Stop listening' : visualState === 'speaking' ? 'Stop voice reply' : 'Speak to your twin'}
    >
      <AIOrb state={isListening ? 'listening' : visualState} size="sm" />
    </button>
  );
}
