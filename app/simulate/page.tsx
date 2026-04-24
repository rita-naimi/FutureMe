'use client';

import { Suspense, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DemoQueryLoader } from '@/components/DemoSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { computeBiologicalAge, computeRisks } from '@/lib/risks';
import { useFutureMeStore } from '@/lib/store';
import type { HealthInputs } from '@/lib/fhir';

const SLIDERS: {
  key: keyof Pick<
    HealthInputs,
    'sleepHours' | 'exerciseDaysPerWeek' | 'dietQuality' | 'stressLevel' | 'alcoholDrinksPerWeek'
  >;
  label: string;
  min: number;
  max: number;
  unit: string;
  step: number;
  higherIsBetter: boolean;
}[] = [
  { key: 'sleepHours', label: 'Sleep', min: 4, max: 10, unit: 'h/night', step: 0.5, higherIsBetter: true },
  { key: 'exerciseDaysPerWeek', label: 'Exercise', min: 0, max: 7, unit: 'days/week', step: 1, higherIsBetter: true },
  { key: 'dietQuality', label: 'Diet quality', min: 1, max: 5, unit: '/5', step: 1, higherIsBetter: true },
  { key: 'stressLevel', label: 'Stress level', min: 1, max: 5, unit: '/5', step: 1, higherIsBetter: false },
  { key: 'alcoholDrinksPerWeek', label: 'Alcohol', min: 0, max: 21, unit: 'drinks/wk', step: 1, higherIsBetter: false }
];

export default function SimulatePage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const setSimulatedInputs = useFutureMeStore((state) => state.setSimulatedInputs);
  const addMessage = useFutureMeStore((state) => state.addMessage);
  const sentFeedback = useRef(false);

  const currentRisks = useMemo(() => (profile ? computeRisks(profile.inputs) : null), [profile]);
  const simulatedRisks = useMemo(() => (simulatedInputs ? computeRisks(simulatedInputs) : null), [simulatedInputs]);
  const currentBioAge = useMemo(() => (profile ? computeBiologicalAge(profile.inputs, currentRisks ?? undefined) : null), [currentRisks, profile]);
  const simulatedBioAge = useMemo(
    () => (simulatedInputs && simulatedRisks ? computeBiologicalAge(simulatedInputs, simulatedRisks) : null),
    [simulatedInputs, simulatedRisks]
  );

  const handleChange = useCallback(
    (key: keyof HealthInputs, value: number | HealthInputs['smokingStatus']) => {
      if (!simulatedInputs || !profile) return;
      const nextInputs = { ...simulatedInputs, [key]: value };
      setSimulatedInputs(nextInputs);

      const nextRisks = computeRisks(nextInputs);
      const nextBioAge = computeBiologicalAge(nextInputs, nextRisks);
      const baselineBioAge = computeBiologicalAge(profile.inputs, profile.risks);
      if (!sentFeedback.current && baselineBioAge - nextBioAge >= 2) {
        sentFeedback.current = true;
        addMessage({
          role: 'assistant',
          content:
            "That changes things. I can feel the future opening up around that decision. The biggest shift is biological age: you just moved the projection in the right direction."
        });
      }
    },
    [addMessage, profile, setSimulatedInputs, simulatedInputs]
  );

  if (!profile || !simulatedInputs || !currentRisks || !simulatedRisks || currentBioAge === null || simulatedBioAge === null) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-8">
        <Suspense fallback={null}>
          <DemoQueryLoader />
        </Suspense>
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <SlidersHorizontal className="mb-5 h-10 w-10 text-twin" />
          <h1 className="text-3xl font-bold text-white">No simulation yet</h1>
          <p className="mt-3 text-slate-400">Create a profile or load demo data before changing future habits.</p>
          <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950">
            Start onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  const bioAgeDelta = currentBioAge - simulatedBioAge;

  return (
    <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-6">
      <Suspense fallback={null}>
        <DemoQueryLoader />
      </Suspense>
      <PageTransition>
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-twin">Simulation lab</p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Change habits. Watch the future move.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Sliders recalculate risk and biological age locally, then persist across the dashboard, chat, and timeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSimulatedInputs(profile.inputs)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-twin/35 hover:text-twin"
            >
              <RotateCcw className="h-4 w-4" />
              Reset baseline
            </button>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="space-y-6">
                {SLIDERS.map(({ key, label, min, max, unit, step }) => {
                  const value = simulatedInputs[key];
                  const original = profile.inputs[key];
                  const changed = value !== original;
                  return (
                    <div key={key}>
                      <div className="mb-2 flex items-baseline justify-between gap-4">
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className={`font-mono text-sm ${changed ? 'text-twin' : 'text-slate-400'}`}>
                          {value}
                          <span className="ml-1 text-xs text-slate-600">{unit}</span>
                          {changed ? <span className="ml-2 text-xs text-slate-600">was {original}</span> : null}
                        </p>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) => handleChange(key, Number(event.target.value))}
                        className="w-full accent-twin"
                      />
                    </div>
                  );
                })}

                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <p className="text-sm font-medium text-white">Smoking</p>
                    <p className="text-sm text-slate-500">current: {profile.inputs.smokingStatus}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['never', 'former', 'current'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleChange('smokingStatus', status)}
                        className={`rounded-full border px-3 py-2 text-xs font-medium capitalize transition ${
                          simulatedInputs.smokingStatus === status
                            ? 'border-twin bg-twin text-navy-950'
                            : 'border-white/15 text-slate-400 hover:border-twin/35 hover:text-twin'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div
                className={`rounded-2xl border p-6 text-center ${
                  bioAgeDelta >= 0 ? 'border-twin/25 bg-twin/10' : 'border-red-400/25 bg-red-500/10'
                }`}
              >
                <p className="text-sm text-slate-400">Biological age impact</p>
                <p className={`mt-2 text-6xl font-bold ${bioAgeDelta >= 0 ? 'text-twin' : 'text-red-300'}`}>
                  {bioAgeDelta >= 0 ? '-' : '+'}
                  {Math.abs(bioAgeDelta)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {bioAgeDelta >= 0
                    ? `Projected age ${simulatedBioAge} instead of ${currentBioAge}`
                    : `These settings add ${Math.abs(bioAgeDelta)} biological years`}
                </p>
              </div>

              {[
                ['Cardiovascular', currentRisks.cardiovascular, simulatedRisks.cardiovascular],
                ['Metabolic', currentRisks.metabolic, simulatedRisks.metabolic],
                ['Stress load', currentRisks.mentalResilience, simulatedRisks.mentalResilience],
                ['Longevity drag', 100 - currentRisks.longevity, 100 - simulatedRisks.longevity]
              ].map(([label, current, simulated]) => {
                const currentValue = Number(current);
                const simulatedValue = Number(simulated);
                const delta = currentValue - simulatedValue;
                return (
                  <article key={label} className="glass-panel rounded-2xl p-4">
                    <div className="mb-2 flex justify-between">
                      <p className="text-sm text-slate-400">{label}</p>
                      {delta !== 0 ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${delta > 0 ? 'text-twin' : 'text-red-300'}`}>
                          {delta > 0 ? <ArrowDown className="h-3 w-3" /> : null}
                          {delta > 0 ? `${delta} pts better` : `${Math.abs(delta)} pts worse`}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-slate-600" style={{ width: `${currentValue}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-slate-500">{currentValue}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-twin transition-all" style={{ width: `${simulatedValue}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-twin">{simulatedValue}</span>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        </div>
      </PageTransition>
    </main>
  );
}
