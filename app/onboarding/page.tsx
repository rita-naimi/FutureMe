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
  const router = useRouter();
  const setProfile = useFutureMeStore((state) => state.setProfile);
  const profile = useFutureMeStore((state) => state.profile);
  const [stepIndex, setStepIndex] = useState(0);

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
    const valid = step.optional ? true : await trigger(step.fields);
    if (!valid) return;

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    const { wearableImport: _wearableImport, ...inputs } = getValues();
    setProfile(createTwinProfile(inputs));
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
                label="Use mock wearable enrichment"
                description="Adds the device-import moment to the generated FHIR profile narrative."
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
