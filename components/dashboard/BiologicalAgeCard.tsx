'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowDown, ArrowUp, Dna } from 'lucide-react';

interface Props {
  realAge: number;
  biologicalAge: number;
  source?: string;
}

export function BiologicalAgeCard({ realAge, biologicalAge, source = 'FHIR R4 profile' }: Props) {
  const count = useMotionValue(realAge);
  const rounded = useTransform(count, Math.round);
  const delta = biologicalAge - realAge;
  const isOlder = delta > 0;

  useEffect(() => {
    const controls = animate(count, biologicalAge, {
      duration: 1.6,
      delay: 0.15,
      ease: 'easeOut'
    });
    return controls.stop;
  }, [biologicalAge, count]);

  return (
    <section className="glass-panel rounded-2xl p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-twin/30 bg-twin/10">
        <Dna className="h-5 w-5 text-twin" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Biological age</p>
      <motion.span className="mt-2 block text-7xl font-bold tabular-nums text-white sm:text-8xl">
        {rounded}
      </motion.span>
      <div
        className={`mt-4 inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
          isOlder
            ? 'border-red-500/25 bg-red-500/10 text-red-300'
            : 'border-twin/25 bg-twin/10 text-twin'
        }`}
      >
        {isOlder ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        {isOlder
          ? `${delta} ${delta === 1 ? 'year' : 'years'} older than real age`
          : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'year' : 'years'} younger than real age`}
      </div>
      <p className="mt-4 text-xs text-slate-600">
        Based on {source} · {new Date().toLocaleDateString()}
      </p>
    </section>
  );
}
