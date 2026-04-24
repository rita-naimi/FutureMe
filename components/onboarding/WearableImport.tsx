'use client';

import { Activity, FileJson, HeartPulse, Watch } from 'lucide-react';
import { useFutureMeStore } from '@/lib/store';

const WEARABLES = [
  { name: 'Apple Health', format: 'export.xml', icon: HeartPulse },
  { name: 'Oura Ring', format: 'oura_export.json', icon: Watch },
  { name: 'Fitbit', format: 'fitbit_export.json', icon: Activity }
];

export function WearableImport() {
  const loadDemoPersona = useFutureMeStore((state) => state.loadDemoPersona);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {WEARABLES.map(({ name, format, icon: Icon }) => (
          <button
            key={name}
            type="button"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-twin/40"
          >
            <Icon className="h-5 w-5 text-twin" />
            <p className="mt-3 text-sm font-medium text-white">{name}</p>
            <p className="mt-1 text-xs text-slate-600">{format}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => loadDemoPersona('alex')}
        className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-left transition hover:border-amber-300/40"
      >
        <FileJson className="h-5 w-5 flex-shrink-0 text-amber-300" />
        <span>
          <span className="block text-sm font-medium text-white">Load Alex Synthea demo data</span>
          <span className="mt-1 block text-xs text-slate-500">Pre-generated FHIR-style patient persona for reliable demos.</span>
        </span>
      </button>
    </div>
  );
}
