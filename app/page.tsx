'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const MESSAGE = 'I know you think five hours of sleep is enough. I used to think that too.';

export default function LandingPage() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const words = useMemo(() => MESSAGE.split(' '), []);

  const fadeIn = (delay: number, y = 0) => ({
    initial: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: prefersReduced ? { duration: 0 } : { delay, duration: 0.8, ease: 'easeOut' }
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-ivory to-ivory-dark px-6 text-slate-900 dark:bg-none dark:bg-navy-950 dark:text-slate-100">
      <div className="pointer-events-none absolute left-1/2 top-[40%] z-0 hidden h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(0,201,167,0.07)_0%,transparent_70%)] dark:block" />

      <div className="absolute left-6 top-6 z-20 font-mono text-sm text-slate-400 dark:text-slate-600">
        Meror
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center">
        <div className="mt-16 flex justify-center">
          <motion.div
            className="relative flex h-24 w-24 items-center justify-center"
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={
              prefersReduced
                ? { opacity: 1 }
                : { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }
            }
            transition={prefersReduced ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,163,137,0.12)_0%,transparent_68%)] dark:bg-[radial-gradient(circle,rgba(0,201,167,0.15)_0%,transparent_68%)]" />
            <span className="relative font-display text-7xl font-bold leading-none text-twin-dark dark:text-twin">∞</span>
          </motion.div>
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center pb-10 pt-10">
          <motion.div
            className="w-full max-w-xl"
            {...fadeIn(0.6, 20)}
          >
            <div className="max-w-[31rem] rounded-2xl rounded-tl-sm border border-black/10 bg-white px-5 py-4 text-slate-900 shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-[rgba(12,22,40,0.9)] dark:text-slate-100 dark:shadow-none">
              <motion.p
                className="font-sans text-lg italic leading-relaxed"
                variants={{
                  visible: {
                    transition: {
                      delayChildren: prefersReduced ? 0 : 0.8,
                      staggerChildren: prefersReduced ? 0 : 0.07
                    }
                  }
                }}
                initial="hidden"
                animate="visible"
              >
                {words.map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-[0.28em] inline-block"
                    variants={{
                      hidden: prefersReduced ? { opacity: 1 } : { opacity: 0, y: 5 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.25 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.p>
            </div>

            <motion.p
              className="mt-3 text-right font-mono text-sm text-slate-500 dark:text-slate-600"
              {...fadeIn(2.5)}
            >
              — You, age 44
            </motion.p>

            <motion.p
              className="mt-3 text-right font-sans text-sm text-slate-400 dark:text-slate-600"
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReduced ? { duration: 0 } : { delay: 3.2, duration: 0.6 }}
            >
              Then I got the diagnosis.
            </motion.p>
          </motion.div>

          <motion.div
            className="mt-12 flex w-full flex-col items-center"
            {...fadeIn(3.8, 20)}
          >
            <h1 className="max-w-4xl text-center font-display text-5xl font-bold leading-tight text-slate-900 md:text-7xl dark:text-slate-100">
              Meet the person your habits are building.
            </h1>
            <p className="mb-10 mt-4 text-center font-sans text-base text-slate-500 md:text-lg dark:text-slate-600">
              Two minutes. Ten questions. No sugarcoating.
            </p>

            <motion.div
              className="flex flex-col items-center justify-center gap-3 sm:flex-row"
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReduced ? { duration: 0 } : { delay: 4.3, duration: 0.6 }}
            >
              <motion.button
                type="button"
                onClick={() => router.push('/onboarding')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-twin-dark px-8 py-4 font-sans text-base font-semibold text-white transition-colors hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
                whileHover={prefersReduced ? undefined : { scale: 1.03 }}
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              >
                Begin your awakening →
              </motion.button>
              <motion.button
                type="button"
                onClick={() => router.push('/login')}
                className="rounded-full border border-black/15 px-6 py-4 font-sans text-base font-medium text-slate-500 transition-colors hover:border-black/30 hover:text-slate-800 dark:border-white/20 dark:text-slate-400 dark:hover:border-white/40 dark:hover:text-white"
                whileHover={prefersReduced ? undefined : { scale: 1.03 }}
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
              >
                Log in
              </motion.button>
            </motion.div>

            <motion.p
              className="mt-8 font-sans text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-[#1E3A5F]"
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReduced ? { duration: 0 } : { delay: 4.8, duration: 0.6 }}
            >
              Your future self has been waiting.
            </motion.p>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
