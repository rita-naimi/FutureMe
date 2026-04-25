'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileJson, Maximize2, X } from 'lucide-react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import dynamic from 'next/dynamic';
import { PageTransition } from '@/components/PageTransition';
import type { HealthInputs, RiskScores } from '@/lib/fhir';

const TwinAvatarViewer = dynamic(() => import('@/components/twin/TwinAvatarViewer'), { ssr: false });
import { computeBiologicalAge, computeRisks, healthScoreFromRisks } from '@/lib/risks';
import { useFutureMeStore } from '@/lib/store';

type Priority = {
  score: number;
  heroSentence: string;
  title: string;
  evidence: string;
};

type ProjectionPoint = {
  age: number;
  current: number;
  optimized: number;
};

const CARD =
  'rounded-[1.65rem] border border-black/10 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20';

export default function DashboardPage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const dashboard = useMemo(() => {
    if (!profile) return null;

    const hasSimulation = Boolean(simulatedInputs && !sameInputs(profile.inputs, simulatedInputs));
    const activeInputs = hasSimulation && simulatedInputs ? simulatedInputs : profile.inputs;
    const currentRisks = computeRisks(profile.inputs);
    const activeRisks = computeRisks(activeInputs);
    const optimizedInputs = hasSimulation && simulatedInputs ? simulatedInputs : getOptimizedInputs(profile.inputs);
    const optimizedRisks = computeRisks(optimizedInputs);
    const biologicalAge = computeBiologicalAge(activeInputs, activeRisks);
    const priorities = getTopPriorities(activeInputs, activeRisks);
    const projection = buildProjectionData(profile.inputs, currentRisks, optimizedInputs, optimizedRisks);
    const projectionGap = getProjectionYearsGap(projection);

    return {
      activeInputs,
      activeRisks,
      biologicalAge,
      currentInputs: profile.inputs,
      currentRisks,
      createdAt: profile.createdAt,
      hasSimulation,
      healthScore: healthScoreFromRisks(activeRisks),
      optimizedInputs,
      optimizedRisks,
      priority: priorities[0],
      projection,
      projectionGap
    };
  }, [profile, simulatedInputs]);

  if (!profile || !dashboard) {
    return (
      <main className="min-h-screen bg-ivory px-5 pb-28 pt-8 dark:bg-navy-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-twin-dark/25 bg-twin-dark/10 dark:border-twin/30 dark:bg-twin/10">
            <FileJson className="h-6 w-6 text-twin-dark dark:text-twin" />
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">Create a profile first</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            FutureMe needs your questionnaire profile before it can show your post-login experience.
          </p>
          <Link
            href="/onboarding"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-twin-dark px-5 py-3 font-semibold text-white dark:bg-twin dark:text-navy-950"
          >
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-b from-ivory to-ivory-dark px-5 pb-32 pt-16 dark:bg-navy-950 dark:bg-none sm:px-8 lg:px-10">
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex gap-6">
            <section className={`${CARD} relative min-w-0 flex-1 overflow-hidden p-5 sm:p-6 lg:p-7`}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-twin-dark/10 dark:bg-twin/10 lg:-right-20 lg:-top-20 lg:h-72 lg:w-72" />
              <div className="pointer-events-none absolute bottom-0 left-1/2 hidden h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin-dark/35 to-transparent dark:via-twin/40 lg:block" />
              <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div>
                  <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight text-slate-950 dark:text-slate-100 lg:text-5xl">
                    {getGreeting()}, {dashboard.activeInputs.name}.
                    <span className="block">This is your body today.</span>
                  </h1>
                  <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    {getHeroSubtitle(dashboard.biologicalAge, dashboard.activeInputs.age, dashboard.healthScore)}
                  </p>
                </div>
                <HealthScoreRing score={dashboard.healthScore} />
              </div>
            </section>

            <div className="w-52 flex-shrink-0 overflow-hidden rounded-[1.65rem] lg:w-64">
              <TwinAvatarViewer
                inputs={dashboard.activeInputs}
                biologicalAge={dashboard.biologicalAge}
                healthScore={dashboard.healthScore}
                interactive={false}
                height="100%"
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(0,1.45fr)]">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
              <BiologicalAgeHero
                realAge={dashboard.activeInputs.age}
                biologicalAge={dashboard.biologicalAge}
                dateLabel={formatDate(dashboard.createdAt)}
              />

              <section className={`${CARD} border-l-[6px] border-l-twin-dark p-5 dark:border-l-twin sm:p-6 xl:min-h-[18rem]`}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-twin-dark dark:text-twin">
                  Your highest leverage change
                </p>
                <h2 className="mt-4 font-display text-2xl font-bold leading-tight text-slate-950 dark:text-white lg:text-3xl">
                  {dashboard.priority.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {dashboard.priority.evidence}
                </p>
                <Link
                  href="/simulate"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-twin-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
                >
                  Simulate this change
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            </div>

            <div className="space-y-6">
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <RiskCard
                  index={0}
                  label="Cardiovascular risk"
                  value={dashboard.activeRisks.cardiovascular}
                  description="Heart, vessels, smoking, family history"
                />
                <RiskCard
                  index={1}
                  label="Metabolic risk"
                  value={dashboard.activeRisks.metabolic}
                  description="BMI, food quality, movement, diabetes history"
                />
                <RiskCard
                  index={2}
                  label="Stress load"
                  value={dashboard.activeRisks.mentalResilience}
                  description="Sleep, stress, recovery capacity"
                />
                <RiskCard
                  index={3}
                  label="Longevity drag"
                  value={100 - dashboard.activeRisks.longevity}
                  description="The drag against your long-term trajectory"
                />
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
                <HabitRadarCard
                  currentInputs={dashboard.currentInputs}
                  simulatedInputs={dashboard.hasSimulation ? dashboard.activeInputs : null}
                />
                <MiniProjectionCard
                  data={dashboard.projection}
                  yearsGap={dashboard.projectionGap}
                  onOpen={() => setTimelineOpen(true)}
                />
              </section>
            </div>
          </div>
        </div>
      </PageTransition>

      <AnimatePresence>
        {timelineOpen ? (
          <TimelineModal
            data={dashboard.projection}
            yearsGap={dashboard.projectionGap}
            startAge={dashboard.currentInputs.age}
            onClose={() => setTimelineOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function HealthScoreRing({ score }: { score: number }) {
  const progress = useMotionValue(0);
  const rounded = useTransform(progress, Math.round);
  const circumference = 2 * Math.PI * 54;
  const offset = useTransform(progress, (latest) => circumference * (1 - latest / 100));
  const color = getScoreColor(score);

  useEffect(() => {
    const controls = animate(progress, score, { duration: 1.4, ease: 'easeOut' });
    return controls.stop;
  }, [progress, score]);

  return (
    <div className="mx-auto flex w-36 flex-col items-center sm:mx-0 lg:w-44">
      <div className="relative h-32 w-32 lg:h-40 lg:w-40">
        <svg className="-rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            stroke="rgba(100,116,139,0.18)"
            strokeWidth="10"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="10"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="font-display text-4xl font-bold tabular-nums text-slate-950 dark:text-white lg:text-5xl">
            {rounded}
          </motion.span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-500">Health score</span>
        </div>
      </div>
    </div>
  );
}

function BiologicalAgeHero({
  realAge,
  biologicalAge,
  dateLabel
}: {
  realAge: number;
  biologicalAge: number;
  dateLabel: string;
}) {
  const count = useMotionValue(realAge);
  const rounded = useTransform(count, Math.round);
  const delta = biologicalAge - realAge;
  const isOlder = delta > 0;
  const sameAge = delta === 0;

  useEffect(() => {
    const controls = animate(count, biologicalAge, {
      duration: 1.5,
      delay: 0.2,
      ease: 'easeOut'
    });
    return controls.stop;
  }, [biologicalAge, count]);

  return (
    <section className={`${CARD} flex h-full flex-col justify-center p-7 text-center sm:p-9`}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
        Biological age
      </p>
      <motion.span className="mt-3 block font-display text-8xl font-bold leading-none tabular-nums text-slate-950 dark:text-white xl:text-9xl">
        {rounded}
      </motion.span>
      <div
        className={`mt-5 inline-flex max-w-full items-center rounded-full border px-4 py-2 text-sm font-semibold ${
          sameAge
            ? 'border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400'
            : isOlder
              ? 'border-red-300/40 bg-red-500/10 text-red-600 dark:border-red-500/25 dark:text-red-300'
              : 'border-twin-dark/25 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin'
        }`}
      >
        {sameAge
          ? 'Same as your real age'
          : `${isOlder ? '↑' : '↓'} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'year' : 'years'} ${
              isOlder ? 'older' : 'younger'
            } than your real age`}
      </div>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-600">Based on your FHIR R4 profile · {dateLabel}</p>
      <p className="mt-5 text-sm text-slate-500 dark:text-slate-500">
        Every habit you change on the Simulate page updates this number.
      </p>
    </section>
  );
}

function RiskCard({
  label,
  value,
  description,
  index
}: {
  label: string;
  value: number;
  description: string;
  index: number;
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const color = getRiskColor(value);

  useEffect(() => {
    setAnimatedValue(0);
    const timer = window.setTimeout(() => setAnimatedValue(value), index * 100);
    return () => window.clearTimeout(timer);
  }, [index, value]);

  return (
    <article className={`${CARD} min-h-[13rem] p-4 text-center lg:min-h-[14rem]`}>
      <p className="min-h-10 text-sm font-semibold leading-snug text-slate-900 dark:text-white">{label}</p>
      <div className="relative mx-auto mt-2 h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: animatedValue, fill: color }]} startAngle={220} endAngle={-40}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: 'rgba(100,116,139,0.16)' }}
              cornerRadius={8}
              animationBegin={index * 100}
              animationDuration={900}
              isAnimationActive
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</span>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[11rem] text-xs leading-relaxed text-slate-500 dark:text-slate-500">{description}</p>
    </article>
  );
}

function HabitRadarCard({
  currentInputs,
  simulatedInputs
}: {
  currentInputs: HealthInputs;
  simulatedInputs: HealthInputs | null;
}) {
  const currentData = buildHabitData(currentInputs);
  const simulatedData = simulatedInputs ? buildHabitData(simulatedInputs) : null;
  const chartData = currentData.map((point, index) => ({
    subject: point.subject,
    current: point.value,
    simulated: simulatedData?.[index]?.value
  }));

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Your habit fingerprint</h2>
      <div className="mt-3 h-56 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 18 }}>
            <PolarGrid stroke="rgba(100,116,139,0.22)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10 }} />
            <Radar dataKey="current" stroke="#00A389" fill="#00C9A7" fillOpacity={0.15} strokeWidth={2} />
            {simulatedData ? (
              <Radar dataKey="simulated" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} strokeWidth={2} />
            ) : null}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-[#00A389]" />
          You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-[#8B5CF6]" />
          Digital Twin
        </span>
      </div>
    </section>
  );
}

function MiniProjectionCard({
  data,
  yearsGap,
  onOpen
}: {
  data: ProjectionPoint[];
  yearsGap: number;
  onOpen: () => void;
}) {
  return (
    <section className={`${CARD} p-5`}>
      <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Your two futures</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Up to {formatYears(yearsGap)} difference by age 80.</p>
      <div className="relative mt-4 h-44 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="age" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis hide domain={[0, 100]} />
            <Line type="monotone" dataKey="current" stroke="#94A3B8" strokeWidth={2.2} dot={false} name="Current path" />
            <Line type="monotone" dataKey="optimized" stroke="#00A389" strokeWidth={3} dot={false} name="Optimized path" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-twin-dark/25 px-4 py-2 text-sm font-semibold text-twin-dark transition hover:bg-twin-dark/10 dark:border-twin/25 dark:text-twin dark:hover:bg-twin/10"
      >
        <Maximize2 className="h-4 w-4" />
        Explore timeline
      </button>
    </section>
  );
}

function TimelineModal({
  data,
  yearsGap,
  startAge,
  onClose
}: {
  data: ProjectionPoint[];
  yearsGap: number;
  startAge: number;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-y-auto bg-ivory/96 px-5 py-6 backdrop-blur-2xl dark:bg-navy-950/96"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mx-auto flex min-h-full max-w-5xl flex-col">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-twin-dark dark:text-twin">Full projection</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-slate-950 dark:text-white">Two futures. One body.</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-500 transition hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-white"
            aria-label="Close timeline"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className={`${CARD} flex-1 p-4 sm:p-6`}>
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white">Age {startAge} to age 80</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                The grey line keeps today&apos;s profile. The teal line reflects the best available habit path.
              </p>
            </div>
            <div className="rounded-2xl border border-twin-dark/20 bg-twin-dark/10 px-4 py-3 text-twin-dark dark:border-twin/20 dark:bg-twin/10 dark:text-twin">
              <p className="font-display text-3xl font-bold">{yearsGap}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                {yearsGap === 1 ? 'year difference' : 'years difference'}
              </p>
            </div>
          </div>

          <div className="h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: -10, right: 18, top: 18, bottom: 8 }}>
                <XAxis dataKey="age" tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<ProjectionTooltip />} />
                <Line type="monotone" dataKey="current" stroke="#94A3B8" strokeWidth={3} dot={false} name="Current path" />
                <Line type="monotone" dataKey="optimized" stroke="#00A389" strokeWidth={4} dot={{ r: 3 }} name="Optimized path" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function ProjectionTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm shadow-xl dark:border-white/10 dark:bg-navy-900">
      <p className="mb-1 font-medium text-slate-950 dark:text-white">Age {label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

function getHeroSubtitle(bioAge: number, realAge: number, healthScore: number): string {
  const delta = Math.round(Math.abs(bioAge - realAge));
  if (bioAge > realAge + 2)
    return `Your body is ${delta} year${delta !== 1 ? 's' : ''} older than you are. Every habit you change today turns that around.`;
  if (bioAge < realAge - 2)
    return `You're biologically ${delta} year${delta !== 1 ? 's' : ''} younger than your age. You're doing something right — let's protect it.`;
  if (healthScore >= 75)
    return `Your biological age matches your real age. Strong foundation — now let's push it further.`;
  return `Small daily changes compound into years of healthy life. Here's where to start.`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getTopPriorities(inputs: HealthInputs, risks: RiskScores): Priority[] {
  const priorities: Priority[] = [
    {
      score:
        risks.mentalResilience +
        (inputs.sleepHours < 7 ? 22 : 0) +
        (inputs.stressLevel > 3 ? (inputs.stressLevel - 3) * 12 : 0),
      heroSentence:
        inputs.sleepHours < 7 && inputs.stressLevel > 3
          ? 'Your stress and sleep patterns are ageing you faster than anything else.'
          : 'Your recovery pattern is the signal asking for attention first.',
      title:
        inputs.sleepHours < 7
          ? `Sleep — you are losing ${formatHours(Math.max(0, 8 - inputs.sleepHours))} every night`
          : 'Stress — your recovery system needs room',
      evidence: `You sleep ${inputs.sleepHours}h and report stress at ${inputs.stressLevel}/5. Better recovery would move both stress load and biological age.`
    },
    {
      score: risks.cardiovascular + (inputs.smokingStatus === 'current' ? 35 : inputs.smokingStatus === 'former' ? 12 : 0),
      heroSentence:
        inputs.smokingStatus === 'current'
          ? 'Smoking is putting more pressure on your future heart than anything else in the file.'
          : 'Your cardiovascular profile is the long-term signal to watch most closely.',
      title:
        inputs.smokingStatus === 'current'
          ? 'Smoking — remove the heaviest cardiovascular drag'
          : 'Cardio resilience — protect the engine',
      evidence: `Your cardiovascular risk is ${risks.cardiovascular}/100. Smoking status, movement, stress, and family history are shaping that number.`
    },
    {
      score: risks.metabolic + (inputs.exerciseDaysPerWeek < 3 ? 18 : 0) + (inputs.dietQuality < 4 ? 12 : 0),
      heroSentence: 'Your movement and food pattern are shaping the metabolic version of your future self.',
      title:
        inputs.exerciseDaysPerWeek < 3
          ? `Movement — add ${Math.max(1, 3 - inputs.exerciseDaysPerWeek)} focused days this week`
          : 'Food quality — make the plate work harder',
      evidence: `Your metabolic risk is ${risks.metabolic}/100 with ${inputs.exerciseDaysPerWeek} exercise days and diet quality ${inputs.dietQuality}/5.`
    },
    {
      score: 100 - risks.longevity + (inputs.alcoholDrinksPerWeek > 7 ? 14 : 0),
      heroSentence: 'Your longevity path is being narrowed by small repeated choices.',
      title:
        inputs.alcoholDrinksPerWeek > 7
          ? `Alcohol — bring ${inputs.alcoholDrinksPerWeek} drinks down`
          : 'Longevity — widen the path',
      evidence: `Your longevity score is ${risks.longevity}/100. Sleep, movement, alcohol, smoking, and family history combine into this drag.`
    }
  ];

  return priorities.sort((a, b) => b.score - a.score);
}

function buildHabitData(inputs: HealthInputs) {
  return [
    { subject: 'Sleep', value: Math.min(100, (inputs.sleepHours / 8) * 100) },
    { subject: 'Exercise', value: (inputs.exerciseDaysPerWeek / 7) * 100 },
    { subject: 'Diet', value: (inputs.dietQuality / 5) * 100 },
    { subject: 'Calm', value: ((6 - inputs.stressLevel) / 5) * 100 },
    { subject: 'Sobriety', value: Math.max(0, 100 - (inputs.alcoholDrinksPerWeek / 21) * 100) },
    {
      subject: 'Smoke-free',
      value: inputs.smokingStatus === 'never' ? 100 : inputs.smokingStatus === 'former' ? 65 : 0
    }
  ];
}

function buildProjectionData(
  inputs: HealthInputs,
  currentRisks: RiskScores,
  optimizedInputs: HealthInputs,
  optimizedRisks: RiskScores
): ProjectionPoint[] {
  const startAge = inputs.age;
  const endAge = Math.max(80, startAge + 10);
  const improvement = Math.max(0, currentRisks.overall - optimizedRisks.overall);
  const currentBase = healthScoreFromRisks(currentRisks);
  const optimizedBase = healthScoreFromRisks(optimizedRisks);
  const bioAgeGain = Math.max(0, computeBiologicalAge(inputs, currentRisks) - computeBiologicalAge(optimizedInputs, optimizedRisks));
  const points: ProjectionPoint[] = [];

  for (let age = startAge; age <= endAge; age += 5) {
    const yearsAhead = age - startAge;
    const currentScore = currentBase - yearsAhead * 0.82;
    const optimizedScore = optimizedBase - yearsAhead * (0.52 - Math.min(0.24, improvement / 250)) + bioAgeGain * 1.5;

    points.push({
      age,
      current: Math.max(0, Math.round(currentScore)),
      optimized: Math.max(0, Math.min(100, Math.round(optimizedScore)))
    });
  }

  if (points[points.length - 1]?.age !== endAge) {
    const yearsAhead = endAge - startAge;
    points.push({
      age: endAge,
      current: Math.max(0, Math.round(currentBase - yearsAhead * 0.82)),
      optimized: Math.max(
        0,
        Math.min(100, Math.round(optimizedBase - yearsAhead * (0.52 - Math.min(0.24, improvement / 250)) + bioAgeGain * 1.5))
      )
    });
  }

  return points;
}

function getOptimizedInputs(inputs: HealthInputs): HealthInputs {
  return {
    ...inputs,
    sleepHours: Math.max(inputs.sleepHours, 8),
    exerciseDaysPerWeek: Math.max(inputs.exerciseDaysPerWeek, 5),
    dietQuality: Math.max(inputs.dietQuality, 4),
    stressLevel: Math.min(inputs.stressLevel, 2),
    alcoholDrinksPerWeek: Math.min(inputs.alcoholDrinksPerWeek, 4),
    smokingStatus: inputs.smokingStatus === 'current' ? 'former' : inputs.smokingStatus
  };
}

function getProjectionYearsGap(data: ProjectionPoint[]) {
  const finalPoint = data[data.length - 1];
  if (!finalPoint) return 0;
  return Math.max(1, Math.round(Math.max(0, finalPoint.optimized - finalPoint.current) / 6));
}

function getRiskColor(value: number) {
  if (value < 30) return '#22C55E';
  if (value <= 60) return '#F59E0B';
  return '#EF4444';
}

function getScoreColor(value: number) {
  if (value > 65) return '#22C55E';
  if (value >= 40) return '#F59E0B';
  return '#EF4444';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatHours(value: number) {
  if (value === 0) return '0h';
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

function formatYears(value: number) {
  return `${value} ${value === 1 ? 'year' : 'years'}`;
}

function sameInputs(a: HealthInputs, b: HealthInputs) {
  return JSON.stringify(a) === JSON.stringify(b);
}
