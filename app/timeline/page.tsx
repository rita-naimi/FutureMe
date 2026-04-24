'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GitBranch } from 'lucide-react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DemoQueryLoader } from '@/components/DemoSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { computeRisks } from '@/lib/risks';
import { useFutureMeStore } from '@/lib/store';

export default function TimelinePage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const [focusAge, setFocusAge] = useState(34);

  useEffect(() => {
    if (profile) setFocusAge(profile.inputs.age);
  }, [profile]);

  const timelineData = useMemo(() => {
    if (!profile) return [];
    const startAge = profile.inputs.age;
    const data = [];
    const simulatedRisks = simulatedInputs ? computeRisks(simulatedInputs) : profile.risks;
    const improvement = Math.max(0, profile.risks.overall - simulatedRisks.overall);

    for (let age = startAge; age <= 85; age += 5) {
      const yearsAhead = age - startAge;
      const currentDegradation = yearsAhead * 0.82;
      const optimizedDegradation = yearsAhead * (0.55 - Math.min(0.22, improvement / 260));
      const currentScore = 100 - profile.risks.overall - currentDegradation;
      const optimizedScore = 100 - simulatedRisks.overall - optimizedDegradation;

      data.push({
        age,
        current: Math.max(0, Math.round(currentScore)),
        optimized: Math.max(0, Math.round(optimizedScore))
      });
    }
    return data;
  }, [profile, simulatedInputs]);

  const focusPoint = useMemo(() => {
    if (!timelineData.length) return null;
    return timelineData.reduce((closest, point) =>
      Math.abs(point.age - focusAge) < Math.abs(closest.age - focusAge) ? point : closest
    );
  }, [focusAge, timelineData]);

  if (!profile) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-8">
        <Suspense fallback={null}>
          <DemoQueryLoader />
        </Suspense>
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <GitBranch className="mb-5 h-10 w-10 text-twin" />
          <h1 className="text-3xl font-bold text-white">No timeline yet</h1>
          <p className="mt-3 text-slate-400">Create a profile or load demo data before projecting future paths.</p>
          <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950">
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-6">
      <Suspense fallback={null}>
        <DemoQueryLoader />
      </Suspense>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <header className="mb-7">
            <p className="text-sm font-medium text-twin">Twin visualization</p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Two futures. One choice.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              The grey path keeps today's profile. The teal path reflects the current simulated habit settings.
            </p>
          </header>

          <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Age {profile.inputs.age}</span>
              <span className="font-mono text-twin">Focus age {focusAge}</span>
              <span className="text-slate-500">85</span>
            </div>
            <input
              type="range"
              min={profile.inputs.age}
              max={85}
              value={focusAge}
              onChange={(event) => setFocusAge(Number(event.target.value))}
              className="w-full accent-twin"
            />
          </section>

          <section className="glass-panel rounded-2xl p-4 sm:p-6">
            <div className="h-[22rem]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ left: -12, right: 12, top: 12, bottom: 4 }}>
                  <XAxis
                    dataKey="age"
                    stroke="#1A3055"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#1A3055"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={focusAge} stroke="#00C9A7" strokeDasharray="4 4" opacity={0.55} />
                  <Line type="monotone" dataKey="current" stroke="#64748B" strokeWidth={2.5} dot={false} name="Current path" />
                  <Line type="monotone" dataKey="optimized" stroke="#00C9A7" strokeWidth={3} dot={{ r: 3 }} name="Optimized path" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <span className="text-slate-500">Current path</span>
              <span className="text-twin">Optimized path</span>
            </div>
          </section>

          {focusPoint ? (
            <section className="mt-5 grid gap-4 sm:grid-cols-2">
              <ScoreCard label="Current path" age={focusAge} value={focusPoint.current} />
              <ScoreCard label="Optimized path" age={focusAge} value={focusPoint.optimized} highlighted />
            </section>
          ) : null}
        </div>
      </PageTransition>
    </main>
  );
}

function ScoreCard({ label, age, value, highlighted = false }: { label: string; age: number; value: number; highlighted?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 ${highlighted ? 'border-twin/25 bg-twin/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <p className="text-xs text-slate-500">
        {label} at age {age}
      </p>
      <p className={`mt-2 text-5xl font-bold ${highlighted ? 'text-twin' : 'text-white'}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-600">health score</p>
    </article>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-navy-900 p-3 text-sm shadow-xl">
      <p className="mb-1 font-medium text-white">Age {label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}
