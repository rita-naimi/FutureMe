'use client';

import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';

interface Props {
  label: string;
  value: number;
  description: string;
}

const getRiskColor = (value: number) => {
  if (value < 30) return '#22C55E';
  if (value < 60) return '#F59E0B';
  return '#EF4444';
};

export function RiskGauge({ label, value, description }: Props) {
  const color = getRiskColor(value);
  const data = [{ value, fill: color }];

  return (
    <article className="glass-panel flex min-h-[12.5rem] flex-col items-center justify-center rounded-2xl p-5">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={225} endAngle={-45}>
            <RadialBar dataKey="value" cornerRadius={5} background={{ fill: '#1A3055' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{value}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-center text-xs leading-relaxed text-slate-500">{description}</p>
    </article>
  );
}
