'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, FileJson, MessageCircle } from 'lucide-react';
import { BiologicalAgeCard } from '@/components/dashboard/BiologicalAgeCard';
import { RiskGauge } from '@/components/dashboard/RiskGauge';
import { HabitRadar } from '@/components/dashboard/HabitRadar';
import { HealthScoreGrid } from '@/components/dashboard/HealthScoreGrid';
import { DemoQueryLoader, DemoSwitcher } from '@/components/DemoSwitcher';
import { PageTransition } from '@/components/PageTransition';
import { ShareCard } from '@/components/ShareCard';
import { createTwinProfile } from '@/lib/profile';
import { computeBiologicalAge, computeRisks } from '@/lib/risks';
import { useFutureMeStore } from '@/lib/store';

export default function DashboardPage() {
  const profile = useFutureMeStore((state) => state.profile);
  const simulatedInputs = useFutureMeStore((state) => state.simulatedInputs);
  const loadDemoPersona = useFutureMeStore((state) => state.loadDemoPersona);

  const display = useMemo(() => {
    if (!profile) return null;
    const inputs = simulatedInputs ?? profile.inputs;
    const risks = computeRisks(inputs);
    const biologicalAge = computeBiologicalAge(inputs, risks);
    return {
      inputs,
      risks,
      biologicalAge,
      profile: createTwinProfile(inputs, profile.fhirSource)
    };
  }, [profile, simulatedInputs]);

  if (!profile || !display) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-8">
        <Suspense fallback={null}>
          <DemoQueryLoader />
        </Suspense>
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-twin/30 bg-twin/10">
            <FileJson className="h-6 w-6 text-twin" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create a profile first</h1>
          <p className="mt-3 text-slate-400">FutureMe needs questionnaire or Synthea demo data before it can project a health twin.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950"
            >
              Start onboarding
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => loadDemoPersona('alex')}
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-200"
            >
              Load Alex demo
            </button>
          </div>
        </div>
      </main>
    );
  }

  const hasSimulation = simulatedInputs && JSON.stringify(profile.inputs) !== JSON.stringify(simulatedInputs);
  const sourceLabel =
    profile.fhirSource === 'synthea-generated'
      ? 'Synthea-generated FHIR profile'
      : profile.fhirSource === 'wearable-import'
        ? 'FHIR plus wearable import'
        : 'FHIR R4 questionnaire profile';

  return (
    <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-6">
      <Suspense fallback={null}>
        <DemoQueryLoader />
      </Suspense>
      <PageTransition>
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-twin">This is you today</p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{display.inputs.name}'s health snapshot</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Profile stored as HL7 FHIR R4 Patient plus LOINC-coded Observations. The scores are deterministic demo heuristics, not a diagnosis.
              </p>
            </div>
            <Link
              href="/twin"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-twin/35 px-4 py-2 text-sm font-semibold text-twin transition hover:bg-twin/10"
            >
              <MessageCircle className="h-4 w-4" />
              Talk to future self
            </Link>
          </header>

          <DemoSwitcher />

          {hasSimulation ? (
            <div className="rounded-2xl border border-twin/25 bg-twin/10 p-4">
              <p className="text-sm font-medium text-twin">Live feedback loop active</p>
              <p className="mt-1 text-sm text-slate-400">
                This dashboard is showing your simulated habit changes. The original FHIR baseline is still preserved in the store.
              </p>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <BiologicalAgeCard
              realAge={display.inputs.age}
              biologicalAge={display.biologicalAge}
              source={sourceLabel}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <RiskGauge label="Cardiovascular risk" value={display.risks.cardiovascular} description="Heart, vascular, smoking, family history" />
              <RiskGauge label="Metabolic risk" value={display.risks.metabolic} description="BMI, diet, movement, diabetes history" />
              <RiskGauge label="Stress load" value={display.risks.mentalResilience} description="Sleep, stress, recovery capacity" />
              <RiskGauge label="Longevity drag" value={100 - display.risks.longevity} description="Penalty against the long-term trajectory" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <HabitRadar inputs={profile.inputs} simulatedInputs={simulatedInputs} />
            <div className="space-y-6">
              <HealthScoreGrid inputs={display.inputs} risks={display.risks} />
              <section className="glass-panel rounded-2xl p-5">
                <p className="text-sm font-medium text-white">Key insight</p>
                <p className="mt-3 text-lg leading-relaxed text-twin">{display.profile.keyInsight}</p>
                <p className="mt-4 text-xs text-slate-600">Top concern: {display.profile.topRisk}</p>
              </section>
            </div>
          </div>

          <ShareCard profile={display.profile} />
        </div>
      </PageTransition>
    </main>
  );
}
