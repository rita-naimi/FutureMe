'use client';

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import type { HealthInputs } from '@/lib/fhir';

interface Props {
  inputs: HealthInputs;
  simulatedInputs?: HealthInputs | null;
}

export function HabitRadar({ inputs, simulatedInputs }: Props) {
  const currentData = buildData(inputs);
  const simulatedData = simulatedInputs ? buildData(simulatedInputs) : null;
  const hasChange = simulatedInputs && JSON.stringify(inputs) !== JSON.stringify(simulatedInputs);
  const chartData = currentData.map((point, index) => ({
    subject: point.subject,
    current: point.value,
    simulated: simulatedData?.[index]?.value
  }));

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Habit profile</p>
          <p className="mt-1 text-xs text-slate-500">Normalized lifestyle signals from your FHIR observations.</p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="#1A3055" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 12 }} />
            <Radar dataKey="current" stroke="#00C9A7" fill="#00C9A7" fillOpacity={0.18} />
            {hasChange && simulatedData ? (
              <Radar dataKey="simulated" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.12} />
            ) : null}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs">
        <span className="text-twin">Current</span>
        {hasChange ? <span className="text-amber-400">Simulated</span> : null}
      </div>
    </section>
  );
}

function buildData(inputs: HealthInputs) {
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
