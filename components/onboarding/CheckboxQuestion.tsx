'use client';

import { Check } from 'lucide-react';

interface Props {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}

export function CheckboxQuestion({ checked, label, description, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
        checked ? 'border-twin bg-twin/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
          checked ? 'border-twin bg-twin text-navy-950' : 'border-white/20'
        }`}
      >
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span> : null}
      </span>
    </button>
  );
}
