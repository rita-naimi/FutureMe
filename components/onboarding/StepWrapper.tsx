'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface Props {
  step: number;
  total: number;
  title: string;
  subtitle: string;
  insight?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  hideNext?: boolean;
  exitHref?: string;
  exitLabel?: string;
}

export function StepWrapper({
  step,
  total,
  title,
  subtitle,
  insight,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  hideNext = false,
  exitHref,
  exitLabel = 'Exit'
}: Props) {
  return (
    <main className="min-h-screen bg-navy-950 px-5">
      {exitHref ? (
        <Link
          href={exitHref}
          className="fixed left-5 top-6 z-50 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:text-slate-200 sm:left-8"
        >
          <X className="h-4 w-4" />
          {exitLabel}
        </Link>
      ) : null}
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        <div className="pt-8">
          <div className="h-1 rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-twin"
              animate={{ width: `${(step / total) * 100}%` }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            />
          </div>
        </div>

        <div className="flex flex-1 items-center py-10">
          <AnimatePresence mode="wait">
            <motion.section
              key={step}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -48 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
              className="w-full"
            >
              <p className="mb-4 font-mono text-sm text-twin/70">
                {step} / {total}
              </p>
              <h1 className="text-balance text-4xl font-bold leading-tight text-white">{title}</h1>
              <p className="mt-3 text-base leading-relaxed text-slate-400">{subtitle}</p>
              <div className="mt-8">{children}</div>
              {insight ? (
                <div className="mt-6 rounded-xl border border-twin/20 bg-twin/5 p-3">
                  <p className="text-sm leading-relaxed text-twin">{insight}</p>
                </div>
              ) : null}
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pb-8">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <span />
          )}
          {hideNext ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-full bg-twin px-6 py-3 text-sm font-semibold text-navy-950 transition hover:bg-twin-dark"
            >
              {nextLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
