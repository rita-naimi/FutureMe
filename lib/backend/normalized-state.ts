import type { HealthInputs } from '@/lib/fhir';
import { getBmi } from '@/lib/fhir';
import type { ClinicalMarkers, NormalizedHealthState, NormalizedHealthStateSource, SyntheaModelState } from './types';

const SYNTHEA_MODEL_FIELDS: Array<keyof SyntheaModelState> = [
  'age',
  'sex',
  'SBP',
  'DBP',
  'BMI',
  'total_chol',
  'HDL',
  'glucose',
  'smoker',
  'diabetes',
  'hypertension'
];

export function normalizeHealthState(
  inputs: HealthInputs,
  markers: ClinicalMarkers | undefined,
  options?: {
    source?: NormalizedHealthStateSource;
    date?: string;
  }
): NormalizedHealthState {
  const bmi = round1(getBmi(inputs));
  const hasHypertension =
    markers?.hasHypertension ??
    markers?.onBloodPressureTreatment ??
    inputs.existingConditions.some((condition) => /hypertension|blood pressure/i.test(condition));

  return {
    source: options?.source ?? 'manual',
    date: options?.date ?? new Date().toISOString(),
    demographics: {
      age: inputs.age,
      sex: inputs.sex
    },
    vitals: {
      systolicBloodPressure: markers?.systolicBloodPressureMmHg,
      diastolicBloodPressure: markers?.diastolicBloodPressureMmHg,
      heartRate: markers?.heartRateBpm,
      restingHeartRate: markers?.restingHeartRateBpm,
      bmi,
      weightKg: inputs.weightKg,
      heightCm: inputs.heightCm
    },
    labs: {
      totalCholesterol: markers?.totalCholesterolMgDl,
      hdlCholesterol: markers?.hdlMgDl,
      ldlCholesterol: markers?.ldlMgDl,
      glucose: markers?.glucoseMgDl,
      hba1c: markers?.hba1cPercent
    },
    lifestyle: {
      sleepHours: inputs.sleepHours,
      smoker: markers?.smoker ?? inputs.smokingStatus === 'current'
    },
    conditions: {
      diabetes: markers?.hasDiabetes,
      hypertension: hasHypertension
    }
  };
}

export function toSyntheaModelState(state: NormalizedHealthState): SyntheaModelState {
  return {
    age: state.demographics.age,
    sex: state.demographics.sex,
    SBP: state.vitals.systolicBloodPressure,
    DBP: state.vitals.diastolicBloodPressure,
    BMI: state.vitals.bmi,
    total_chol: state.labs.totalCholesterol,
    HDL: state.labs.hdlCholesterol,
    glucose: state.labs.glucose,
    smoker: state.lifestyle.smoker,
    diabetes: state.conditions.diabetes,
    hypertension: state.conditions.hypertension
  };
}

export function listMissingSyntheaModelFields(state: SyntheaModelState): string[] {
  return SYNTHEA_MODEL_FIELDS.filter((field) => state[field] === undefined || state[field] === null);
}

export function explainAppleHealthSyntheaOverlap(state: NormalizedHealthState): string[] {
  const warnings: string[] = [];
  const modelState = toSyntheaModelState(state);
  const missing = listMissingSyntheaModelFields(modelState);

  if (state.source === 'apple_healthkit') {
    warnings.push(
      'Apple HealthKit data is reduced to the fields shared with the Synthea/FHIR training schema before trajectory modeling.'
    );
  }

  if (state.lifestyle.sleepHours !== undefined) {
    warnings.push('Sleep is kept for intervention eligibility, but it is not part of the Synthea trajectory model input table.');
  }

  if (missing.length > 0) {
    warnings.push(`Missing Synthea trajectory fields: ${missing.join(', ')}. Prototype estimates are used only to complete the demo curve.`);
  }

  return warnings;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
