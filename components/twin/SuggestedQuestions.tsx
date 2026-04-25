'use client';

import { Clock, Heart, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const SUGGESTED_QUESTIONS = [
  { icon: Heart, question: "What's my biggest health risk right now?" },
  { icon: TrendingUp, question: 'What one change would help the most?' },
  { icon: Clock, question: 'Will I live past 80 at this rate?' },
  { icon: Zap, question: 'What happens if I keep living exactly like this?' }
];

export function SuggestedQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {SUGGESTED_QUESTIONS.map(({ icon: Icon, question }) => (
        <motion.button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-black/10 bg-white/56 px-3.5 py-2 text-left text-xs font-medium text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:border-twin-dark/25 hover:bg-white/82 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-500 dark:shadow-none dark:hover:border-twin/25 dark:hover:bg-white/[0.055] dark:hover:text-slate-300"
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-twin-dark/65 transition group-hover:text-twin-dark dark:text-twin/60 dark:group-hover:text-twin" />
          <span className="truncate">{question}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
