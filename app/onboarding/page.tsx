'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StepWrapper } from '@/components/onboarding/StepWrapper';
import { SliderQuestion } from '@/components/onboarding/SliderQuestion';
import { CheckboxQuestion } from '@/components/onboarding/CheckboxQuestion';
import { WearableImport } from '@/components/onboarding/WearableImport';
import { STEPS } from '@/components/onboarding/steps';
import { runPipelineFromClient } from '@/lib/backend/client';
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
  existingConditions: z.array(z.string()),
  wearableImport: z.boolean().optional()
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
  existingConditions: [],
  wearableImport: false
};

export default function OnboardingPage() {
  const useBackendPipeline = process.env.NEXT_PUBLIC_USE_PIPELINE_API === '1';
  const router = useRouter();
  const setProfile = useFutureMeStore((state) => state.setProfile);
  const setPipelineAnalysis = useFutureMeStore((state) => state.setPipelineAnalysis);
  const profile = useFutureMeStore((state) => state.profile);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toNumberOrFallback = (value: unknown, fallback: number) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toNumberOrUndefined = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const toBooleanOrFallback = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

  const toStringOrFallback = (value: unknown, fallback: string) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const toArrayOfStrings = (value: unknown, fallback: string[]) => {
    if (!Array.isArray(value)) return fallback;
    return value.filter((entry): entry is string => typeof entry === 'string');
  };

  const toSex = (value: unknown): HealthInputs['sex'] =>
    value === 'male' || value === 'female' || value === 'other' ? value : defaults.sex;

  const toSmokingStatus = (value: unknown): HealthInputs['smokingStatus'] =>
    value === 'never' || value === 'former' || value === 'current' ? value : defaults.smokingStatus;

  const buildInputsFromUpload = (rawInputs: WearableImportPayload['inputs']): HealthInputs => {
    const inputs = rawInputs && typeof rawInputs === 'object' ? rawInputs : {};
    const typedInputs = inputs as Record<string, unknown>;

    return {
      name: toStringOrFallback(typedInputs.name, 'Future You'),
      age: toNumberOrFallback(typedInputs.age, defaults.age),
      sex: toSex(typedInputs.sex),
      heightCm: toNumberOrFallback(typedInputs.heightCm, defaults.heightCm),
      weightKg: toNumberOrFallback(typedInputs.weightKg, defaults.weightKg),
      sleepHours: toNumberOrFallback(typedInputs.sleepHours, defaults.sleepHours),
      exerciseDaysPerWeek: toNumberOrFallback(typedInputs.exerciseDaysPerWeek, defaults.exerciseDaysPerWeek),
      dietQuality: toNumberOrFallback(typedInputs.dietQuality, defaults.dietQuality),
      stressLevel: toNumberOrFallback(typedInputs.stressLevel, defaults.stressLevel),
      smokingStatus: toSmokingStatus(typedInputs.smokingStatus),
      alcoholDrinksPerWeek: toNumberOrFallback(typedInputs.alcoholDrinksPerWeek, defaults.alcoholDrinksPerWeek),
      familyHistoryHeart: toBooleanOrFallback(typedInputs.familyHistoryHeart, defaults.familyHistoryHeart),
      familyHistoryDiabetes: toBooleanOrFallback(typedInputs.familyHistoryDiabetes, defaults.familyHistoryDiabetes),
      familyHistoryCancer: toBooleanOrFallback(typedInputs.familyHistoryCancer, defaults.familyHistoryCancer),
      existingConditions: toArrayOfStrings(typedInputs.existingConditions, defaults.existingConditions)
    };
  };

  const buildClinicalMarkersFromUpload = (rawMarkers: WearableImportPayload['clinicalMarkers']) => {
    if (!rawMarkers || typeof rawMarkers !== 'object') return undefined;
    const markers: ClinicalMarkers = {};
    const source = rawMarkers as Record<string, unknown>;

    const totalCholesterolMgDl = toNumberOrUndefined(source.totalCholesterolMgDl);
    const hdlMgDl = toNumberOrUndefined(source.hdlMgDl);
    const systolicBloodPressureMmHg = toNumberOrUndefined(source.systolicBloodPressureMmHg);

    if (totalCholesterolMgDl !== undefined) markers.totalCholesterolMgDl = totalCholesterolMgDl;
    if (hdlMgDl !== undefined) markers.hdlMgDl = hdlMgDl;
    if (systolicBloodPressureMmHg !== undefined) markers.systolicBloodPressureMmHg = systolicBloodPressureMmHg;

    if (typeof source.onBloodPressureTreatment === 'boolean') {
      markers.onBloodPressureTreatment = source.onBloodPressureTreatment;
    }

    if (typeof source.hasDiabetes === 'boolean') {
      markers.hasDiabetes = source.hasDiabetes;
    }

    return Object.keys(markers).length > 0 ? markers : undefined;
  };

  const handleWearableImport = async (payload: WearableImportPayload) => {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const inputs = buildInputsFromUpload(payload.inputs);
      const clinicalMarkers = buildClinicalMarkersFromUpload(payload.clinicalMarkers);

      if (useBackendPipeline) {
        const analysis = await runPipelineFromClient({
          inputs,
          yearsOfHistory: 5,
          includePubMed: true,
          enableLlmSummary: true,
          kNearest: 3,
          clinicalMarkers
        });
        setProfile(analysis.profile);
        setPipelineAnalysis(analysis);
      } else {
        setProfile(createTwinProfile(inputs, 'wearable-import'));
        setPipelineAnalysis(null);
      }

      router.push('/awakening');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wearable import failed';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

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
  const isLastStep = stepIndex === STEPS.length - 1;

  const next = async () => {
    if (submitting) return;
    const valid = step.optional ? true : await trigger(step.fields);
    if (!valid) return;

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    const inputs = schema.omit({ wearableImport: true }).parse(getValues());
    setSubmitError(null);

    if (useBackendPipeline) {
      setSubmitting(true);
      try {
        const analysis = await runPipelineFromClient({
          inputs,
          yearsOfHistory: 5,
          includePubMed: true,
          enableLlmSummary: true,
          kNearest: 3
        });
        setProfile(analysis.profile);
        setPipelineAnalysis(analysis);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend pipeline error';
        setSubmitError(message);
        setProfile(createTwinProfile(inputs));
      } finally {
        setSubmitting(false);
      }
    } else {
      setProfile(createTwinProfile(inputs));
      setPipelineAnalysis(null);
    }

    router.push('/awakening');
  };

  return (
    <StepWrapper
      step={stepIndex + 1}
      total={STEPS.length}
      title={step.title}
      subtitle={step.subtitle}
      insight={step.insight}
      onNext={next}
      onBack={stepIndex > 0 ? () => setStepIndex((current) => current - 1) : undefined}
      nextLabel={isLastStep ? 'Generate my twin' : 'Continue'}
    >
      {submitError ? <p className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{submitError}</p> : null}

      {step.id === 'basics' ? (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-400">Name</span>
            <input
              {...register('name')}
              autoFocus
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-slate-700 focus:border-twin/50"
              placeholder="Alex"
            />
            {errors.name ? <span className="mt-2 block text-sm text-red-300">{errors.name.message}</span> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-slate-400">Age</span>
              <input
                {...register('age')}
                type="number"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-twin/50"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Sex</span>
              <select
                {...register('sex')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-navy-900 px-4 py-3 text-white outline-none transition focus:border-twin/50"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </div>
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
              maxLabel="Mediterranean"
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

      {step.id === 'wearable' ? (
        <div className="space-y-4">
          <WearableImport />
          <Controller
            control={control}
            name="wearableImport"
            render={({ field }) => (
              <CheckboxQuestion
                checked={Boolean(field.value)}
                label="Add mock wearable signals"
                description="Adds simulated sleep, activity and recovery signals for the demo."
                onChange={(checked) => {
                  setValue('wearableImport', checked);
                  field.onChange(checked);
                }}
              />
            )}
          />
        </div>
      ) : null}
    </StepWrapper>
  );
}
