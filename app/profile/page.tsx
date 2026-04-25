'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LogOut, Pencil, Save, Sparkles, UserRound } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import type { HealthInputs } from '@/lib/fhir';
import { createTwinProfile } from '@/lib/profile';
import { useFutureMeStore } from '@/lib/store';

const FIELD_CLASS =
  'mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-twin/50';

const RANGE_CLASS = 'w-full accent-twin';

export default function ProfilePage() {
  const router = useRouter();
  const profile = useFutureMeStore((state) => state.profile);
  const currentUserEmail = useFutureMeStore((state) => state.currentUserEmail);
  const profilePhotoDataUrl = useFutureMeStore((state) => state.profilePhotoDataUrl);
  const setProfile = useFutureMeStore((state) => state.setProfile);
  const setPipelineAnalysis = useFutureMeStore((state) => state.setPipelineAnalysis);
  const setProfilePhoto = useFutureMeStore((state) => state.setProfilePhoto);
  const logout = useFutureMeStore((state) => state.logout);
  const [draft, setDraft] = useState<HealthInputs | null>(profile?.inputs ?? null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(profile?.inputs ?? null);
  }, [profile]);

  const preview = useMemo(() => (draft ? createTwinProfile(draft, profile?.fhirSource) : null), [draft, profile?.fhirSource]);

  const update = <K extends keyof HealthInputs>(key: K, value: HealthInputs[K]) => {
    setSaved(false);
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateNumber = (key: keyof HealthInputs, value: string) => {
    update(key as never, Number(value) as never);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setProfile(createTwinProfile(draft, profile?.fhirSource));
    setPipelineAnalysis(null);
    setSaved(true);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!draft || !preview) {
    return (
      <main className="min-h-screen bg-navy-950 px-5 pb-28 pt-20">
        <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-twin/30 bg-twin/10">
            <UserRound className="h-7 w-7 text-twin" />
          </div>
          <h1 className="text-3xl font-bold text-white">No profile yet</h1>
          <p className="mt-3 text-slate-400">Create your health profile before editing account details.</p>
          <Link href="/onboarding" className="mt-7 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950">
            Start onboarding
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-navy-950 px-5 pb-32 pt-16">
      <PageTransition>
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-navy-900 p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-twin/10" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin/60 to-transparent" />
            <button
              type="button"
              onClick={handleLogout}
              className="absolute right-6 top-6 z-10 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-600 hover:shadow-red-600/30"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <label className="group relative mb-6 inline-flex h-16 w-16 cursor-pointer">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-twin/30 bg-twin/10 transition group-hover:border-twin/60">
                    {profilePhotoDataUrl ? (
                      <Image src={profilePhotoDataUrl} alt={`${draft.name} profile`} fill unoptimized className="object-cover" />
                    ) : (
                      <UserRound className="h-8 w-8 text-twin" />
                    )}
                  </span>
                  <span className="absolute -bottom-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-navy-900 bg-twin text-navy-950 shadow-md shadow-twin/30 transition group-hover:bg-twin-dark">
                    <Pencil className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                </label>
                <p className="font-mono text-sm text-twin/80">{currentUserEmail ?? 'Local profile'}</p>
                <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-tight text-white md:text-7xl">
                  {draft.name}, this is the real you.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
                  Your ground truth. Every number here is a fact about who you are today. Head to Simulate to adjust your twin&apos;s habits — and see where that trajectory leads.
                </p>
              </div>
            </div>
          </section>

          <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Who you are</p>
                  <p className="mt-1 text-sm text-slate-500">Fixed facts. Not aspirational — actual.</p>
                </div>
                {saved ? <span className="rounded-full bg-twin/10 px-3 py-1 text-xs font-medium text-twin">Saved</span> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Name" value={draft.name} onChange={(value) => update('name', value)} />
                <Input label="Age" type="number" value={draft.age} onChange={(value) => updateNumber('age', value)} />
                <Input label="Height" type="number" value={draft.heightCm} unit="cm" onChange={(value) => updateNumber('heightCm', value)} />
                <Input label="Weight" type="number" value={draft.weightKg} unit="kg" onChange={(value) => updateNumber('weightKg', value)} />
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm text-slate-400">Sex used for risk calculations</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['female', 'male', 'other'] as const).map((sex) => (
                    <button
                      key={sex}
                      type="button"
                      onClick={() => update('sex', sex)}
                      className={`min-h-12 rounded-2xl border px-3 text-sm font-medium capitalize transition ${
                        draft.sex === sex
                          ? 'border-twin bg-twin/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {sex}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-twin" />
                <div>
                  <p className="text-sm font-medium text-white">How you actually live</p>
                  <p className="mt-1 text-sm text-slate-500">Real habits, not targets. Simulations and what-ifs live on the Simulate page.</p>
                </div>
              </div>

              <div className="space-y-5">
                <Range label="Sleep" value={draft.sleepHours} min={4} max={10} step={0.5} unit="h" onChange={(value) => update('sleepHours', value)} />
                <Range label="Exercise" value={draft.exerciseDaysPerWeek} min={0} max={7} unit="days" onChange={(value) => update('exerciseDaysPerWeek', value)} />
                <Range label="Diet quality" value={draft.dietQuality} min={1} max={5} unit="/5" onChange={(value) => update('dietQuality', value)} />
                <Range label="Stress" value={draft.stressLevel} min={1} max={5} unit="/5" onChange={(value) => update('stressLevel', value)} />
                <Range label="Alcohol" value={draft.alcoholDrinksPerWeek} min={0} max={21} unit="/wk" onChange={(value) => update('alcoholDrinksPerWeek', value)} />
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <p className="mb-1 text-sm font-medium text-white">Smoking status</p>
              <p className="mb-4 text-sm text-slate-500">Be precise — this single variable carries heavy weight in the model.</p>
              <div className="grid grid-cols-3 gap-2">
                {(['never', 'former', 'current'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => update('smokingStatus', status)}
                    className={`min-h-12 rounded-2xl border px-3 text-sm font-medium capitalize transition ${
                      draft.smokingStatus === status
                        ? 'border-twin bg-twin text-navy-950'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <p className="mb-1 text-sm font-medium text-white">Family history</p>
              <p className="mb-4 text-sm text-slate-500">Inherited risk you can&apos;t change — but that the model needs to know.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle label="Heart disease" checked={draft.familyHistoryHeart} onChange={(checked) => update('familyHistoryHeart', checked)} />
                <Toggle label="Diabetes" checked={draft.familyHistoryDiabetes} onChange={(checked) => update('familyHistoryDiabetes', checked)} />
                <Toggle label="Cancer" checked={draft.familyHistoryCancer} onChange={(checked) => update('familyHistoryCancer', checked)} />
              </div>
            </section>

            <section className="flex flex-col justify-between gap-3 rounded-2xl border border-twin/25 bg-twin/10 p-5 sm:flex-row sm:items-center lg:col-span-2">
              <div>
                <p className="font-medium text-white">Lock in the real version.</p>
                <p className="mt-1 text-sm text-slate-500">Saving rebuilds your twin from actual data. Want to test scenarios? Head to Simulate.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-twin px-5 py-3 font-semibold text-navy-950 transition hover:bg-twin-dark"
                >
                  <Save className="h-4 w-4" />
                  Save profile
                </button>
              </div>
            </section>
          </form>
        </div>
      </PageTransition>
    </main>
  );
}

function Input({
  label,
  value,
  type = 'text',
  unit,
  onChange
}: {
  label: string;
  value: string | number;
  type?: 'text' | 'number';
  unit?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="relative">
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS} />
        {unit ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">{unit}</span> : null}
      </div>
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="font-mono text-sm text-twin">
          {value}
          <span className="ml-1 text-xs text-slate-600">{unit}</span>
        </p>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={RANGE_CLASS} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`min-h-12 rounded-2xl border px-3 text-sm font-medium transition ${
        checked ? 'border-twin bg-twin/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}
