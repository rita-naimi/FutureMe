'use client';

import { Activity, HeartPulse, Stethoscope, Watch } from 'lucide-react';

const WEARABLES = [
  { name: 'Apple Health', detail: 'Mock sleep, activity and heart-rate signals', icon: HeartPulse },
  { name: 'Oura Ring', detail: 'Mock sleep, recovery and readiness signals', icon: Watch },
  { name: 'Fitbit', detail: 'Mock steps, activity and resting heart-rate signals', icon: Activity }
];

export function WearableImport() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Estimate missing biomarkers with Synthea</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Match your questionnaire profile with similar synthetic patients to estimate missing clinical values such as systolic blood pressure,
          total cholesterol, HDL, diabetes and blood-pressure treatment.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {WEARABLES.map(({ name, detail, icon: Icon }) => (
          <button
            key={name}
            type="button"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-twin/40"
          >
            <Icon className="h-5 w-5 text-twin" />
            <p className="mt-3 text-sm font-medium text-white">{name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
          </button>
        ))}
      </div>

      <div className="flex w-full items-start gap-3 rounded-2xl border border-twin/25 bg-twin/10 p-4 text-left">
        <Stethoscope className="mt-0.5 h-5 w-5 flex-shrink-0 text-twin" />
        <span>
          <span className="block text-sm font-medium text-white">Synthea biomarker matching</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            Synthea estimates missing clinical biomarkers from a rule-based matched cohort. It does not replace your profile.
          </span>
        </span>
      </div>

      <div className="grid gap-3 text-xs leading-relaxed text-slate-500 sm:grid-cols-2">
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          Wearables provide lifestyle and device signals: sleep, activity, heart rate and recovery.
        </p>
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          Synthea estimates missing clinical biomarkers: SBP, total cholesterol, HDL, diabetes and blood-pressure treatment.
        </p>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Neither source replaces your questionnaire profile. They only enrich it.</p>
    </div>
  );
}
