'use client';

import { motion } from 'framer-motion';
import { TwinAvatar } from './TwinAvatar';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export function ChatBubble({ role, content, streaming = false }: Props) {
  const fromUser = role === 'user';
  const warning = !fromUser && content.startsWith('⚠ ');
  const visibleContent = warning ? content.slice(2) : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: warning ? 22 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: warning ? 0.42 : 0.24, ease: 'easeOut' }}
      className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}
    >
      {!fromUser ? <TwinAvatar size="sm" active={streaming} /> : null}
      <div
        className={`mx-2 max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          fromUser
            ? 'rounded-br-md bg-twin font-medium text-navy-950'
            : warning
              ? 'rounded-bl-md border border-amber-300/20 bg-amber-400/10 text-slate-200'
              : 'rounded-bl-md border border-white/10 bg-navy-900 text-slate-200'
        }`}
      >
        {warning ? <span className="mr-2 font-semibold text-amber-300">⚠</span> : null}
        {visibleContent}
        {streaming ? <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse bg-twin" /> : null}
      </div>
    </motion.div>
  );
}
