'use client';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (value: number) => void;
}

export function SliderQuestion({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  minLabel,
  maxLabel,
  onChange
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="font-mono text-lg text-twin">
          {value}
          {unit}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-twin"
      />
      {(minLabel || maxLabel) ? (
        <div className="mt-2 flex justify-between text-xs text-slate-600">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
