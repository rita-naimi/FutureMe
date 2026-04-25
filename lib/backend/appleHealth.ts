import type { HealthInputs } from '@/lib/fhir';
import type { ClinicalMarkers } from './types';

type Nullable<T> = { [K in keyof T]?: T[K] | null };

type AppleHealthInputs = Nullable<
  Pick<
    HealthInputs,
    | 'name'
    | 'age'
    | 'sex'
    | 'heightCm'
    | 'weightKg'
    | 'sleepHours'
    | 'exerciseDaysPerWeek'
    | 'dietQuality'
    | 'stressLevel'
    | 'smokingStatus'
    | 'alcoholDrinksPerWeek'
    | 'familyHistoryHeart'
    | 'familyHistoryDiabetes'
    | 'familyHistoryCancer'
    | 'existingConditions'
  >
>;

type AppleHealthClinicalMarkers = Nullable<ClinicalMarkers>;

export type AppleHealthSummary = {
  inputs?: AppleHealthInputs;
  clinicalMarkers?: AppleHealthClinicalMarkers;
};

const DEFAULT_INPUTS: HealthInputs = {
  name: 'Future You',
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

function coalesce<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

function normalizeName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSex(value: unknown): HealthInputs['sex'] | undefined {
  if (value === 'male' || value === 'female' || value === 'other') return value;
  return undefined;
}

function normalizeSmokingStatus(value: unknown): HealthInputs['smokingStatus'] | undefined {
  if (value === 'never' || value === 'former' || value === 'current') return value;
  return undefined;
}

export function buildInputsFromAppleHealth(summary: AppleHealthSummary): HealthInputs {
  const src = summary.inputs ?? {};

  const name = normalizeName(src.name);
  const sex = normalizeSex(src.sex);
  const smokingStatus = normalizeSmokingStatus(src.smokingStatus);

  return {
    name: coalesce(name, DEFAULT_INPUTS.name),
    age: coalesce(src.age, DEFAULT_INPUTS.age),
    sex: coalesce(sex, DEFAULT_INPUTS.sex),
    heightCm: coalesce(src.heightCm, DEFAULT_INPUTS.heightCm),
    weightKg: coalesce(src.weightKg, DEFAULT_INPUTS.weightKg),
    sleepHours: coalesce(src.sleepHours, DEFAULT_INPUTS.sleepHours),
    exerciseDaysPerWeek: coalesce(src.exerciseDaysPerWeek, DEFAULT_INPUTS.exerciseDaysPerWeek),
    dietQuality: coalesce(src.dietQuality, DEFAULT_INPUTS.dietQuality),
    stressLevel: coalesce(src.stressLevel, DEFAULT_INPUTS.stressLevel),
    smokingStatus: coalesce(smokingStatus, DEFAULT_INPUTS.smokingStatus),
    alcoholDrinksPerWeek: coalesce(src.alcoholDrinksPerWeek, DEFAULT_INPUTS.alcoholDrinksPerWeek),
    familyHistoryHeart: coalesce(src.familyHistoryHeart, DEFAULT_INPUTS.familyHistoryHeart),
    familyHistoryDiabetes: coalesce(src.familyHistoryDiabetes, DEFAULT_INPUTS.familyHistoryDiabetes),
    familyHistoryCancer: coalesce(src.familyHistoryCancer, DEFAULT_INPUTS.familyHistoryCancer),
    existingConditions: Array.isArray(src.existingConditions) ? src.existingConditions : []
  };
}

export function buildClinicalMarkersFromAppleHealth(summary: AppleHealthSummary): ClinicalMarkers | undefined {
  const src = summary.clinicalMarkers ?? {};
  const markers: ClinicalMarkers = {};
  let hasAny = false;

  if (src.totalCholesterolMgDl !== null && src.totalCholesterolMgDl !== undefined) {
    markers.totalCholesterolMgDl = src.totalCholesterolMgDl;
    hasAny = true;
  }
  if (src.hdlMgDl !== null && src.hdlMgDl !== undefined) {
    markers.hdlMgDl = src.hdlMgDl;
    hasAny = true;
  }
  if (src.systolicBloodPressureMmHg !== null && src.systolicBloodPressureMmHg !== undefined) {
    markers.systolicBloodPressureMmHg = src.systolicBloodPressureMmHg;
    hasAny = true;
  }
  if (src.diastolicBloodPressureMmHg !== null && src.diastolicBloodPressureMmHg !== undefined) {
    markers.diastolicBloodPressureMmHg = src.diastolicBloodPressureMmHg;
    hasAny = true;
  }
  if (src.ldlMgDl !== null && src.ldlMgDl !== undefined) {
    markers.ldlMgDl = src.ldlMgDl;
    hasAny = true;
  }
  if (src.glucoseMgDl !== null && src.glucoseMgDl !== undefined) {
    markers.glucoseMgDl = src.glucoseMgDl;
    hasAny = true;
  }
  if (src.hba1cPercent !== null && src.hba1cPercent !== undefined) {
    markers.hba1cPercent = src.hba1cPercent;
    hasAny = true;
  }
  if (src.heartRateBpm !== null && src.heartRateBpm !== undefined) {
    markers.heartRateBpm = src.heartRateBpm;
    hasAny = true;
  }
  if (src.restingHeartRateBpm !== null && src.restingHeartRateBpm !== undefined) {
    markers.restingHeartRateBpm = src.restingHeartRateBpm;
    hasAny = true;
  }
  if (src.smoker !== null && src.smoker !== undefined) {
    markers.smoker = src.smoker;
    hasAny = true;
  }
  if (src.onBloodPressureTreatment !== null && src.onBloodPressureTreatment !== undefined) {
    markers.onBloodPressureTreatment = src.onBloodPressureTreatment;
    hasAny = true;
  }
  if (src.hasDiabetes !== null && src.hasDiabetes !== undefined) {
    markers.hasDiabetes = src.hasDiabetes;
    hasAny = true;
  }
  if (src.hasHypertension !== null && src.hasHypertension !== undefined) {
    markers.hasHypertension = src.hasHypertension;
    hasAny = true;
  }

  return hasAny ? markers : undefined;
}
