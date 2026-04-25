'use client';

import { ChangeEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, CheckCircle, ClipboardList, FileUp, Loader2, X } from 'lucide-react';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { StepWrapper } from '@/components/onboarding/StepWrapper';
import { SliderQuestion } from '@/components/onboarding/SliderQuestion';
import { CheckboxQuestion } from '@/components/onboarding/CheckboxQuestion';
import { STEPS } from '@/components/onboarding/steps';
import { runPipelineFromClient } from '@/lib/backend/client';
import type { ClinicalMarkers, PipelineResponse } from '@/lib/backend/types';
import type { HealthInputs, TwinProfile } from '@/lib/fhir';
import { createTwinProfile } from '@/lib/profile';
import { useFutureMeStore } from '@/lib/store';

const schema = z.object({
  name: z.string().min(1, 'Your twin needs a name.'),
  age: z.coerce.number().min(16).max(90),
  sex: z.enum(['male', 'female', 'other']),
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(35).max(220),
  sleepHours: z.coerce.number().min(4).max(10),
  exerciseDaysPerWeek: z.coerce.number().min(0).max(7),
  dietQuality: z.coerce.number().min(1).max(5),
  stressLevel: z.coerce.number().min(1).max(5),
  smokingStatus: z.enum(['never', 'former', 'current']),
  alcoholDrinksPerWeek: z.coerce.number().min(0).max(21),
  familyHistoryHeart: z.boolean(),
  familyHistoryDiabetes: z.boolean(),
  familyHistoryCancer: z.boolean(),
  existingConditions: z.array(z.string())
});

export type OnboardingValues = z.infer<typeof schema>;

const defaults: OnboardingValues = {
  name: '',
  age: 34,
  sex: 'other',
  heightCm: 172,
  weightKg: 74,
  sleepHours: 7,
  exerciseDaysPerWeek: 2,
  dietQuality: 3,
  stressLevel: 3,
  smokingStatus: 'never',
  alcoholDrinksPerWeek: 4,
  familyHistoryHeart: false,
  familyHistoryDiabetes: false,
  familyHistoryCancer: false,
  existingConditions: []
};

type AppleHealthImportPayload = {
  inputs?: Partial<Record<keyof OnboardingValues, unknown>>;
  clinicalMarkers?: {
    totalCholesterolMgDl?: number | null;
    hdlMgDl?: number | null;
    systolicBloodPressureMmHg?: number | null;
    onBloodPressureTreatment?: boolean | null;
    hasDiabetes?: boolean | null;
  };
  missing?: string[];
};

function isOnboardingField(value: string): value is keyof OnboardingValues {
  return value in defaults;
}

function normalizeClinicalMarkers(markers: AppleHealthImportPayload['clinicalMarkers']): ClinicalMarkers | undefined {
  if (!markers) return undefined;

  const output: ClinicalMarkers = {};

  if (typeof markers.totalCholesterolMgDl === 'number') output.totalCholesterolMgDl = markers.totalCholesterolMgDl;
  if (typeof markers.hdlMgDl === 'number') output.hdlMgDl = markers.hdlMgDl;
  if (typeof markers.systolicBloodPressureMmHg === 'number') output.systolicBloodPressureMmHg = markers.systolicBloodPressureMmHg;
  if (typeof markers.onBloodPressureTreatment === 'boolean') output.onBloodPressureTreatment = markers.onBloodPressureTreatment;
  if (typeof markers.hasDiabetes === 'boolean') output.hasDiabetes = markers.hasDiabetes;

  return Object.keys(output).length > 0 ? output : undefined;
}

function deriveMissingFields(payload: AppleHealthImportPayload): Array<keyof OnboardingValues> {
  if (Array.isArray(payload.missing) && payload.missing.length > 0) {
    return payload.missing.filter(isOnboardingField);
  }

  const inputs = payload.inputs ?? {};
  const missing: Array<keyof OnboardingValues> = [];

  for (const [key, value] of Object.entries(inputs)) {
    if (!isOnboardingField(key)) continue;
    if (value === null || value === undefined) missing.push(key);
  }

  return missing;
}

export default function OnboardingPage() {
  const useBackendPipeline = process.env.NEXT_PUBLIC_USE_PIPELINE_API === '1';
  const router = useRouter();
  const profile = useFutureMeStore((state) => state.profile);
  const [mode, setMode] = useState<'choose' | 'import-success' | 'questionnaire'>('choose');
  const [xmlUploading, setXmlUploading] = useState(false);
  const [xmlImportPayload, setXmlImportPayload] = useState<AppleHealthImportPayload | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<TwinProfile | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PipelineResponse | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(useFutureMeStore.getState().profilePhotoDataUrl ?? null);
  const [appleHealthMissingFields, setAppleHealthMissingFields] = useState<Array<keyof OnboardingValues> | null>(null);
  const [uploadedClinicalMarkers, setUploadedClinicalMarkers] = useState<ClinicalMarkers | undefined>(undefined);

  const {
    control,
    register,
    trigger,
    getValues,
    setValue,
    formState: { errors }
  } = useForm<OnboardingValues>({
    resolver: zodResolver(schema),
    defaultValues: profile?.inputs ? { ...defaults, ...profile.inputs } : defaults,
    mode: 'onChange'
  });

  const step = STEPS[stepIndex];
  const isAuthStep = step.id === 'auth';

  const shouldAskStep = (index: number) => {
    const candidate = STEPS[index];
    if (!candidate) return false;
    if (!appleHealthMissingFields) return true;
    if (candidate.id === 'photo' || candidate.id === 'auth') return true;
    if (candidate.fields.length === 0) return true;
    return candidate.fields.some((field) => appleHealthMissingFields.includes(field as keyof OnboardingValues));
  };

  const findNextStepIndex = (fromIndex: number) => {
    for (let index = fromIndex + 1; index < STEPS.length; index += 1) {
      if (shouldAskStep(index)) return index;
    }
    return STEPS.length - 1;
  };

  const findPrevStepIndex = (fromIndex: number) => {
    for (let index = fromIndex - 1; index >= 0; index -= 1) {
      if (shouldAskStep(index)) return index;
    }
    return -1;
  };

  const authStepIndex = STEPS.findIndex((item) => item.id === 'auth');
  const lastQuestionStepIndex = (() => {
    const maxIndex = authStepIndex > 0 ? authStepIndex - 1 : STEPS.length - 1;
    for (let index = maxIndex; index >= 0; index -= 1) {
      if (shouldAskStep(index)) return index;
    }
    return maxIndex;
  })();

  const applyAppleHealthImport = (payload: AppleHealthImportPayload) => {
    const rawInputs = payload.inputs ?? {};

    (Object.entries(rawInputs) as Array<[string, unknown]>).forEach(([key, value]) => {
      if (!isOnboardingField(key)) return;
      if (value === null || value === undefined) return;
      setValue(key, value as never, { shouldValidate: false, shouldDirty: true });
    });

    const missing = deriveMissingFields(payload);
    setAppleHealthMissingFields(missing);
    setUploadedClinicalMarkers(normalizeClinicalMarkers(payload.clinicalMarkers));

    const shouldAskWithMissing = (index: number) => {
      const candidate = STEPS[index];
      if (!candidate) return false;
      if (candidate.id === 'photo' || candidate.id === 'auth') return true;
      if (candidate.fields.length === 0) return true;
      return candidate.fields.some((field) => missing.includes(field as keyof OnboardingValues));
    };

    let nextIndex = stepIndex;
    if (!shouldAskWithMissing(stepIndex)) {
      nextIndex = STEPS.length - 1;
      for (let index = stepIndex + 1; index < STEPS.length; index += 1) {
        if (shouldAskWithMissing(index)) {
          nextIndex = index;
          break;
        }
      }
    }

    setStepIndex(nextIndex);
  };

  const onXmlFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setXmlUploading(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/import-xml', { method: 'POST', body });
      const payload = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Import failed');
      }
      setXmlImportPayload(payload as AppleHealthImportPayload);
      setMode('import-success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not parse the XML file.');
    } finally {
      setXmlUploading(false);
      event.target.value = '';
    }
  };

  const onImportContinue = () => {
    if (xmlImportPayload) applyAppleHealthImport(xmlImportPayload);
    setMode('questionnaire');
  };

  const next = async () => {
    if (submitting || isAuthStep) return;
    const valid = step.optional ? true : await trigger(step.fields);
    if (!valid) return;

    if (stepIndex < lastQuestionStepIndex) {
      setStepIndex(findNextStepIndex(stepIndex));
      return;
    }

    const inputs = schema.parse(getValues());
    setSubmitError(null);
    setSubmitting(true);

    let nextProfile: TwinProfile;
    let nextAnalysis: PipelineResponse | null = null;

    if (useBackendPipeline) {
      try {
        const analysis = await runPipelineFromClient({
          inputs,
          yearsOfHistory: 5,
          includePubMed: true,
          enableLlmSummary: true,
          kNearest: 3,
          clinicalMarkers: uploadedClinicalMarkers
        });
        nextProfile = analysis.profile;
        nextAnalysis = analysis;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend pipeline error';
        setSubmitError(message);
        nextProfile = createTwinProfile(inputs);
      }
    } else {
      nextProfile = createTwinProfile(inputs);
    }

    setPendingProfile(nextProfile);
    setPendingAnalysis(nextAnalysis);
    setSubmitting(false);
    setStepIndex(authStepIndex === -1 ? STEPS.length - 1 : authStepIndex);
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setProfilePhotoDataUrl(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSubmitError('Please choose an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSubmitError(null);
        setProfilePhotoDataUrl(reader.result);
      }
    };
    reader.onerror = () => setSubmitError('Could not read that image. Try another file.');
    reader.readAsDataURL(file);
  };

  if (mode === 'choose') {
    return (
      <main className="min-h-screen bg-navy-950 px-5">
        <Link
          href="/"
          className="fixed left-5 top-6 z-50 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:text-slate-200 sm:left-8"
        >
          <X className="h-4 w-4" />
          Leave onboarding
        </Link>

        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-8 py-20">
          <div className="text-center">
            <h1 className="text-balance text-4xl font-bold leading-tight text-white">
              How would you like to build your profile?
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              Answer a short questionnaire, or import your data directly from an Apple Health XML export.
            </p>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('questionnaire')}
              className="flex flex-col items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-twin/40 hover:bg-twin/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-twin/10 text-twin">
                <ClipboardList className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-white">Answer questionnaire</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                  10 questions about your habits and history. Takes about 2 minutes.
                </span>
              </span>
            </button>

            <label
              className={`flex cursor-pointer flex-col items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-twin/40 hover:bg-twin/5 ${xmlUploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-twin/10 text-twin">
                {xmlUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileUp className="h-5 w-5" />
                )}
              </span>
              <span>
                <span className="block font-semibold text-white">Import Apple Health XML</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                  Upload your export.xml file. We'll prefill what we can and ask only for the rest.
                </span>
              </span>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={onXmlFileChange}
                disabled={xmlUploading}
              />
            </label>
          </div>

          {submitError ? (
            <p className="w-full rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {submitError}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (mode === 'import-success' && xmlImportPayload) {
    const fieldLabels: Partial<Record<keyof OnboardingValues, string>> = {
      name: 'Name',
      age: 'Age',
      sex: 'Biological sex',
      heightCm: 'Height',
      weightKg: 'Weight',
      sleepHours: 'Average sleep',
      exerciseDaysPerWeek: 'Exercise frequency',
      dietQuality: 'Diet quality',
      stressLevel: 'Stress level',
      smokingStatus: 'Smoking status',
      alcoholDrinksPerWeek: 'Alcohol intake',
      familyHistoryHeart: 'Family history — heart disease',
      familyHistoryDiabetes: 'Family history — diabetes',
      familyHistoryCancer: 'Family history — cancer'
    };

    const importedEntries = (
      Object.entries(xmlImportPayload.inputs ?? {}) as [keyof OnboardingValues, unknown][]
    ).filter(([key, val]) => val !== null && val !== undefined && key !== 'existingConditions' && key in fieldLabels);

    const missingKeys = (xmlImportPayload.missing ?? []).filter(
      (k): k is keyof OnboardingValues => k in fieldLabels
    );

    return (
      <main className="min-h-screen bg-navy-950 px-5">
        <button
          type="button"
          onClick={() => { setMode('choose'); setSubmitError(null); }}
          className="fixed left-5 top-6 z-50 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:text-slate-200 sm:left-8"
        >
          <X className="h-4 w-4" />
          Back
        </button>

        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-8 py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-12 w-12 text-twin" />
            <h1 className="text-3xl font-bold text-white">Import successful</h1>
            <p className="text-base leading-relaxed text-slate-400">
              Here's what we found in your Apple Health data.
              {missingKeys.length > 0 ? " We'll ask for the rest." : ' Your profile is ready.'}
            </p>
          </div>

          <div className="w-full space-y-4">
            {importedEntries.length > 0 && (
              <div className="rounded-2xl border border-twin/20 bg-twin/5 p-5">
                <p className="mb-3 text-sm font-semibold text-twin">Extracted from your export</p>
                <ul className="space-y-1.5">
                  {importedEntries.map(([key]) => (
                    <li key={key} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-twin" />
                      {fieldLabels[key]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {missingKeys.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="mb-3 text-sm font-semibold text-slate-400">Still needed</p>
                <ul className="space-y-1.5">
                  {missingKeys.map((key) => (
                    <li key={key} className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                      {fieldLabels[key]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onImportContinue}
            className="inline-flex items-center gap-2 rounded-full bg-twin px-7 py-3 font-semibold text-navy-950 transition hover:bg-twin-dark"
          >
            {missingKeys.length > 0 ? 'Fill in the rest' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <StepWrapper
      step={stepIndex + 1}
      total={STEPS.length}
      title={step.title}
      subtitle={step.subtitle}
      insight={step.insight}
      onNext={next}
      onBack={findPrevStepIndex(stepIndex) !== -1 ? () => setStepIndex(findPrevStepIndex(stepIndex)) : undefined}
      nextLabel={stepIndex === lastQuestionStepIndex ? (submitting ? 'Preparing...' : 'Continue') : 'Continue'}
      hideNext={isAuthStep}
      exitHref="/"
      exitLabel="Leave onboarding"
    >
      {submitError ? <p className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{submitError}</p> : null}

      {step.id === 'name' ? (
        <label className="block">
          <span className="text-sm text-slate-400">Name</span>
          <input
            {...register('name')}
            autoFocus
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-slate-700 focus:border-twin/50"
            placeholder="Your name"
          />
          {errors.name ? <span className="mt-2 block text-sm text-red-300">{errors.name.message}</span> : null}
        </label>
      ) : null}

      {step.id === 'age' ? (
        <label className="block">
          <span className="text-sm text-slate-400">Age</span>
          <input
            {...register('age')}
            type="number"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-twin/50"
          />
        </label>
      ) : null}

      {step.id === 'sex' ? (
        <Controller
          control={control}
          name="sex"
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-2">
              {(['female', 'male', 'other'] as const).map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => field.onChange(sex)}
                  className={`min-h-12 rounded-2xl border px-3 text-sm font-medium capitalize transition ${
                    field.value === sex
                      ? 'border-twin bg-twin/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  }`}
                >
                  {sex}
                </button>
              ))}
            </div>
          )}
        />
      ) : null}

      {step.id === 'body' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-400">Height</span>
            <input
              {...register('heightCm')}
              type="number"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-twin/50"
            />
            <span className="mt-2 block text-xs text-slate-600">centimeters</span>
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Weight</span>
            <input
              {...register('weightKg')}
              type="number"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-twin/50"
            />
            <span className="mt-2 block text-xs text-slate-600">kilograms</span>
          </label>
        </div>
      ) : null}

      {step.id === 'sleep' ? (
        <Controller
          control={control}
          name="sleepHours"
          render={({ field }) => (
            <SliderQuestion label="Hours per night" min={4} max={10} step={0.5} unit="h" value={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {step.id === 'movement' ? (
        <Controller
          control={control}
          name="exerciseDaysPerWeek"
          render={({ field }) => (
            <SliderQuestion label="Exercise days" min={0} max={7} unit="/wk" value={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {step.id === 'diet' ? (
        <Controller
          control={control}
          name="dietQuality"
          render={({ field }) => (
            <SliderQuestion
              label="Diet quality"
              min={1}
              max={5}
              unit="/5"
              value={field.value}
              minLabel="Mostly processed"
              maxLabel="Balanced whole foods"
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      {step.id === 'stress' ? (
        <Controller
          control={control}
          name="stressLevel"
          render={({ field }) => (
            <SliderQuestion
              label="Stress level"
              min={1}
              max={5}
              unit="/5"
              value={field.value}
              minLabel="Calm"
              maxLabel="Constant strain"
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      {step.id === 'smoking' ? (
        <Controller
          control={control}
          name="smokingStatus"
          render={({ field }) => (
            <div className="grid gap-3">
              {(['never', 'former', 'current'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => field.onChange(status)}
                  className={`rounded-2xl border p-4 text-left capitalize transition ${
                    field.value === status
                      ? 'border-twin bg-twin/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        />
      ) : null}

      {step.id === 'alcohol' ? (
        <Controller
          control={control}
          name="alcoholDrinksPerWeek"
          render={({ field }) => (
            <SliderQuestion label="Alcohol" min={0} max={21} unit="/wk" value={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {step.id === 'history' ? (
        <div className="space-y-3">
          <Controller
            control={control}
            name="familyHistoryHeart"
            render={({ field }) => (
              <CheckboxQuestion checked={field.value} label="Heart disease" onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="familyHistoryDiabetes"
            render={({ field }) => (
              <CheckboxQuestion checked={field.value} label="Diabetes" onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="familyHistoryCancer"
            render={({ field }) => (
              <CheckboxQuestion checked={field.value} label="Cancer" onChange={field.onChange} />
            )}
          />
        </div>
      ) : null}

      {step.id === 'photo' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-twin/25 bg-twin/10">
              {profilePhotoDataUrl ? (
                <Image src={profilePhotoDataUrl} alt="Profile preview" fill unoptimized className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">No photo</span>
              )}
            </div>
            <div>
              <p className="text-sm text-slate-300">Add an image that will appear on your profile card.</p>
              <p className="mt-1 text-xs text-slate-500">PNG, JPG, or WebP. You can skip this step.</p>
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-twin/50 hover:text-white">
            Choose photo
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </label>

          {profilePhotoDataUrl ? (
            <button
              type="button"
              onClick={() => setProfilePhotoDataUrl(null)}
              className="ml-2 inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-200"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      ) : null}

      {step.id === 'auth' ? (
        <AuthPanel
          mode="create"
          profile={pendingProfile ?? undefined}
          pipelineAnalysis={pendingAnalysis}
          profilePhotoDataUrl={profilePhotoDataUrl}
          onSuccess={() => router.push('/awakening')}
        />
      ) : null}
    </StepWrapper>
  );
}
