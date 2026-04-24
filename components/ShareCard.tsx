'use client';

import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import type { TwinProfile } from '@/lib/fhir';

export function ShareCard({ profile }: { profile: TwinProfile }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!cardRef.current) return;
    const png = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 });
    const link = document.createElement('a');
    link.href = png;
    link.download = 'my-futureme-health-card.png';
    link.click();
  };

  return (
    <section className="glass-panel rounded-2xl p-5">
      <div
        ref={cardRef}
        className="rounded-2xl border border-twin/25 bg-navy-950 p-6"
        style={{ width: '100%', maxWidth: 480 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-twin/40 bg-twin/15 text-twin">
            FM
          </div>
          <div>
            <p className="font-semibold text-white">FutureMe</p>
            <p className="text-xs text-twin">Health snapshot · {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="my-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Biological age</p>
          <p className="mt-1 text-6xl font-bold text-white">{profile.biologicalAge}</p>
          <p className="mt-1 text-sm text-slate-400">
            {profile.biologicalAge > profile.inputs.age
              ? `${profile.biologicalAge - profile.inputs.age} years older than my real age`
              : `${profile.inputs.age - profile.biologicalAge} years younger than my real age`}
          </p>
        </div>
        <p className="border-t border-white/10 pt-4 text-center text-sm italic leading-relaxed text-twin">
          &quot;{profile.keyInsight}&quot;
        </p>
        <p className="mt-4 text-center text-[11px] text-slate-700">HL7 FHIR R4 · LOINC coded observations</p>
      </div>
      <button
        type="button"
        onClick={download}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-twin/35 px-4 py-2 text-sm font-medium text-twin transition hover:bg-twin/10"
      >
        <Download className="h-4 w-4" />
        Download health card
      </button>
    </section>
  );
}
