'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Database, UserRoundCheck } from 'lucide-react';
import { DEMO_PERSONAS, type DemoPersonaId } from '@/lib/demo-personas';
import { useFutureMeStore } from '@/lib/store';

function isDemoPersona(value: string | null): value is DemoPersonaId {
  return value === 'alex' || value === 'maya' || value === 'james';
}

export function DemoQueryLoader() {
  const searchParams = useSearchParams();
  const loadDemoPersona = useFutureMeStore((state) => state.loadDemoPersona);
  const current = useFutureMeStore((state) => state.demoPersona);
  const requested = searchParams.get('demo');

  useEffect(() => {
    if (isDemoPersona(requested) && requested !== current) {
      loadDemoPersona(requested);
    }
  }, [current, loadDemoPersona, requested]);

  return null;
}

export function DemoSwitcher() {
  const current = useFutureMeStore((state) => state.demoPersona);
  const loadDemoPersona = useFutureMeStore((state) => state.loadDemoPersona);

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-twin" />
        <p className="text-sm font-medium text-white">Synthea demo personas</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(DEMO_PERSONAS) as DemoPersonaId[]).map((id) => {
          const persona = DEMO_PERSONAS[id];
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => loadDemoPersona(id)}
              className={`flex min-h-[4.5rem] items-start gap-3 rounded-xl border p-3 text-left transition ${
                active
                  ? 'border-twin bg-twin/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <span
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${persona.color}22`, color: persona.color }}
              >
                <UserRoundCheck className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{persona.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{persona.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
