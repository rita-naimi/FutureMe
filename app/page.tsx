'use client';

import { motion } from 'framer-motion';
import { ArrowRight, HeartPulse, LineChart, LogIn, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TwinAvatar } from '@/components/twin/TwinAvatar';

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-950 px-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-twin/50 to-transparent" />
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 py-16 lg:grid-cols-[1fr_0.86fr]">
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mb-10"
          >
            <TwinAvatar size="lg" active />
          </motion.div>

          <motion.h1
            className="text-balance text-5xl font-bold leading-[0.95] text-white sm:text-7xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.75, ease: 'easeOut' }}
          >
            Meet your <span className="text-twin">future self.</span>
          </motion.h1>
          <motion.p
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400 sm:text-xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.65, ease: 'easeOut' }}
          >
            A two-minute questionnaire becomes a ten-year health projection, a digital twin, and a conversation with the person your habits are building.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65, ease: 'easeOut' }}
          >
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-twin px-6 py-3 font-semibold text-navy-950 transition hover:bg-twin-dark"
            >
              Begin your awakening
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 font-semibold text-slate-200 transition hover:border-twin/40 hover:text-twin"
            >
              <LogIn className="h-4 w-4" />
              Log in
            </button>
          </motion.div>

          <motion.p
            className="mt-6 text-sm text-slate-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            HL7 FHIR R4 profile · LOINC observations · Personalized risk projection
          </motion.p>
        </section>

        <motion.section
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.8, ease: 'easeOut' }}
          className="relative z-10"
          aria-label="FutureMe preview"
        >
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/30">
            <div className="rounded-[1.4rem] border border-white/10 bg-navy-900 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Your profile</p>
                  <p className="mt-1 text-lg font-semibold text-white">Digital twin ready</p>
                </div>
                <TwinAvatar />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Bio age', value: 'calc', icon: HeartPulse, color: 'text-red-300' },
                  { label: 'Risk map', value: 'live', icon: LineChart, color: 'text-amber-300' },
                  { label: 'Twin chat', value: 'ready', icon: MessageCircle, color: 'text-twin' }
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-navy-950 p-4">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <p className="mt-4 text-3xl font-bold text-white">{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-twin/20 bg-twin/5 p-4">
                <p className="text-sm leading-relaxed text-slate-200">
                  Your projection updates as your real habits change.
                </p>
              </div>
              <div className="mt-5 h-28 rounded-2xl border border-white/10 bg-navy-950 p-4">
                <div className="flex h-full items-end gap-2">
                  {[78, 68, 55, 43, 35, 28, 22].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-slate-700"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                  {[45, 52, 58, 64, 68, 72, 76].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-twin"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
