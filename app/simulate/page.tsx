'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowRight, ArrowUp, Infinity as InfinityIcon, Mail, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageTransition } from '@/components/PageTransition';
import TimeCapsule from '@/components/TimeCapsule';
import type { HealthInputs, RiskScores } from '@/lib/fhir';
import { computeBiologicalAge, computeRisks } from '@/lib/risks';
import { createTwinProfile } from '@/lib/profile';
import { buildSimulationPrompt, buildSystemPrompt } from '@/lib/twin-prompt';
import { useFutureMeStore } from '@/lib/store';
import { runPipelineFromClient } from '@/lib/backend/client';
import { buildCompletedMedicalProfile } from '@/lib/riskCalculator';
import {
  type BiomarkerInterventionTrajectory,
  type CategoricalTransition,
  type ProjectionPoint,
} from '@/lib/riskProjection';
import { generateFutureProjection, type FutureProjectionResult } from '@/lib/projections';
import { generateScenarioResult } from '@/lib/scenarios';
import type { PipelineResponse } from '@/lib/backend/types';
import type { ScenarioResult, UserInput } from '@/types/medical';

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

type ProjectionScenarioId = 'baseline' | 'structured_exercise' | 'sleep_improvement' | 'stress_reduction' | 'stop_smoking';

type ClinicalProjectionOverrides = {
  systolicBloodPressure?: number;
  totalCholesterol?: number;
  hdlCholesterol?: number;
};

const SCENARIO_CARDS: Array<{
  id: ProjectionScenarioId;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'baseline',
    title: 'Keep current habits',
    subtitle: 'Baseline path with current biomarkers maintained.'
  },
  {
    id: 'structured_exercise',
    title: 'Exercise more',
    subtitle: 'Apply structured exercise effects over 12 weeks.'
  },
  {
    id: 'sleep_improvement',
    title: 'Sleep 7-8h',
    subtitle: 'Apply the short-sleeper SBP effect when eligible.'
  },
  {
    id: 'stress_reduction',
    title: 'Reduce stress / MBSR',
    subtitle: 'Apply an 8-week MBSR blood pressure effect.'
  },
  {
    id: 'stop_smoking',
    title: 'Stop smoking',
    subtitle: 'Switch the Framingham smoking input to no.'
  }
];

export default function SimulatePage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const setSimulatedInputs = useFutureMeStore((state) => state.setSimulatedInputs);
  const pipelineAnalysis = useFutureMeStore((state) => state.pipelineAnalysis);
  const setPipelineAnalysis = useFutureMeStore((state) => state.setPipelineAnalysis);
  const currentUserEmail = useFutureMeStore((state) => state.currentUserEmail);
  const [reaction, setReaction] = useState('Adjust a habit and I will tell you what changed from my side of time.');
  const [reactionLoading, setReactionLoading] = useState(false);
  const [timeCapsuleOpen, setTimeCapsuleOpen] = useState(false);
  const [projectionYears, setProjectionYears] = useState<(typeof HORIZONS)[number]>(20);
  const [pipelineBootstrapError, setPipelineBootstrapError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<ProjectionScenarioId>('baseline');
  const [clinicalOverrides, setClinicalOverrides] = useState<ClinicalProjectionOverrides>({});

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
      const nextInputs = { ...simulatedInputs, [key]: value };
      setSimulatedInputs(nextInputs);
      if (profile) {
        setSelectedScenarioId(inferScenarioFromChangedInput(key, profile.inputs, nextInputs));
      }
    },
    [profile, setSimulatedInputs, simulatedInputs]
  );

  const handleScenarioSelect = useCallback(
    (scenarioId: ProjectionScenarioId) => {
      if (!profile) return;
      setSelectedScenarioId(scenarioId);
      setSimulatedInputs(applyScenarioTargetInputs(profile.inputs, scenarioId));
    },
    [profile, setSimulatedInputs]
  );

  const handleClinicalOverrideChange = useCallback(
    (field: keyof ClinicalProjectionOverrides, value: number | undefined) => {
      setClinicalOverrides((current) => {
        const next = { ...current };
        if (value === undefined || !Number.isFinite(value)) {
          delete next[field];
        } else {
          next[field] = value;
        }
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (profile && !simulatedInputs) {
      setSimulatedInputs(profile.inputs);
    }
  }, [profile, setSimulatedInputs, simulatedInputs]);

  useEffect(() => {
    setSelectedScenarioId('baseline');
    setClinicalOverrides({});
  }, [profile?.createdAt]);

  useEffect(() => {
    if (!profile || pipelineAnalysis) return undefined;

    let cancelled = false;
    setPipelineBootstrapError(null);

    void runPipelineFromClient({
      inputs: profile.inputs,
      yearsOfHistory: 5,
      includePubMed: false,
      enableLlmSummary: false,
      enableLocalRagCache: false,
      kNearest: 3
    })
      .then((analysis) => {
        if (!cancelled) setPipelineAnalysis(analysis);
      })
      .catch((error) => {
        if (!cancelled) {
          setPipelineBootstrapError(error instanceof Error ? error.message : 'Could not estimate missing biomarkers.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pipelineAnalysis, profile, setPipelineAnalysis]);

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
  const projectionView = buildFutureProjectionView(
    profile.inputs,
    simulatedInputs,
    pipelineAnalysis,
    pipelineBootstrapError,
    selectedScenarioId,
    clinicalOverrides
  );

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
                onClick={() => {
                  setSelectedScenarioId('baseline');
                  setSimulatedInputs(profile.inputs);
                }}
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

          <FutureProjectionSection
            view={projectionView}
            currentInputs={profile.inputs}
            simulatedInputs={simulatedInputs}
            selectedScenarioId={selectedScenarioId}
            clinicalOverrides={clinicalOverrides}
            onScenarioSelect={handleScenarioSelect}
            onClinicalOverrideChange={handleClinicalOverrideChange}
          />
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
      <div className="relative mt-2 h-5 font-mono text-[11px] text-slate-400 dark:text-slate-600">
        {HORIZONS.map((year) => (
          <span
            key={year}
            className="absolute -translate-x-1/2"
            style={{ left: `${((year - 10) / 30) * 100}%` }}
          >
            {year}y
          </span>
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

type FutureProjectionView =
  | {
      status: 'ready';
      projection: FutureProjectionResult;
      result?: ScenarioResult;
      currentProfile: ReturnType<typeof buildCompletedMedicalProfile>;
      biomarkerTrajectories: BiomarkerInterventionTrajectory[];
      categoricalTransitions: CategoricalTransition[];
      currentRisk: number;
      baselineTenYearRisk: number;
      interventionTenYearRisk?: number;
      absoluteDifference?: number;
      relativeDifference?: number;
      warnings: string[];
    }
  | {
      status: 'unavailable';
      message: string;
      warnings: string[];
    };

function FutureProjectionSection({
  view,
  currentInputs,
  simulatedInputs,
  selectedScenarioId,
  clinicalOverrides,
  onScenarioSelect,
  onClinicalOverrideChange
}: {
  view: FutureProjectionView;
  currentInputs: HealthInputs;
  simulatedInputs: HealthInputs;
  selectedScenarioId: ProjectionScenarioId;
  clinicalOverrides: ClinicalProjectionOverrides;
  onScenarioSelect: (scenarioId: ProjectionScenarioId) => void;
  onClinicalOverrideChange: (field: keyof ClinicalProjectionOverrides, value: number | undefined) => void;
}) {
  return (
    <section className="rounded-[1.7rem] border border-black/10 bg-white/75 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-twin-dark dark:text-twin">Formula-based projection</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">Future Health Projection</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-500">
            Change a habit and see how your biomarkers and cardiovascular risk projection respond.
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
          {view.status === 'ready' && view.result ? 'If you change this habit' : 'If you keep living like this'}
        </span>
      </div>

      <ScenarioSelector
        currentInputs={currentInputs}
        simulatedInputs={simulatedInputs}
        selectedScenarioId={selectedScenarioId}
        onSelect={onScenarioSelect}
      />

      {view.status === 'ready' ? (
        <>
          <ClinicalMarkerControls
            profile={view.currentProfile}
            overrides={clinicalOverrides}
            onChange={onClinicalOverrideChange}
          />
          <ProjectionSummaryCards view={view} />
          <RiskProjectionChart projection={view.projection} />
          <BiomarkerTrajectoryGrid trajectories={view.biomarkerTrajectories} transitions={view.categoricalTransitions} />
          <ProjectionExplanation warnings={view.warnings} />
        </>
      ) : (
        <div className="mt-6 rounded-[1.35rem] border border-amber-300/30 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-800 dark:border-amber-400/20 dark:text-amber-200">
          <p className="font-semibold">Clinical markers needed for Framingham projection.</p>
          <p className="mt-2">{view.message}</p>
          {view.warnings.map((warning) => (
            <p key={warning} className="mt-2">{warning}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function ScenarioSelector({
  currentInputs,
  simulatedInputs,
  selectedScenarioId,
  onSelect
}: {
  currentInputs: HealthInputs;
  simulatedInputs: HealthInputs;
  selectedScenarioId: ProjectionScenarioId;
  onSelect: (scenarioId: ProjectionScenarioId) => void;
}) {
  const visibleCards = SCENARIO_CARDS.filter((card) => card.id !== 'stop_smoking' || currentInputs.smokingStatus === 'current');

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-950 dark:text-white">Choose projection path</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {visibleCards.map((card) => {
          const disabled = isScenarioDisabled(card.id, currentInputs);
          const active = selectedScenarioId === card.id;
          const detail = getScenarioDetail(card.id, currentInputs, simulatedInputs);

          return (
            <button
              key={card.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(card.id)}
              className={`min-h-[8.5rem] rounded-[1.15rem] border p-4 text-left transition ${
                active
                  ? 'border-twin-dark bg-twin-dark/10 text-slate-950 dark:border-twin dark:bg-twin/10 dark:text-white'
                  : 'border-black/10 bg-white/60 text-slate-700 hover:border-twin-dark/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:border-twin/30 dark:hover:bg-white/[0.08]'
              } ${disabled ? 'cursor-not-allowed opacity-45 hover:border-black/10 dark:hover:border-white/10' : ''}`}
            >
              <span className="block text-sm font-semibold">{card.title}</span>
              <span className="mt-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-500">{card.subtitle}</span>
              <span className="mt-3 block font-mono text-xs text-twin-dark dark:text-twin">{detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClinicalMarkerControls({
  profile,
  overrides,
  onChange
}: {
  profile: ReturnType<typeof buildCompletedMedicalProfile>;
  overrides: ClinicalProjectionOverrides;
  onChange: (field: keyof ClinicalProjectionOverrides, value: number | undefined) => void;
}) {
  const controls: Array<{
    field: keyof ClinicalProjectionOverrides;
    label: string;
    unit: string;
    min: number;
    max: number;
    fallback: number;
  }> = [
    {
      field: 'systolicBloodPressure',
      label: 'SBP',
      unit: 'mmHg',
      min: 90,
      max: 220,
      fallback: profile.systolicBloodPressure
    },
    {
      field: 'totalCholesterol',
      label: 'Total cholesterol',
      unit: 'mg/dL',
      min: 100,
      max: 350,
      fallback: profile.totalCholesterol
    },
    {
      field: 'hdlCholesterol',
      label: 'HDL',
      unit: 'mg/dL',
      min: 20,
      max: 120,
      fallback: profile.hdlCholesterol
    }
  ];

  return (
    <div className="mt-5 rounded-[1.25rem] border border-black/10 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Clinical baseline used by Framingham</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Values come from user data or matched Synthea estimates. Editing them recalculates the projection immediately.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {controls.map((control) => {
          const value = overrides[control.field] ?? control.fallback;
          const isOverride = overrides[control.field] !== undefined;
          return (
            <label key={control.field} className="block rounded-2xl border border-black/10 bg-white/65 p-3 dark:border-white/10 dark:bg-white/[0.06]">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-500">{control.label}</span>
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={control.min}
                  max={control.max}
                  value={value}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    onChange(control.field, Number.isFinite(parsed) ? parsed : undefined);
                  }}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition focus:border-twin-dark dark:border-white/10 dark:bg-navy-950 dark:text-white dark:focus:border-twin"
                />
                <span className="shrink-0 text-xs text-slate-400">{control.unit}</span>
              </span>
              <span className="mt-2 block min-h-4 text-xs text-slate-400 dark:text-slate-600">
                {isOverride ? 'edited in this simulation' : 'current estimate'}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ProjectionSummaryCards({ view }: { view: Extract<FutureProjectionView, { status: 'ready' }> }) {
  const interventionTenYearRisk = view.interventionTenYearRisk;
  const hasIntervention = interventionTenYearRisk !== undefined;
  const cards: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Current risk', value: `${formatProjectionNumber(view.currentRisk)}%` },
    { label: 'Baseline 10-year projected risk', value: `${formatProjectionNumber(view.baselineTenYearRisk)}%` }
  ];

  if (hasIntervention) {
    cards.push(
      {
        label: 'Intervention 10-year projected risk',
        value: `${formatProjectionNumber(interventionTenYearRisk)}%`,
        highlight: true
      },
      {
        label: 'Absolute difference',
        value: `${formatSignedProjectionNumber(view.absoluteDifference ?? 0)} pp`
      },
      {
        label: 'Relative difference',
        value: `${formatSignedProjectionNumber(view.relativeDifference ?? 0)}%`
      }
    );
  }

  return (
    <div className={`mt-6 grid gap-3 sm:grid-cols-2 ${hasIntervention ? 'xl:grid-cols-5' : 'xl:grid-cols-2'}`}>
      {cards.map((card) => (
        <article key={card.label} className="rounded-[1.2rem] border border-black/10 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.07]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-500">{card.label}</p>
          <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${card.highlight ? 'text-twin-dark dark:text-twin' : 'text-slate-950 dark:text-white'}`}>
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}

function RiskProjectionChart({ projection }: { projection: FutureProjectionResult }) {
  const data = projection.baselineRisk.map((point, index) => ({
    label: point.label,
    baseline: point.risk,
    intervention: projection.interventionRisk?.[index]?.risk
  }));
  const hasIntervention = Boolean(projection.interventionRisk);

  return (
    <article className="mt-5 rounded-[1.35rem] border border-black/10 bg-white/72 p-5 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Framingham 10-year risk %</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Risk projection over time</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-slate-400" />
            Baseline line
          </span>
          {hasIntervention ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-5 rounded-full bg-twin-dark dark:bg-twin" />
              Intervention line
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 18, top: 18, bottom: 4 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} width={42} />
            <Tooltip content={<ProjectionTooltip />} />
            <Line
              type="monotone"
              dataKey="baseline"
              stroke="#94A3B8"
              strokeWidth={3}
              dot={{ r: 4, fill: '#94A3B8', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#94A3B8' }}
              name="Baseline"
              animationDuration={850}
            />
            {hasIntervention ? (
              <Line
                type="monotone"
                dataKey="intervention"
                stroke="#00A389"
                strokeWidth={3}
                dot={{ r: 4, fill: '#00A389', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#00A389' }}
                name="Intervention"
                animationDuration={850}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function ProjectionTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; color?: string; name?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm shadow-xl dark:border-white/10 dark:bg-navy-900">
      <p className="mb-2 font-medium text-slate-950 dark:text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-mono">
          {entry.name}: {typeof entry.value === 'number' ? formatProjectionNumber(entry.value) : entry.value}%
        </p>
      ))}
    </div>
  );
}

function BiomarkerTrajectoryGrid({
  trajectories,
  transitions
}: {
  trajectories: BiomarkerInterventionTrajectory[];
  transitions: CategoricalTransition[];
}) {
  if (trajectories.length === 0 && transitions.length === 0) {
    return (
      <div className="mt-5 rounded-[1.35rem] border border-black/10 bg-white/60 p-5 text-sm leading-relaxed text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
        Baseline path: assuming current biomarkers and habits are maintained.
      </div>
    );
  }

  return (
    <div className="mt-5">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Intervention biomarker changes</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
        Biomarker trajectories are shown only over the modeled intervention period and only for fields changed by the selected scenario.
      </p>

      {transitions.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {transitions.map((transition) => (
            <CategoricalTransitionCard key={transition.label} transition={transition} />
          ))}
        </div>
      ) : null}

      {trajectories.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {trajectories.map((trajectory) => (
            <BiomarkerTrajectoryCard key={trajectory.label} trajectory={trajectory} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoricalTransitionCard({ transition }: { transition: CategoricalTransition }) {
  return (
    <article className="rounded-[1.35rem] border border-black/10 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{transition.label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Categorical Framingham input</p>
        </div>
        <span className="rounded-full border border-twin-dark/20 bg-twin-dark/10 px-2.5 py-1 text-xs font-semibold text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
          {transition.confidence}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricValue label="Current" value={transition.before ? 'yes' : 'no'} unit="status" />
        <MetricValue label="Simulated" value={transition.after ? 'yes' : 'no'} unit="status" highlight />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
        Time horizon: {transition.timeHorizon}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-500">Source: {transition.source}</p>
    </article>
  );
}

function BiomarkerTrajectoryCard({ trajectory }: { trajectory: BiomarkerInterventionTrajectory }) {
  const domain = getTrajectoryDomain(trajectory.points);

  return (
    <article className="rounded-[1.35rem] border border-black/10 bg-white/72 p-4 dark:border-white/10 dark:bg-white/[0.07]">
      <div className="flex min-h-[4.2rem] items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{trajectory.label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{trajectory.displayHorizon}</p>
        </div>
        <span className="rounded-full border border-twin-dark/20 bg-twin-dark/10 px-2.5 py-1 text-xs font-semibold text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
          {trajectory.confidence}
        </span>
      </div>

      <div className="mt-3 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trajectory.points} margin={{ left: 0, right: 8, top: 8, bottom: 2 }}>
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              ticks={trajectory.xAxisTicks}
              tickFormatter={(week) => `Week ${week}`}
            />
            <YAxis hide domain={domain} />
            <Tooltip content={<BiomarkerTrajectoryTooltip unit={trajectory.unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#00A389"
              strokeWidth={2.8}
              dot={false}
              activeDot={{ r: 4, fill: '#00A389' }}
              name={trajectory.label}
              animationDuration={850}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricValue label="Current" value={formatProjectionNumber(trajectory.before)} unit={trajectory.unit} />
        <MetricValue label="Simulated" value={formatProjectionNumber(trajectory.after)} unit={trajectory.unit} highlight />
      </div>
      <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.05]">
        <p className="font-medium text-slate-500 dark:text-slate-500">Absolute change</p>
        <p className="mt-1 font-mono font-semibold text-slate-950 dark:text-white">
          {formatSignedProjectionNumber(trajectory.delta)} {trajectory.unit}
        </p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-500">Source: {trajectory.source}</p>
    </article>
  );
}

function BiomarkerTrajectoryTooltip({
  active,
  payload,
  label,
  unit
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm shadow-xl dark:border-white/10 dark:bg-navy-900">
      <p className="mb-1 font-medium text-slate-950 dark:text-white">Week {label}</p>
      <p className="text-twin-dark dark:text-twin">
        {typeof value === 'number' ? formatProjectionNumber(value) : value} {unit}
      </p>
    </div>
  );
}

function ProjectionExplanation({ warnings }: { warnings: string[] }) {
  return (
    <div className="mt-5 space-y-2 rounded-[1.2rem] border border-black/10 bg-white/60 p-4 text-xs leading-relaxed text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
      <p>
        Risk curves show Framingham 10-year risk recalculated at future ages. Biomarker curves show evidence-backed changes over the intervention period. This is a preventive simulation, not a diagnosis.
      </p>
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}

function MetricValue({
  label,
  value,
  unit,
  highlight = false
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.06]">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold tabular-nums ${highlight ? 'text-twin-dark dark:text-twin' : 'text-slate-950 dark:text-white'}`}>
        {value}
        {unit && unit !== 'status' ? <span className="ml-1 text-xs text-slate-400">{unit}</span> : null}
      </p>
    </div>
  );
}

function buildFutureProjectionView(
  currentInputs: HealthInputs,
  simulatedInputs: HealthInputs,
  pipelineAnalysis: PipelineResponse | null,
  pipelineBootstrapError: string | null,
  selectedScenarioId: ProjectionScenarioId,
  clinicalOverrides: ClinicalProjectionOverrides
): FutureProjectionView {
  const userInput = toFormulaUserInput(currentInputs);
  if (!userInput) {
    return {
      status: 'unavailable',
      message: 'The Framingham equation used here requires sex to be male or female.',
      warnings: []
    };
  }

  if (!pipelineAnalysis) {
    try {
      const currentProfile = buildCompletedMedicalProfile(userInput, getProfileEstimates(null, clinicalOverrides));
      const projection = generateFutureProjection(currentProfile);
      const baselineTenYear = getLastProjectionPoint(projection.baselineRisk);

      return {
        status: 'ready',
        projection,
        currentProfile,
        biomarkerTrajectories: [],
        categoricalTransitions: [],
        currentRisk: projection.baselineRisk[0].risk,
        baselineTenYearRisk: baselineTenYear.risk,
        warnings: projection.assumptions
      };
    } catch {
      return {
        status: 'unavailable',
        message: pipelineBootstrapError ?? 'Estimating missing clinical markers from the matched Synthea cohort.',
        warnings: pipelineBootstrapError
          ? ['No default clinical values were invented for this projection.']
          : ['Missing biomarkers are estimated from a rule-based matched cohort of similar synthetic Synthea patients.']
      };
    }
  }

  try {
    const currentProfile = buildCompletedMedicalProfile(userInput, getProfileEstimates(pipelineAnalysis, clinicalOverrides));
    const inferredScenarioId = inferScenarioFromInputs(currentInputs, simulatedInputs);
    const activeScenarioId = selectedScenarioId === 'baseline' ? inferredScenarioId : selectedScenarioId;
    const result = activeScenarioId === 'baseline'
      ? undefined
      : generateScenarioResult(currentProfile, userInput, activeScenarioId);
    const projection = generateFutureProjection(currentProfile, result);
    const baselineTenYear = getLastProjectionPoint(projection.baselineRisk);
    const interventionTenYear = projection.interventionRisk ? getLastProjectionPoint(projection.interventionRisk) : undefined;
    const absoluteDifference = interventionTenYear ? baselineTenYear.risk - interventionTenYear.risk : undefined;
    const relativeDifference = absoluteDifference !== undefined && baselineTenYear.risk > 0
      ? (absoluteDifference / baselineTenYear.risk) * 100
      : undefined;

    return {
      status: 'ready',
      projection,
      result,
      currentProfile,
      biomarkerTrajectories: projection.biomarkerTrajectories,
      categoricalTransitions: projection.categoricalTransitions,
      currentRisk: projection.baselineRisk[0].risk,
      baselineTenYearRisk: baselineTenYear.risk,
      interventionTenYearRisk: interventionTenYear?.risk,
      absoluteDifference,
      relativeDifference,
      warnings: Array.from(new Set([...projection.assumptions, ...projection.warnings]))
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'The current clinical profile could not be completed.',
      warnings: ['No default clinical values were invented for this projection.']
    };
  }
}

function toFormulaUserInput(inputs: HealthInputs): UserInput | null {
  if (inputs.sex !== 'male' && inputs.sex !== 'female') return null;

  return {
    age: inputs.age,
    sex: inputs.sex,
    heightCm: inputs.heightCm,
    weightKg: inputs.weightKg,
    smokingStatus: inputs.smokingStatus,
    exerciseDaysPerWeek: inputs.exerciseDaysPerWeek,
    sleepHours: inputs.sleepHours,
    stressLevel: inputs.stressLevel,
    alcoholDrinksPerWeek: inputs.alcoholDrinksPerWeek
  };
}

function getProfileEstimates(pipelineAnalysis: PipelineResponse | null, clinicalOverrides: ClinicalProjectionOverrides) {
  const markers = pipelineAnalysis?.derivedClinicalMarkers;

  return {
    systolicBloodPressure: clinicalOverrides.systolicBloodPressure ?? markers?.systolicBloodPressureMmHg,
    totalCholesterol: clinicalOverrides.totalCholesterol ?? markers?.totalCholesterolMgDl,
    hdlCholesterol: clinicalOverrides.hdlCholesterol ?? markers?.hdlMgDl,
    diabetes: markers?.hasDiabetes,
    onBloodPressureTreatment: markers?.onBloodPressureTreatment
  };
}

function applyScenarioTargetInputs(currentInputs: HealthInputs, scenarioId: ProjectionScenarioId): HealthInputs {
  if (scenarioId === 'baseline') return currentInputs;

  if (scenarioId === 'structured_exercise') {
    return {
      ...currentInputs,
      exerciseDaysPerWeek: Math.min(7, Math.max(currentInputs.exerciseDaysPerWeek + 1, 5))
    };
  }

  if (scenarioId === 'sleep_improvement') {
    return {
      ...currentInputs,
      sleepHours: Math.max(7, Math.min(8, Math.max(currentInputs.sleepHours, 8)))
    };
  }

  if (scenarioId === 'stress_reduction') {
    return {
      ...currentInputs,
      stressLevel: Math.max(1, currentInputs.stressLevel - 2)
    };
  }

  if (scenarioId === 'stop_smoking') {
    return {
      ...currentInputs,
      smokingStatus: currentInputs.smokingStatus === 'current' ? 'former' : currentInputs.smokingStatus
    };
  }

  return currentInputs;
}

function inferScenarioFromChangedInput(
  key: keyof HealthInputs,
  currentInputs: HealthInputs,
  simulatedInputs: HealthInputs
): ProjectionScenarioId {
  if (key === 'smokingStatus' && currentInputs.smokingStatus === 'current' && simulatedInputs.smokingStatus !== 'current') {
    return 'stop_smoking';
  }

  if (key === 'exerciseDaysPerWeek' && simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek) {
    return 'structured_exercise';
  }

  if (
    key === 'sleepHours' &&
    currentInputs.sleepHours < 7 &&
    simulatedInputs.sleepHours >= 7 &&
    simulatedInputs.sleepHours > currentInputs.sleepHours
  ) {
    return 'sleep_improvement';
  }

  if (key === 'stressLevel' && simulatedInputs.stressLevel < currentInputs.stressLevel) {
    return 'stress_reduction';
  }

  return inferScenarioFromInputs(currentInputs, simulatedInputs);
}

function inferScenarioFromInputs(currentInputs: HealthInputs, simulatedInputs: HealthInputs): ProjectionScenarioId {
  if (currentInputs.smokingStatus === 'current' && simulatedInputs.smokingStatus !== 'current') {
    return 'stop_smoking';
  }

  if (simulatedInputs.exerciseDaysPerWeek > currentInputs.exerciseDaysPerWeek) {
    return 'structured_exercise';
  }

  if (currentInputs.sleepHours < 7 && simulatedInputs.sleepHours >= 7 && simulatedInputs.sleepHours > currentInputs.sleepHours) {
    return 'sleep_improvement';
  }

  if (simulatedInputs.stressLevel < currentInputs.stressLevel) {
    return 'stress_reduction';
  }

  return 'baseline';
}

function isScenarioDisabled(scenarioId: ProjectionScenarioId, currentInputs: HealthInputs) {
  if (scenarioId === 'sleep_improvement') return currentInputs.sleepHours >= 7;
  return false;
}

function getScenarioDetail(
  scenarioId: ProjectionScenarioId,
  currentInputs: HealthInputs,
  simulatedInputs: HealthInputs
) {
  if (scenarioId === 'baseline') return 'baseline only';
  if (scenarioId === 'structured_exercise') {
    return `${currentInputs.exerciseDaysPerWeek} to ${Math.max(simulatedInputs.exerciseDaysPerWeek, applyScenarioTargetInputs(currentInputs, scenarioId).exerciseDaysPerWeek)} days/wk`;
  }
  if (scenarioId === 'sleep_improvement') {
    if (currentInputs.sleepHours >= 7) return 'already 7h+';
    return `${currentInputs.sleepHours} to ${Math.max(7, simulatedInputs.sleepHours)} h/night`;
  }
  if (scenarioId === 'stress_reduction') {
    return `${currentInputs.stressLevel} to ${Math.min(simulatedInputs.stressLevel, applyScenarioTargetInputs(currentInputs, scenarioId).stressLevel)}/5 stress`;
  }
  if (scenarioId === 'stop_smoking') return 'yes to no';
  return '';
}

function getTrajectoryDomain(data: BiomarkerInterventionTrajectory['points']): [number, number] {
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(0.5, (max - min) * 0.18);
  return [Math.floor((min - padding) * 10) / 10, Math.ceil((max + padding) * 10) / 10];
}

function getLastProjectionPoint(points: ProjectionPoint[]) {
  return points[points.length - 1];
}

function formatProjectionNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSignedProjectionNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${formatProjectionNumber(rounded)}` : formatProjectionNumber(rounded);
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
