'use client';

import { Activity, Dumbbell, HeartPulse, Moon, Scale, Wine } from 'lucide-react';
import type { HealthInputs, RiskScores } from '@/lib/fhir';
import { getBmi } from '@/lib/fhir';

interface Props {
  inputs: HealthInputs;
  risks: RiskScores;
}

export function HealthScoreGrid({ inputs, risks }: Props) {
  const items = [
    { label: 'BMI', value: getBmi(inputs).toFixed(1), icon: Scale, tone: 'text-slate-300' },
    { label: 'Sleep', value: `${inputs.sleepHours}h`, icon: Moon, tone: 'text-twin' },
    { label: 'Exercise', value: `${inputs.exerciseDaysPerWeek}/wk`, icon: Dumbbell, tone: 'text-twin' },
    { label: 'Alcohol', value: `${inputs.alcoholDrinksPerWeek}/wk`, icon: Wine, tone: 'text-amber-300' },
    { label: 'Longevity', value: `${risks.longevity}`, icon: HeartPulse, tone: 'text-green-300' },
    { label: 'Overall risk', value: `${risks.overall}`, icon: Activity, tone: 'text-red-300' }
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <article key={label} className="glass-panel rounded-2xl p-4">
          <Icon className={`h-4 w-4 ${tone}`} />
          <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{label}</p>
        </article>
      ))}
    </section>
  );
}
