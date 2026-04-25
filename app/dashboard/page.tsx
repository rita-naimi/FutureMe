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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import dynamic from 'next/dynamic';
import { PageTransition } from '@/components/PageTransition';
import type { HealthInputs, RiskScores } from '@/lib/fhir';
import type { PipelineResponse } from '@/lib/backend/types';

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
  year?: number;
  current: number;
  optimized: number;
};

type Trajectory = NonNullable<PipelineResponse['trajectory']>;
type BiomarkerMetric = keyof Trajectory['baseline'][number]['biomarkers'];

type DashboardTrendCard = {
  label: string;
  description: string;
  unit: string;
  data: ProjectionPoint[];
  currentName: string;
  optimizedName: string;
  betterWhenLower: boolean;
};

const CARD =
  'rounded-[1.65rem] border border-black/10 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20';

export default function DashboardPage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const pipelineAnalysis = useFutureMeStore((state) => state.pipelineAnalysis);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const dashboard = useMemo(() => {
    if (!profile) return null;

    const hasSimulation = Boolean(simulatedInputs && !sameInputs(profile.inputs, simulatedInputs));
    const activeInputs = hasSimulation && simulatedInputs ? simulatedInputs : profile.inputs;
    const activeRisks = computeRisks(activeInputs);
    const optimizedInputs = hasSimulation && simulatedInputs ? simulatedInputs : getOptimizedInputs(profile.inputs);
    const biologicalAge = computeBiologicalAge(activeInputs, activeRisks);
    const priorities = getTopPriorities(activeInputs, activeRisks);
    const trendCards = buildDashboardTrendCards({
      trajectory: pipelineAnalysis?.trajectory,
      activeInputs,
      optimizedInputs
    });
    const primaryTrendCard = trendCards[0];

    return {
      activeInputs,
      biologicalAge,
      currentInputs: profile.inputs,
      createdAt: profile.createdAt,
      hasSimulation,
      healthScore: healthScoreFromRisks(activeRisks),
      priority: priorities[0],
      primaryTrendCard,
      projectionModel: pipelineAnalysis?.trajectory?.model,
      trendCards
    };
  }, [pipelineAnalysis, profile, simulatedInputs]);

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
          <section className={`${CARD} relative flex items-center gap-6 overflow-hidden p-5 sm:p-6 lg:p-7`}>
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-twin-dark/10 dark:bg-twin/10 lg:-right-20 lg:-top-20 lg:h-72 lg:w-72" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 hidden h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin-dark/35 to-transparent dark:via-twin/40 lg:block" />

            <div className="relative flex min-w-0 flex-1 items-center gap-5">
              <div className="min-w-0 flex-1">
                <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-slate-950 dark:text-slate-100 lg:text-5xl">
                  {getGreeting()}, {dashboard.activeInputs.name}.
                  <span className="block">This is your body today.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  {getHeroSubtitle(dashboard.biologicalAge, dashboard.activeInputs.age, dashboard.healthScore)}
                </p>
              </div>

              <HealthScoreRing score={dashboard.healthScore} />
            </div>

            <div className="-my-5 h-auto w-36 flex-shrink-0 self-stretch overflow-hidden rounded-full sm:-my-6 lg:-my-7 lg:w-44">
              <TwinAvatarViewer
                inputs={dashboard.activeInputs}
                biologicalAge={dashboard.biologicalAge}
                healthScore={dashboard.healthScore}
                interactive={false}
                height="100%"
                minimal
                transparent
              />
            </div>
          </section>

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
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {dashboard.trendCards.map((card, index) => (
                  <MetricTrendCard key={card.label} card={card} index={index} />
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
                <HabitRadarCard
                  currentInputs={dashboard.currentInputs}
                  simulatedInputs={dashboard.hasSimulation ? dashboard.activeInputs : null}
                />
                <MiniProjectionCard
                  card={dashboard.primaryTrendCard}
                  model={dashboard.projectionModel}
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
            card={dashboard.primaryTrendCard}
            model={dashboard.projectionModel}
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
  const offset = useTransform(progress, (v) => circumference * (1 - v / 100));
  const color = getScoreColor(score);

  useEffect(() => {
    const controls = animate(progress, score, { duration: 1.4, ease: 'easeOut' });
    return controls.stop;
  }, [progress, score]);

  return (
    <div className="relative h-32 w-32 flex-shrink-0 lg:h-40 lg:w-40">
      <svg className="-rotate-90 h-full w-full" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(100,116,139,0.18)" strokeWidth="10" />
        <motion.circle cx="64" cy="64" r="54" fill="none" stroke={color} strokeLinecap="round" strokeWidth="10" strokeDasharray={circumference} style={{ strokeDashoffset: offset }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="font-display text-4xl font-bold tabular-nums text-slate-950 dark:text-white lg:text-5xl">{rounded}</motion.span>
        <span className="text-xs font-medium text-slate-500">Health score</span>
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
        className={`mx-auto mt-5 inline-flex max-w-full items-center rounded-full border px-4 py-2 text-sm font-semibold ${
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

function MetricTrendCard({ card, index }: { card: DashboardTrendCard; index: number }) {
  const first = card.data[0];
  const last = card.data[card.data.length - 1];
  const delta = last ? last.optimized - last.current : 0;
  const improved = card.betterWhenLower ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.05;
  const xKey = card.data.some((point) => point.year !== undefined) ? 'year' : 'age';
  const domain = getTrendDomain(card.data);

  return (
    <article className={`${CARD} flex min-h-[14.5rem] flex-col p-4 sm:p-5`}>
      <div className="flex min-h-[4.6rem] items-start justify-between gap-3">
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
          {neutral ? '0' : `${delta > 0 ? '+' : ''}${formatTrendValue(delta)}`}
        </div>
      </div>

      <div className="mt-3 h-24 lg:h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
            <XAxis dataKey={xKey} hide />
            <YAxis hide domain={domain} />
            <Tooltip content={<MetricTrendTooltip unit={card.unit} xLabel={xKey === 'year' ? 'Year' : 'Age'} />} />
            <Line
              type="monotone"
              dataKey="current"
              stroke="#94A3B8"
              strokeWidth={2.4}
              dot={false}
              name={card.currentName}
              animationBegin={index * 90}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="optimized"
              stroke="#00A389"
              strokeWidth={2.8}
              dot={false}
              name={card.optimizedName}
              animationBegin={index * 90 + 120}
              animationDuration={850}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3 text-xs">
        <div>
          <p className="font-medium text-slate-400 dark:text-slate-500">{first?.year ?? first?.age} start</p>
          <p className="font-mono text-slate-700 dark:text-slate-300">
            {formatTrendValue(first?.current ?? 0)}
            <span className="ml-1 text-slate-400">{card.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-400 dark:text-slate-500">{last?.year ?? last?.age} projected</p>
          <p className="font-mono text-twin-dark dark:text-twin">
            {formatTrendValue(last?.optimized ?? 0)}
            <span className="ml-1 text-slate-400">{card.unit}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function MetricTrendTooltip({
  active,
  payload,
  label,
  unit,
  xLabel
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; name: string }>;
  label?: number;
  unit: string;
  xLabel: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm shadow-xl dark:border-white/10 dark:bg-navy-900">
      <p className="mb-1 font-medium text-slate-950 dark:text-white">
        {xLabel} {label}
      </p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatTrendValue(item.value)} {unit}
        </p>
      ))}
    </div>
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
            {simulatedData ? (
              <Radar dataKey="simulated" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} strokeWidth={2} />
            ) : null}
            <Radar dataKey="current" stroke="#00A389" fill="#00C9A7" fillOpacity={0.15} strokeWidth={2} />
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
  card,
  model,
  onOpen
}: {
  card: DashboardTrendCard;
  model?: string;
  onOpen: () => void;
}) {
  const xKey = card.data.some((point) => point.year !== undefined) ? 'year' : 'age';
  const domain = getTrendDomain(card.data);
  const summary = getTrendSummary(card);

  return (
    <section className={`${CARD} p-5`}>
      <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{card.label} trajectory</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
        {summary}
        {model ? ` · ${formatModelName(model)}` : ''}
      </p>
      <div className="relative mt-4 h-44 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={card.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey={xKey} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis hide domain={domain} />
            <Tooltip content={<MetricTrendTooltip unit={card.unit} xLabel={xKey === 'year' ? 'Year' : 'Age'} />} />
            <Line type="monotone" dataKey="current" stroke="#94A3B8" strokeWidth={2.2} dot={false} name={card.currentName} />
            <Line type="monotone" dataKey="optimized" stroke="#00A389" strokeWidth={3} dot={false} name={card.optimizedName} />
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
  card,
  model,
  onClose
}: {
  card: DashboardTrendCard;
  model?: string;
  onClose: () => void;
}) {
  const xKey = card.data.some((point) => point.year !== undefined) ? 'year' : 'age';
  const domain = getTrendDomain(card.data);
  const summary = getTrendSummary(card);

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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-twin-dark dark:text-twin">Full biomarker projection</p>
            <h2 className="mt-2 font-display text-4xl font-bold text-slate-950 dark:text-white">{card.label} trajectory</h2>
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
              <p className="text-sm font-medium text-slate-950 dark:text-white">
                {xKey === 'year'
                  ? `${card.data[0]?.year ?? 2026} to ${card.data[card.data.length - 1]?.year ?? 2046}`
                  : `Age ${card.data[0]?.age ?? 0} to age ${card.data[card.data.length - 1]?.age ?? 0}`}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                Grey is the baseline biomarker path. Teal applies the biomarker-level intervention effects before any risk is recomputed.
                {model ? ` Model: ${formatModelName(model)}.` : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-twin-dark/20 bg-twin-dark/10 px-4 py-3 text-twin-dark dark:border-twin/20 dark:bg-twin/10 dark:text-twin">
              <p className="font-display text-2xl font-bold">{summary.split(' by ')[0]}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">biomarker delta</p>
            </div>
          </div>

          <div className="h-[26rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={card.data} margin={{ left: -10, right: 18, top: 18, bottom: 8 }}>
                <XAxis dataKey={xKey} tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={domain} tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<MetricTrendTooltip unit={card.unit} xLabel={xKey === 'year' ? 'Year' : 'Age'} />} />
                <Line type="monotone" dataKey="current" stroke="#94A3B8" strokeWidth={3} dot={false} name={card.currentName} />
                <Line type="monotone" dataKey="optimized" stroke="#00A389" strokeWidth={4} dot={{ r: 3 }} name={card.optimizedName} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function getHeroSubtitle(bioAge: number, realAge: number, healthScore: number): string {
  const delta = Math.round(Math.abs(bioAge - realAge));
  if (bioAge > realAge + 2)
    return `Your body is already ${delta} year${delta !== 1 ? 's' : ''} older than you are. You can reverse that — and this is where it starts.`;
  if (bioAge < realAge - 2)
    return `You've gained ${delta} biological year${delta !== 1 ? 's' : ''} on your age. Now let's see how far you can push that lead.`;
  if (healthScore >= 75)
    return `Your body is in balance. Change one habit today and watch your future self shift in real time.`;
  return `Your future health is being written right now. Start one change — and see your twin respond.`;
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

function buildDashboardTrendCards({
  trajectory,
  activeInputs,
  optimizedInputs
}: {
  trajectory?: PipelineResponse['trajectory'];
  activeInputs: HealthInputs;
  optimizedInputs: HealthInputs;
}): DashboardTrendCard[] {
  if (trajectory?.baseline.length) {
    const structuredExercise = getTrajectoryIntervention(trajectory, 'structured_exercise');
    const stressReduction = getTrajectoryIntervention(trajectory, 'stress_reduction');

    return [
      {
        label: 'Systolic BP',
        description: 'Baseline vs stress reduction',
        unit: 'mmHg',
        data: buildBiomarkerTrend(trajectory.baseline, stressReduction?.curve, 'systolicBloodPressure'),
        currentName: 'Baseline',
        optimizedName: 'Stress reduction',
        betterWhenLower: true
      },
      {
        label: 'BMI',
        description: 'BMI baseline vs exercise',
        unit: 'BMI',
        data: buildBiomarkerTrend(trajectory.baseline, structuredExercise?.curve, 'bmi'),
        currentName: 'Baseline',
        optimizedName: 'Exercise',
        betterWhenLower: true
      },
      {
        label: 'Total cholesterol',
        description: 'Baseline vs structured exercise',
        unit: 'mg/dL',
        data: buildBiomarkerTrend(trajectory.baseline, structuredExercise?.curve, 'totalCholesterol'),
        currentName: 'Baseline',
        optimizedName: 'Exercise',
        betterWhenLower: true
      },
      {
        label: 'HDL cholesterol',
        description: 'Baseline vs structured exercise',
        unit: 'mg/dL',
        data: buildBiomarkerTrend(trajectory.baseline, structuredExercise?.curve, 'hdlCholesterol'),
        currentName: 'Baseline',
        optimizedName: 'Exercise',
        betterWhenLower: false
      }
    ];
  }

  return buildFallbackBiomarkerTrendCards(activeInputs, optimizedInputs);
}

function buildBiomarkerTrend(
  baseline: Trajectory['baseline'],
  intervention: Trajectory['baseline'] | undefined,
  metric: BiomarkerMetric
): ProjectionPoint[] {
  return baseline.map((point, index) => ({
    age: point.age,
    year: point.year,
    current: round1(Number(point.biomarkers[metric])),
    optimized: round1(Number(intervention?.[index]?.biomarkers[metric] ?? point.biomarkers[metric]))
  }));
}

function buildFallbackBiomarkerTrendCards(activeInputs: HealthInputs, optimizedInputs: HealthInputs): DashboardTrendCard[] {
  const current = estimateDashboardBiomarkers(activeInputs);
  const optimized = estimateDashboardBiomarkers(optimizedInputs);
  const exerciseBmiDelta = optimizedInputs.exerciseDaysPerWeek > activeInputs.exerciseDaysPerWeek ? -0.68 : 0;

  return [
    buildEstimatedBiomarkerCard({
      label: 'Systolic BP',
      description: 'Estimated baseline vs recovery habits',
      unit: 'mmHg',
      startAge: activeInputs.age,
      currentStart: current.systolicBloodPressure,
      optimizedTarget: optimized.systolicBloodPressure,
      currentDrift: 8,
      optimizedDrift: 3,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'BMI',
      description: 'Estimated baseline vs exercise',
      unit: 'BMI',
      startAge: activeInputs.age,
      currentStart: current.bmi,
      optimizedTarget: Math.max(18, current.bmi + exerciseBmiDelta),
      currentDrift: 1.2,
      optimizedDrift: -0.4,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'Total cholesterol',
      description: 'Estimated baseline vs exercise',
      unit: 'mg/dL',
      startAge: activeInputs.age,
      currentStart: current.totalCholesterol,
      optimizedTarget: optimized.totalCholesterol,
      currentDrift: 10,
      optimizedDrift: 4,
      betterWhenLower: true
    }),
    buildEstimatedBiomarkerCard({
      label: 'HDL cholesterol',
      description: 'Estimated baseline vs exercise',
      unit: 'mg/dL',
      startAge: activeInputs.age,
      currentStart: current.hdlCholesterol,
      optimizedTarget: optimized.hdlCholesterol,
      currentDrift: -2.5,
      optimizedDrift: 1.2,
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
  optimizedTarget,
  currentDrift,
  optimizedDrift,
  betterWhenLower
}: {
  label: string;
  description: string;
  unit: string;
  startAge: number;
  currentStart: number;
  optimizedTarget: number;
  currentDrift: number;
  optimizedDrift: number;
  betterWhenLower: boolean;
}): DashboardTrendCard {
  const endAge = Math.max(80, startAge + 10);
  const data: ProjectionPoint[] = [];

  for (let age = startAge; age <= endAge; age += 5) {
    const progress = (age - startAge) / Math.max(1, endAge - startAge);
    const interventionProgress = progress * progress * (3 - 2 * progress);
    data.push({
      age,
      current: round1(Math.max(0, currentStart + currentDrift * progress)),
      optimized: round1(Math.max(0, currentStart + (optimizedTarget - currentStart) * interventionProgress + optimizedDrift * progress))
    });
  }

  return {
    label,
    description,
    unit,
    data,
    currentName: 'Baseline',
    optimizedName: 'Intervention',
    betterWhenLower
  };
}

function estimateDashboardBiomarkers(inputs: HealthInputs) {
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

function getTrajectoryIntervention(trajectory: Trajectory, scenarioId: Trajectory['interventions'][number]['scenarioId']) {
  return trajectory.interventions.find((intervention) => intervention.scenarioId === scenarioId);
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

function formatModelName(model: string) {
  if (model === 'synthea_gradient_boosting_v1') return 'Synthea GBM';
  if (model === 'synthea_proxy_transition_v0') return 'Synthea proxy';
  return model;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTrendValue(value: number) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Math.abs(value) >= 100) return Math.round(value).toString();
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2).replace(/\.00$/, '');
}

function getTrendSummary(card: DashboardTrendCard) {
  const finalPoint = card.data[card.data.length - 1];
  if (!finalPoint) return `No ${card.label.toLowerCase()} trajectory available`;

  const delta = finalPoint.optimized - finalPoint.current;
  const xLabel = finalPoint.year ?? finalPoint.age;
  if (Math.abs(delta) < 0.05) return `No material ${card.label.toLowerCase()} change by ${xLabel}`;

  const signed = `${delta > 0 ? '+' : '-'}${formatTrendValue(Math.abs(delta))}`;
  return `${signed} ${card.unit} by ${xLabel}`;
}

function getTrendDomain(data: ProjectionPoint[]): [number, number] {
  const values = data.flatMap((point) => [point.current, point.optimized]).filter((value) => Number.isFinite(value));
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(0.5, max - min);
  const padding = spread * 0.18;
  return [round1(Math.max(0, min - padding)), round1(max + padding)];
}

function sameInputs(a: HealthInputs, b: HealthInputs) {
  return JSON.stringify(a) === JSON.stringify(b);
}
