'use client';

import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { motion } from 'framer-motion';

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
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isListening, setIsListening] = useState(false);

  const toggleListening = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      onTranscript(event.results[0][0].transcript);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-slate-400 transition hover:border-twin/35 hover:text-twin"
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      title={isListening ? 'Listening' : 'Voice input'}
    >
      {isListening ? (
        <motion.span animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
          <MicOff className="h-5 w-5 text-red-300" />
        </motion.span>
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </button>
  );
}
