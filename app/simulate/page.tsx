'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, Infinity as InfinityIcon, Mail, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageTransition } from '@/components/PageTransition';
import TimeCapsule from '@/components/TimeCapsule';
import type { HealthInputs, RiskScores } from '@/lib/fhir';
import { computeBiologicalAge, computeRisks } from '@/lib/risks';
import { createTwinProfile } from '@/lib/profile';
import { buildSimulationPrompt, buildSystemPrompt } from '@/lib/twin-prompt';
import { useFutureMeStore } from '@/lib/store';

const TwinAvatarViewer = dynamic(() => import('@/components/twin/TwinAvatarViewer'), { ssr: false });

const SLIDERS: {
  key: keyof Pick<
    HealthInputs,
    'sleepHours' | 'exerciseDaysPerWeek' | 'dietQuality' | 'stressLevel' | 'alcoholDrinksPerWeek' | 'weightKg'
  >;
  label: string;
  min: number;
  max: number;
  unit: string;
  step: number;
}[] = [
  { key: 'sleepHours', label: 'Sleep', min: 4, max: 10, unit: 'h/night', step: 0.5 },
  { key: 'exerciseDaysPerWeek', label: 'Exercise', min: 0, max: 7, unit: 'days/week', step: 1 },
  { key: 'dietQuality', label: 'Diet quality', min: 1, max: 5, unit: '/5', step: 1 },
  { key: 'stressLevel', label: 'Stress', min: 1, max: 5, unit: '/5', step: 1 },
  { key: 'alcoholDrinksPerWeek', label: 'Alcohol', min: 0, max: 21, unit: 'drinks/week', step: 1 },
  { key: 'weightKg', label: 'Weight', min: 45, max: 140, unit: 'kg', step: 1 }
];

const RISK_ROWS = [
  ['Cardiovascular', 'cardiovascular'] as const,
  ['Metabolic', 'metabolic'] as const,
  ['Stress load', 'mentalResilience'] as const,
  ['Longevity drag', 'longevityDrag'] as const
];

const HORIZONS = [10, 20, 30, 40] as const;

export default function SimulatePage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const setSimulatedInputs = useFutureMeStore((state) => state.setSimulatedInputs);
  const currentUserEmail = useFutureMeStore((state) => state.currentUserEmail);
  const [reaction, setReaction] = useState('Adjust a habit and I will tell you what changed from my side of time.');
  const [reactionLoading, setReactionLoading] = useState(false);
  const [timeCapsuleOpen, setTimeCapsuleOpen] = useState(false);
  const [projectionYears, setProjectionYears] = useState<(typeof HORIZONS)[number]>(20);

  const currentRisks = useMemo(() => (profile ? computeRisks(profile.inputs) : null), [profile]);
  const simulatedRisks = useMemo(() => (simulatedInputs ? computeRisks(simulatedInputs) : null), [simulatedInputs]);
  const currentBioAge = useMemo(() => (profile && currentRisks ? computeBiologicalAge(profile.inputs, currentRisks) : null), [currentRisks, profile]);
  const simulatedBioAge = useMemo(
    () => (simulatedInputs && simulatedRisks ? computeBiologicalAge(simulatedInputs, simulatedRisks) : null),
    [simulatedInputs, simulatedRisks]
  );

  const hasChanges = useMemo(
    () => Boolean(profile && simulatedInputs && !sameInputs(profile.inputs, simulatedInputs)),
    [profile, simulatedInputs]
  );

  const changedSummary = useMemo(() => {
    if (!profile || !simulatedInputs) return 'baseline';
    return summarizeChanges(profile.inputs, simulatedInputs);
  }, [profile, simulatedInputs]);

  const handleChange = useCallback(
    (key: keyof HealthInputs, value: number | HealthInputs['smokingStatus']) => {
      if (!simulatedInputs) return;
      setSimulatedInputs({ ...simulatedInputs, [key]: value });
    },
    [setSimulatedInputs, simulatedInputs]
  );

  useEffect(() => {
    if (!profile || !simulatedInputs || !simulatedRisks || !hasChanges) {
      setReaction('Adjust a habit and I will tell you what changed from my side of time.');
      setReactionLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchTwinReaction({
        profileInputs: profile.inputs,
        simulatedInputs,
        changedSummary,
        signal: controller.signal,
        onStart: () => setReactionLoading(true),
        onComplete: (message) => {
          setReaction(message || buildLocalReaction(profile.inputs, simulatedInputs));
          setReactionLoading(false);
        },
        onError: () => {
          setReaction(buildLocalReaction(profile.inputs, simulatedInputs));
          setReactionLoading(false);
        }
      });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [changedSummary, hasChanges, profile, simulatedInputs, simulatedRisks]);

  if (!profile || !simulatedInputs || !currentRisks || !simulatedRisks || currentBioAge === null || simulatedBioAge === null) {
    return (
      <main className="min-h-screen bg-ivory px-5 pb-28 pt-8 dark:bg-navy-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <SlidersHorizontal className="mb-5 h-10 w-10 text-twin-dark dark:text-twin" />
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">No simulation yet</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">Create your profile before changing future habits.</p>
          <Link
            href="/onboarding"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-twin-dark px-5 py-3 font-semibold text-white dark:bg-twin dark:text-navy-950"
          >
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  const currentHealthScore = 100 - currentRisks.overall;
  const currentFuture = projectFuture(profile.inputs.age, currentBioAge, currentRisks, projectionYears);
  const simulatedFuture = projectFuture(profile.inputs.age, simulatedBioAge, simulatedRisks, projectionYears);
  const futureBioAgeDelta = simulatedFuture.biologicalAge - currentFuture.biologicalAge;
  const biomarkerCards = buildSimulationBiomarkerCards(profile.inputs, simulatedInputs);

  return (
    <main className="min-h-screen bg-gradient-to-b from-ivory to-ivory-dark px-5 pb-32 pt-8 dark:bg-navy-950 dark:bg-none sm:px-8 lg:px-10">
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid min-h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[minmax(23rem,0.45fr)_minmax(0,0.55fr)]">
            <section className="rounded-[1.7rem] border border-black/10 bg-white/80 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20 sm:p-7">
              <div className="mb-7">
                <p className="text-sm font-medium text-twin-dark dark:text-twin">Simulation lab</p>
                <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-slate-950 dark:text-white">Change your habits</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">Drag to rewrite your future.</p>
              </div>

              <div className="space-y-4">
                {SLIDERS.map(({ key, label, min, max, unit, step }) => {
                  const value = Number(simulatedInputs[key]);
                  const original = Number(profile.inputs[key]);
                  return (
                    <SliderRow
                      key={key}
                      label={label}
                      value={value}
                      original={original}
                      min={min}
                      max={max}
                      step={step}
                      unit={unit}
                      onChange={(nextValue) => handleChange(key, nextValue)}
                    />
                  );
                })}

                <SmokingToggle
                  value={simulatedInputs.smokingStatus}
                  original={profile.inputs.smokingStatus}
                  onChange={(nextValue) => handleChange('smokingStatus', nextValue)}
                />
              </div>

              <button
                type="button"
                onClick={() => setSimulatedInputs(profile.inputs)}
                className="mt-7 text-sm font-medium text-slate-500 transition hover:text-twin-dark dark:text-slate-500 dark:hover:text-twin"
              >
                ↺ Reset all to baseline
              </button>
            </section>

            <section className="relative overflow-hidden rounded-[1.7rem] border border-black/10 bg-white/70 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-twin-dark/8 dark:bg-twin/[0.06]" />
              <div className="relative">
                <div className="mb-7">
                  <p className="text-sm font-medium text-twin-dark dark:text-twin">Your updated future</p>
                  <h2 className="mt-2 font-display text-4xl font-bold leading-tight text-slate-950 dark:text-white">The payoff, live.</h2>
                </div>

                <HorizonControl value={projectionYears} onChange={setProjectionYears} />

                <div className="grid items-stretch gap-5 xl:grid-cols-[0.88fr_1fr]">
                  <TwinAvatarViewer
                    inputs={simulatedInputs}
                    biologicalAge={simulatedFuture.biologicalAge}
                    healthScore={simulatedFuture.healthScore}
                    projectionYears={projectionYears}
                    chronologicalAge={simulatedFuture.chronologicalAge}
                  />
                  <div className="grid gap-4 xl:grid-rows-[1fr_auto]">
                    <BiologicalImpactCard
                      hasChanges={hasChanges}
                      bioAgeDelta={futureBioAgeDelta}
                      currentBioAge={currentFuture.biologicalAge}
                      simulatedBioAge={simulatedFuture.biologicalAge}
                      projectionYears={projectionYears}
                    />
                    <FutureMessageLauncher onOpen={() => setTimeCapsuleOpen(true)} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {RISK_ROWS.map(([label, key]) => {
                    const current = key === 'longevityDrag' ? 100 - currentRisks.longevity : currentRisks[key as keyof RiskScores];
                    const simulated = key === 'longevityDrag' ? 100 - simulatedRisks.longevity : simulatedRisks[key as keyof RiskScores];
                    return <RiskDeltaCard key={label} label={label} current={current} simulated={simulated} />;
                  })}
                </div>

                <TwinReactionCard loading={reactionLoading} reaction={reaction} />
              </div>
            </section>
          </div>

          <BiomarkerTrendSection cards={biomarkerCards} />
        </div>

        <AnimatePresence>
          {timeCapsuleOpen ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTimeCapsuleOpen(false)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Send a message to your future self"
                className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] outline-none"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={(event) => event.stopPropagation()}
              >
                <TimeCapsule
                  healthScore={currentHealthScore}
                  biologicalAge={currentBioAge}
                  realAge={profile.inputs.age}
                  name={profile.inputs.name}
                  userEmail={currentUserEmail ?? ''}
                  onClose={() => setTimeCapsuleOpen(false)}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </PageTransition>
    </main>
  );
}

function HorizonControl({
  value,
  onChange
}: {
  value: (typeof HORIZONS)[number];
  onChange: (value: (typeof HORIZONS)[number]) => void;
}) {
  const fill = ((value - 10) / 30) * 100;

  return (
    <section className="mb-5 rounded-[1.25rem] border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.06]">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Time horizon</p>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            Avatar shows accumulated impact, not an instant change.
          </p>
        </div>
        <p className="font-display text-3xl font-bold text-slate-950 dark:text-white">+{value}y</p>
      </div>
      <input
        type="range"
        min={10}
        max={40}
        step={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as (typeof HORIZONS)[number])}
        className="lab-slider w-full"
        style={{ ['--slider-fill' as string]: `${fill}%` }}
      />
      <div className="mt-2 grid grid-cols-4 text-center font-mono text-[11px] text-slate-400 dark:text-slate-600">
        {HORIZONS.map((year) => (
          <span key={year}>{year}y</span>
        ))}
      </div>
    </section>
  );
}

function FutureMessageLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-[1.5rem] border border-black/10 bg-white/85 p-5 text-left shadow-[0_18px_70px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-twin-dark/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.07] dark:shadow-none dark:hover:border-twin/35 dark:hover:bg-white/[0.10]"
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-twin-dark/20 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
        <Mail className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950 dark:text-white">Message your future self</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-500">
          Send now or schedule a real email with today&apos;s health snapshot.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-twin-dark dark:group-hover:text-twin" />
    </button>
  );
}

function SliderRow({
  label,
  value,
  original,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  value: number;
  original: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const changed = value !== original;
  const fill = ((value - min) / (max - min)) * 100;

  return (
    <div
      className={`rounded-2xl border bg-white/55 p-4 transition dark:bg-white/[0.07] ${
        changed
          ? 'border-twin-dark/25 border-l-4 border-l-twin-dark dark:border-twin/25 dark:border-l-twin'
          : 'border-black/10 dark:border-white/10'
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className={`font-mono text-sm ${changed ? 'text-twin-dark dark:text-twin' : 'text-slate-500 dark:text-slate-500'}`}>
          {value}
          <span className="ml-1 text-xs text-slate-400 dark:text-slate-600">{unit}</span>
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="lab-slider w-full"
        style={{ ['--slider-fill' as string]: `${fill}%` }}
      />
      <div className="mt-2 min-h-4 text-right text-xs text-slate-400 dark:text-slate-600">
        {changed ? `was ${original}` : null}
      </div>
    </div>
  );
}

function SmokingToggle({
  value,
  original,
  onChange
}: {
  value: HealthInputs['smokingStatus'];
  original: HealthInputs['smokingStatus'];
  onChange: (value: HealthInputs['smokingStatus']) => void;
}) {
  const changed = value !== original;
  return (
    <div
      className={`rounded-2xl border bg-white/55 p-4 transition dark:bg-white/[0.07] ${
        changed
          ? 'border-twin-dark/25 border-l-4 border-l-twin-dark dark:border-twin/25 dark:border-l-twin'
          : 'border-black/10 dark:border-white/10'
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Smoking</p>
        <p className={`font-mono text-sm capitalize ${changed ? 'text-twin-dark dark:text-twin' : 'text-slate-500 dark:text-slate-500'}`}>
          {value}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['never', 'former', 'current'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold capitalize transition ${
              value === status
                ? 'border-twin-dark bg-twin-dark text-white dark:border-twin dark:bg-twin dark:text-navy-950'
                : 'border-black/10 text-slate-500 hover:border-twin-dark/30 hover:text-slate-900 dark:border-white/10 dark:text-slate-500 dark:hover:border-twin/30 dark:hover:text-slate-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-4 text-right text-xs text-slate-400 dark:text-slate-600">
        {changed ? `was ${original}` : null}
      </div>
    </div>
  );
}

function BiologicalImpactCard({
  hasChanges,
  bioAgeDelta,
  currentBioAge,
  simulatedBioAge,
  projectionYears
}: {
  hasChanges: boolean;
  bioAgeDelta: number;
  currentBioAge: number;
  simulatedBioAge: number;
  projectionYears: number;
}) {
  const [animatedDelta, setAnimatedDelta] = useState(0);
  const better = bioAgeDelta < 0;
  const worse = bioAgeDelta > 0;

  useEffect(() => {
    const controls = animate(0, bioAgeDelta, {
      duration: 0.65,
      ease: 'easeOut',
      onUpdate: (latest) => setAnimatedDelta(Math.round(latest))
    });
    return controls.stop;
  }, [bioAgeDelta]);

  return (
    <article className="flex min-h-[16rem] flex-col justify-center rounded-[1.5rem] border border-black/10 bg-white/85 p-7 text-center shadow-[0_18px_70px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.07] dark:shadow-none">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
        {projectionYears}-year biological impact
      </p>
      {hasChanges ? (
        <>
          <motion.p
            className={`mt-4 font-display text-7xl font-bold leading-none tabular-nums sm:text-8xl ${
              better ? 'text-twin-dark dark:text-twin' : worse ? 'text-red-500 dark:text-red-300' : 'text-slate-950 dark:text-white'
            }`}
          >
            {bioAgeDelta <= 0 ? '−' : '+'}
            {Math.abs(animatedDelta)}
          </motion.p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
            Projected biological age {simulatedBioAge} instead of {currentBioAge}
          </p>
        </>
      ) : (
        <p className="mx-auto mt-8 max-w-sm text-lg text-slate-400 dark:text-slate-500">Adjust a habit to see your impact.</p>
      )}
    </article>
  );
}

function RiskDeltaCard({ label, current, simulated }: { label: string; current: number; simulated: number }) {
  const delta = current - simulated;
  const changed = delta !== 0;
  const better = delta > 0;

  return (
    <article className="rounded-2xl border border-black/10 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        {changed ? (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${better ? 'text-twin-dark dark:text-twin' : 'text-amber-600 dark:text-amber-300'}`}>
            {better ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            {Math.abs(delta)} pts {better ? 'better' : 'worse'}
          </span>
        ) : null}
      </div>

      <RiskBar value={current} valueTone="text-slate-500 dark:text-slate-500" barTone="bg-slate-400 dark:bg-slate-600" />
      <div className="mt-2">
        <RiskBar value={simulated} valueTone="text-twin-dark dark:text-twin" barTone="bg-twin-dark dark:bg-twin" />
      </div>
    </article>
  );
}

function RiskBar({ value, valueTone, barTone }: { value: number; valueTone: string; barTone: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`w-8 text-right font-mono text-xs ${valueTone}`}>{value}</span>
    </div>
  );
}

type BiomarkerTrendPoint = {
  age: number;
  current: number;
  simulated: number;
};

type BiomarkerTrendCard = {
  label: string;
  description: string;
  unit: string;
  data: BiomarkerTrendPoint[];
  betterWhenLower: boolean;
};

function BiomarkerTrendSection({ cards }: { cards: BiomarkerTrendCard[] }) {
  return (
    <details className="group rounded-[1.7rem] border border-black/10 bg-white/75 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20">
      <summary className="flex cursor-pointer list-none flex-col justify-between gap-4 p-5 marker:hidden sm:flex-row sm:items-center sm:p-7 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-medium text-twin-dark dark:text-twin">Biomarker curves</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">5 bottom trajectories</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">BP trajectory, systolic BP, BMI, total cholesterol, and HDL cholesterol.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            Click to open
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-twin-dark/20 bg-twin-dark/10 text-twin-dark transition group-open:rotate-180 dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
            <ChevronDown className="h-5 w-5" />
          </span>
        </div>
      </summary>

      <div className="border-t border-black/10 px-5 pb-5 pt-5 dark:border-white/10 sm:px-7 sm:pb-7">
        <div className="mb-5 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-slate-400 dark:bg-slate-600" /> Baseline
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-twin-dark dark:bg-twin" /> Simulated
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card, index) => (
            <BiomarkerTrendCard key={card.label} card={card} index={index} />
          ))}
        </div>
      </div>
    </details>
  );
}

function BiomarkerTrendCard({ card, index }: { card: BiomarkerTrendCard; index: number }) {
  const first = card.data[0];
  const last = card.data[card.data.length - 1];
  const delta = last ? last.simulated - last.current : 0;
  const improved = card.betterWhenLower ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.05;
  const domain = getBiomarkerTrendDomain(card.data);

  return (
    <article className="flex min-h-[15rem] flex-col rounded-[1.35rem] border border-black/10 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="flex min-h-[4.8rem] items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-slate-950 dark:text-white">{card.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-500">{card.description}</p>
        </div>
        <div
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            neutral
              ? 'border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400'
              : improved
                ? 'border-twin-dark/25 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin'
                : 'border-amber-300/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/25 dark:text-amber-300'
          }`}
        >
          {neutral ? '0' : `${delta > 0 ? '+' : ''}${formatBiomarkerValue(delta)}`}
        </div>
      </div>

      <div className="mt-3 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
            <XAxis dataKey="age" hide />
            <YAxis hide domain={domain} />
            <Tooltip content={<BiomarkerTrendTooltip unit={card.unit} />} />
            <Line
              type="monotone"
              dataKey="current"
              stroke="#94A3B8"
              strokeWidth={2.4}
              dot={false}
              name="Baseline"
              animationBegin={index * 90}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="simulated"
              stroke="#00A389"
              strokeWidth={2.8}
              dot={false}
              name="Simulated"
              animationBegin={index * 90 + 120}
              animationDuration={850}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3 text-xs">
        <div>
          <p className="font-medium text-slate-400 dark:text-slate-500">Age {first?.age} start</p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {formatBiomarkerValue(first?.current ?? 0)}
            <span className="ml-1 text-slate-400">{card.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-400 dark:text-slate-500">Age {last?.age} projected</p>
          <p className="font-mono text-twin-dark dark:text-twin">
            {formatBiomarkerValue(last?.simulated ?? 0)}
            <span className="ml-1 text-slate-400">{card.unit}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function BiomarkerTrendTooltip({
  active,
  payload,
  label,
  unit
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string }>;
  label?: number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm shadow-xl dark:border-white/10 dark:bg-navy-900">
      <p className="mb-1 font-medium text-slate-950 dark:text-white">Age {label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatBiomarkerValue(item.value)} {unit}
        </p>
      ))}
    </div>
  );
}

function buildSimulationBiomarkerCards(currentInputs: HealthInputs, simulatedInputs: HealthInputs): BiomarkerTrendCard[] {
  const current = estimateSimulationBiomarkers(currentInputs);
  const simulated = estimateSimulationBiomarkers(simulatedInputs);

  return [
    buildEstimatedBiomarkerCard({
      label: 'BP trajectory',
      description: 'Long-term pressure path',
      unit: 'mmHg',
      startAge: currentInputs.age,
      currentStart: current.systolicBloodPressure,
      simulatedStart: simulated.systolicBloodPressure,
      currentDrift: 11,
      simulatedDrift: simulatedInputs.stressLevel < currentInputs.stressLevel || simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek ? 4 : 7,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'Systolic BP',
      description: 'Baseline vs simulated habits',
      unit: 'mmHg',
      startAge: currentInputs.age,
      currentStart: current.systolicBloodPressure,
      simulatedStart: simulated.systolicBloodPressure,
      currentDrift: 8,
      simulatedDrift: simulatedInputs.stressLevel < currentInputs.stressLevel || simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek ? 3 : 6,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'BMI',
      description: 'Baseline vs simulated weight',
      unit: 'BMI',
      startAge: currentInputs.age,
      currentStart: current.bmi,
      simulatedStart: simulated.bmi,
      currentDrift: 1.2,
      simulatedDrift: simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek ? -0.4 : 0.6,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'Total cholesterol',
      description: 'Baseline vs simulated lifestyle',
      unit: 'mg/dL',
      startAge: currentInputs.age,
      currentStart: current.totalCholesterol,
      simulatedStart: simulated.totalCholesterol,
      currentDrift: 10,
      simulatedDrift: simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek || simulatedInputs.dietQuality > currentInputs.dietQuality ? 4 : 8,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'HDL cholesterol',
      description: 'Baseline vs simulated exercise',
      unit: 'mg/dL',
      startAge: currentInputs.age,
      currentStart: current.hdlCholesterol,
      simulatedStart: simulated.hdlCholesterol,
      currentDrift: -2.5,
      simulatedDrift: simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek ? 1.2 : -1.2,
      betterWhenLower: false
    })
  ];
}

function buildEstimatedBiomarkerCard({
  label,
  description,
  unit,
  startAge,
  currentStart,
  simulatedStart,
  currentDrift,
  simulatedDrift,
  betterWhenLower
}: {
  label: string;
  description: string;
  unit: string;
  startAge: number;
  currentStart: number;
  simulatedStart: number;
  currentDrift: number;
  simulatedDrift: number;
  betterWhenLower: boolean;
}): BiomarkerTrendCard {
  const endAge = Math.max(80, startAge + 10);
  const data: BiomarkerTrendPoint[] = [];

  for (let age = startAge; age <= endAge; age += 5) {
    const progress = (age - startAge) / Math.max(1, endAge - startAge);
    const eased = progress * progress * (3 - 2 * progress);
    data.push({
      age,
      current: round1(Math.max(0, currentStart + currentDrift * progress)),
      simulated: round1(Math.max(0, currentStart + (simulatedStart - currentStart) * eased + simulatedDrift * progress))
    });
  }

  return {
    label,
    description,
    unit,
    data,
    betterWhenLower
  };
}

function estimateSimulationBiomarkers(inputs: HealthInputs) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const smokerPenalty = inputs.smokingStatus === 'current' ? 12 : inputs.smokingStatus === 'former' ? 4 : 0;
  const exerciseBenefit = Math.max(0, inputs.exerciseDaysPerWeek - 2) * 1.2;
  const stressPenalty = Math.max(0, inputs.stressLevel - 2) * 2.4;
  const dietPenalty = Math.max(0, 4 - inputs.dietQuality) * 5;
  const alcoholPenalty = Math.max(0, inputs.alcoholDrinksPerWeek - 7) * 0.8;

  return {
    systolicBloodPressure: round1(
      clamp(110 + Math.max(0, inputs.age - 25) * 0.42 + Math.max(0, bmi - 24) * 1.3 + smokerPenalty * 0.45 + stressPenalty - exerciseBenefit, 95, 190)
    ),
    bmi: round1(bmi),
    totalCholesterol: round1(
      clamp(176 + Math.max(0, bmi - 23) * 2.2 + smokerPenalty * 0.9 + dietPenalty + alcoholPenalty - exerciseBenefit * 1.8, 130, 290)
    ),
    hdlCholesterol: round1(clamp((inputs.sex === 'female' ? 61 : 52) - Math.max(0, bmi - 24) * 0.9 - smokerPenalty * 0.35 + exerciseBenefit * 0.75, 30, 95))
  };
}

function getBiomarkerTrendDomain(data: BiomarkerTrendPoint[]): [number, number] {
  const values = data.flatMap((point) => [point.current, point.simulated]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, (max - min) * 0.16);
  return [Math.floor(min - padding), Math.ceil(max + padding)];
}

function formatBiomarkerValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function projectFuture(realAge: number, biologicalAge: number, risks: RiskScores, years: number) {
  const currentScore = 100 - risks.overall;
  const riskDrag = Math.max(-0.1, Math.min(0.42, (risks.overall - 34) / 110));
  const acceleratedYears = Math.round(years * riskDrag);
  const healthScore = Math.round(Math.max(14, Math.min(96, currentScore - years * Math.max(0, risks.overall - 40) / 52)));

  return {
    chronologicalAge: realAge + years,
    biologicalAge: Math.max(realAge + years - 4, biologicalAge + years + acceleratedYears),
    healthScore
  };
}

function TwinReactionCard({ loading, reaction }: { loading: boolean; reaction: string }) {
  return (
    <article className="mt-5 rounded-[1.35rem] border border-black/10 border-l-4 border-l-twin-dark bg-white/75 p-5 dark:border-white/10 dark:border-l-twin dark:bg-white/[0.07]">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-twin-dark/20 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
          <InfinityIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2 py-2">
              <div className="h-3 w-11/12 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-8/12 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
            </div>
          ) : (
            <>
              <p className="text-base italic leading-relaxed text-slate-600 dark:text-slate-300">&quot;{reaction}&quot;</p>
              <p className="mt-3 text-right text-sm font-medium text-slate-400 dark:text-slate-500">— Your future self</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

async function fetchTwinReaction({
  profileInputs,
  simulatedInputs,
  changedSummary,
  signal,
  onStart,
  onComplete,
  onError
}: {
  profileInputs: HealthInputs;
  simulatedInputs: HealthInputs;
  changedSummary: string;
  signal: AbortSignal;
  onStart: () => void;
  onComplete: (message: string) => void;
  onError: () => void;
}) {
  onStart();

  try {
    const baselineProfile = createTwinProfile(profileInputs);
    const simulatedProfile = createTwinProfile(simulatedInputs);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemPrompt: `${buildSystemPrompt(simulatedProfile)}

For this simulation quote, reply with one short first-person quote only. Maximum two sentences. No caveats, no diagnosis, no preface.`,
        messages: [
          {
            role: 'user',
            content: buildSimulationPrompt(baselineProfile, simulatedInputs, changedSummary)
          }
        ]
      })
    });

    if (!response.ok || !response.body) throw new Error(`Reaction endpoint returned ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

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
        if (data === '[DONE]') break;
        const parsed = JSON.parse(data) as { text: string };
        fullResponse += parsed.text;
      }
    }

    const cleaned = cleanReaction(fullResponse);
    onComplete(cleaned.includes('Mode degrade') ? '' : cleaned);
  } catch {
    if (signal.aborted) return;
    onError();
  }
}

function cleanReaction(value: string) {
  return value
    .replace(/^["“]|["”]$/g, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();
}

function buildLocalReaction(profileInputs: HealthInputs, simulatedInputs: HealthInputs) {
  if (simulatedInputs.sleepHours > profileInputs.sleepHours) {
    return `When I finally slept ${simulatedInputs.sleepHours} hours, the first thing I noticed was not energy. It was clarity.`;
  }
  if (simulatedInputs.exerciseDaysPerWeek > profileInputs.exerciseDaysPerWeek) {
    return `Those extra movement days changed my mood before they changed my numbers. My body started trusting me again.`;
  }
  if (simulatedInputs.stressLevel < profileInputs.stressLevel) {
    return `Lowering the stress did not make life smaller. It gave me enough room to choose instead of react.`;
  }
  if (simulatedInputs.smokingStatus !== profileInputs.smokingStatus) {
    return 'Quitting did not feel heroic at first. It felt like getting one future back from the edge.';
  }
  return 'This looks small from where you are. From where I am, it was one of the turns that mattered.';
}

function summarizeChanges(current: HealthInputs, simulated: HealthInputs) {
  const changes = SLIDERS.flatMap(({ key, label, unit }) =>
    current[key] !== simulated[key] ? [`${label} from ${current[key]} to ${simulated[key]} ${unit}`] : []
  );
  if (current.smokingStatus !== simulated.smokingStatus) {
    changes.push(`Smoking from ${current.smokingStatus} to ${simulated.smokingStatus}`);
  }
  return changes.join(', ') || 'baseline';
}

function sameInputs(a: HealthInputs, b: HealthInputs) {
  return JSON.stringify(a) === JSON.stringify(b);
}
