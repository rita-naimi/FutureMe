'use client';

import { motion } from 'framer-motion';
import { Infinity as InfinityIcon } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-28 w-28'
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-11 w-11'
};

export function TwinAvatar({ size = 'md', active = false }: Props) {
  return (
    <motion.div
      className={`relative flex ${sizes[size]} flex-shrink-0 items-center justify-center rounded-full border border-twin/40 bg-twin/12 shadow-glow`}
      animate={active ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <InfinityIcon className={`${iconSizes[size]} text-twin`} />
      {active ? <span className="absolute inset-0 rounded-full border border-twin/30" /> : null}
    </motion.div>
  );
}
