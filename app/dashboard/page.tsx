'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileJson, MessageCircle } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer
} from 'recharts';
import dynamic from 'next/dynamic';
import { DailyGoalCard } from '@/components/dashboard/DailyGoalCard';
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

const CARD =
  'rounded-[1.65rem] border border-black/10 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80 dark:shadow-black/20';

export default function DashboardPage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);

  const dashboard = useMemo(() => {
    if (!profile) return null;

    const hasSimulation = Boolean(simulatedInputs && !sameInputs(profile.inputs, simulatedInputs));
    const activeInputs = hasSimulation && simulatedInputs ? simulatedInputs : profile.inputs;
    const activeRisks = computeRisks(activeInputs);
    const biologicalAge = computeBiologicalAge(activeInputs, activeRisks);
    const priorities = getTopPriorities(activeInputs, activeRisks);

    return {
      activeInputs,
      activeRisks,
      biologicalAge,
      currentInputs: profile.inputs,
      createdAt: profile.createdAt,
      hasSimulation,
      healthScore: healthScoreFromRisks(activeRisks),
      priority: priorities[0]
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

          <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
            <div className="xl:col-span-4">
              <BiologicalAgeHero
                realAge={dashboard.activeInputs.age}
                biologicalAge={dashboard.biologicalAge}
                dateLabel={formatDate(dashboard.createdAt)}
              />
            </div>

            <div className="grid gap-5 xl:col-span-8 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
              <section className="grid grid-cols-2 gap-3">
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

              <HabitRadarCard
                currentInputs={dashboard.currentInputs}
                simulatedInputs={dashboard.hasSimulation ? dashboard.activeInputs : null}
              />
            </div>

            <div className="grid gap-4 xl:col-span-12 xl:grid-cols-12">
              <div className="h-full xl:col-span-3">
                <LeverageChangeCard priority={dashboard.priority} />
              </div>
              <div className="h-full xl:col-span-3">
                <DailyGoalCard className="h-full min-h-[14.5rem]" recommendedHabitKey={getRecommendedHabitKey(dashboard.priority.title)} />
              </div>
              <div className="h-full xl:col-span-6">
                <DigitalTwinChatCard />
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </main>
  );
}

function LeverageChangeCard({ priority }: { priority: Priority }) {
  return (
    <section className={`${CARD} flex h-full min-h-[14.5rem] flex-col border-l-[4px] border-l-twin-dark p-3.5 dark:border-l-twin`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-twin-dark dark:text-twin">
        Highest leverage
      </p>
      <h2 className="mt-2 font-display text-xl font-bold leading-tight text-slate-950 dark:text-white">
        {priority.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {priority.evidence}
      </p>
      <Link
        href="/simulate"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-twin-dark px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
      >
        Simulate this change
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
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
    <section className={`${CARD} flex h-full min-h-[13.5rem] flex-col justify-center p-6 text-center sm:p-7`}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
        Biological age
      </p>
      <motion.span className="mt-2 block font-display text-7xl font-bold leading-none tabular-nums text-slate-950 dark:text-white xl:text-8xl">
        {rounded}
      </motion.span>
      <div
        className={`mt-5 inline-flex max-w-full items-center justify-center self-center rounded-full border px-4 py-2 text-center text-sm font-semibold ${
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
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-600">Based on your FHIR R4 profile · {dateLabel}</p>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
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
    <article className={`${CARD} flex min-h-[8.25rem] items-center gap-3 p-3`}>
      <div className="relative h-16 w-16 flex-shrink-0">
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
          <span className="font-display text-xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</span>
        </div>
      </div>
      <div className="min-w-0 text-left">
        <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{label}</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-500">{description}</p>
      </div>
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
    <section className={`${CARD} flex h-full min-h-[15.5rem] flex-col p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-twin-dark dark:text-twin">Pattern</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Your habit fingerprint</h2>
        </div>
        <div className="rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
          Live profile
        </div>
      </div>

      <div className="relative mt-1.5 flex min-h-[9.75rem] flex-1 items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
            <PolarGrid stroke="rgba(100,116,139,0.18)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 9, fontWeight: 600 }} />
            <Radar dataKey="current" stroke="#00A389" fill="#00C9A7" fillOpacity={0.1} strokeWidth={1.5} />
            {simulatedData ? (
              <Radar dataKey="simulated" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.07} strokeWidth={1.5} />
            ) : null}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-3 border-t border-black/10 pt-2.5 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3.5 rounded-full bg-[#00A389]" />
          You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3.5 rounded-full bg-[#8B5CF6]" />
          Digital Twin
        </span>
      </div>
    </section>
  );
}

function DigitalTwinChatCard() {
  return (
    <section className={`${CARD} relative flex h-full min-h-[14.5rem] flex-col justify-between overflow-hidden p-4 sm:p-5`}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-twin-dark/10 dark:bg-twin/10" />
      <div className="relative grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-twin-dark/25 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-twin-dark dark:text-twin">Digital twin</p>
          <h2 className="mt-1.5 whitespace-nowrap font-display text-2xl font-bold leading-tight text-slate-950 dark:text-white">
            Talk through your next move.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Ask your twin what these habits mean, what to change first, or how today&apos;s choices affect your future.
          </p>
        </div>
      </div>

      <Link
        href="/twin"
        className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-twin-dark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark sm:w-auto sm:self-start"
      >
        Open chatbot
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
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

function getRecommendedHabitKey(priorityTitle: string) {
  const normalized = priorityTitle.toLowerCase();
  if (normalized.includes('sleep')) return 'sleep';
  if (normalized.includes('stress')) return 'stress';
  if (normalized.includes('alcohol')) return 'alcohol';
  if (normalized.includes('food')) return 'diet';
  if (normalized.includes('movement') || normalized.includes('cardio') || normalized.includes('smoking')) return 'exercise';
  return 'sleep';
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

function sameInputs(a: HealthInputs, b: HealthInputs) {
  return JSON.stringify(a) === JSON.stringify(b);
}
