import fs from 'node:fs';
import path from 'node:path';
import type { HealthInputs } from '@/lib/fhir';
import type { ClinicalMarkers } from './types';

const SYNTHEA_PATIENT_YEAR_PATH = path.join(process.cwd(), 'data', 'patient_year.csv');
const MIN_RELIABLE_COHORT_SIZE = 10;
const MAX_SELECTED_CANDIDATES = 30;

type SyntheaPatientYear = {
  patientId: string;
  age: number;
  sex: 'male' | 'female' | 'other' | 'unknown';
  sbp: number;
  dbp?: number;
  bmi: number;
  totalCholesterol: number;
  hdlCholesterol: number;
  smoker: boolean;
  diabetes: boolean;
  hypertension: boolean;
};

export type SyntheaMatchedEstimate = {
  markers: Required<Pick<ClinicalMarkers, 'systolicBloodPressureMmHg' | 'totalCholesterolMgDl' | 'hdlMgDl' | 'hasDiabetes' | 'onBloodPressureTreatment'>>;
  matchedCohortSize: number;
  relaxedFiltersUsed: string[];
  estimationMethod: 'rule-based matched cohort median';
  warnings: string[];
};

export function estimateClinicalMarkersFromMatchedSynthea(
  inputs: HealthInputs,
  userMarkers?: ClinicalMarkers
): SyntheaMatchedEstimate {
  const rows = loadSyntheaPatientYears();
  const bmi = getBmi(inputs);
  const userDiabetes = getUserProvidedDiabetes(inputs, userMarkers);
  const userSmoker = inputs.smokingStatus === 'current';
  const sex = inputs.sex;
  const relaxedFiltersUsed: string[] = [];
  const warnings: string[] = [];

  let filterState = {
    matchSmoking: true,
    ageWindow: 10,
    bmiWindow: 5,
    matchDiabetes: userDiabetes !== undefined
  };

  let candidates = filterCandidates(rows, inputs.age, sex, bmi, userSmoker, userDiabetes, filterState);

  if (candidates.length < MIN_RELIABLE_COHORT_SIZE) {
    filterState = { ...filterState, matchSmoking: false };
    relaxedFiltersUsed.push('relaxed smoking match');
    candidates = filterCandidates(rows, inputs.age, sex, bmi, userSmoker, userDiabetes, filterState);
  }

  if (candidates.length < MIN_RELIABLE_COHORT_SIZE) {
    filterState = { ...filterState, ageWindow: 15 };
    relaxedFiltersUsed.push('age window expanded to +/-15 years');
    candidates = filterCandidates(rows, inputs.age, sex, bmi, userSmoker, userDiabetes, filterState);
  }

  if (candidates.length < MIN_RELIABLE_COHORT_SIZE) {
    filterState = { ...filterState, bmiWindow: 7 };
    relaxedFiltersUsed.push('BMI window expanded to +/-7 kg/m2');
    candidates = filterCandidates(rows, inputs.age, sex, bmi, userSmoker, userDiabetes, filterState);
  }

  if (candidates.length < MIN_RELIABLE_COHORT_SIZE && filterState.matchDiabetes) {
    filterState = { ...filterState, matchDiabetes: false };
    relaxedFiltersUsed.push('relaxed diabetes match');
    candidates = filterCandidates(rows, inputs.age, sex, bmi, userSmoker, userDiabetes, filterState);
  }

  if (candidates.length === 0) {
    throw new Error('No Synthea matched cohort was found for biomarker estimation.');
  }

  const selected = candidates
    .sort((a, b) => {
      const ageDelta = Math.abs(a.age - inputs.age) - Math.abs(b.age - inputs.age);
      if (ageDelta !== 0) return ageDelta;
      const bmiDelta = Math.abs(a.bmi - bmi) - Math.abs(b.bmi - bmi);
      if (bmiDelta !== 0) return bmiDelta;
      return a.patientId.localeCompare(b.patientId);
    })
    .slice(0, MAX_SELECTED_CANDIDATES);

  if (selected.length < MIN_RELIABLE_COHORT_SIZE) {
    warnings.push(`Matched Synthea cohort has ${selected.length} candidates, below the preferred threshold of ${MIN_RELIABLE_COHORT_SIZE}.`);
  }

  warnings.push(
    'Missing biomarkers are estimated from a rule-based matched cohort of similar synthetic Synthea patients. This is an explainable prototype estimation method, not a validated clinical prediction model.'
  );

  return {
    markers: {
      systolicBloodPressureMmHg: median(selected.map((row) => row.sbp)),
      totalCholesterolMgDl: median(selected.map((row) => row.totalCholesterol)),
      hdlMgDl: median(selected.map((row) => row.hdlCholesterol)),
      hasDiabetes: majority(selected.map((row) => row.diabetes)),
      onBloodPressureTreatment: majority(selected.map((row) => row.hypertension))
    },
    matchedCohortSize: selected.length,
    relaxedFiltersUsed,
    estimationMethod: 'rule-based matched cohort median',
    warnings
  };
}

function filterCandidates(
  rows: SyntheaPatientYear[],
  age: number,
  sex: HealthInputs['sex'],
  bmi: number,
  smoker: boolean,
  diabetes: boolean | undefined,
  filterState: {
    matchSmoking: boolean;
    ageWindow: number;
    bmiWindow: number;
    matchDiabetes: boolean;
  }
) {
  return rows.filter((row) => {
    if (row.sex !== sex) return false;
    if (Math.abs(row.age - age) > filterState.ageWindow) return false;
    if (Math.abs(row.bmi - bmi) > filterState.bmiWindow) return false;
    if (filterState.matchSmoking && row.smoker !== smoker) return false;
    if (filterState.matchDiabetes && diabetes !== undefined && row.diabetes !== diabetes) return false;
    return true;
  });
}

let cachedRows: SyntheaPatientYear[] | null = null;

function loadSyntheaPatientYears() {
  if (cachedRows) return cachedRows;

  const content = fs.readFileSync(SYNTHEA_PATIENT_YEAR_PATH, 'utf8');
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  cachedRows = lines.flatMap((line) => parsePatientYearLine(headers, line));
  return cachedRows;
}

function parsePatientYearLine(headers: string[], line: string): SyntheaPatientYear[] {
  const values = line.split(',');
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  const age = parseNumber(row.age);
  const bmi = parseNumber(row.BMI);
  const sbp = parseNumber(row.SBP);
  const totalCholesterol = parseNumber(row.total_chol);
  const hdlCholesterol = parseNumber(row.HDL);

  if (
    row.patient_id === undefined ||
    row.sex === undefined ||
    age === undefined ||
    bmi === undefined ||
    sbp === undefined ||
    totalCholesterol === undefined ||
    hdlCholesterol === undefined
  ) {
    return [];
  }

  return [
    {
      patientId: row.patient_id,
      age,
      sex: normalizeSex(row.sex),
      sbp,
      dbp: parseNumber(row.DBP),
      bmi,
      totalCholesterol,
      hdlCholesterol,
      smoker: parseBoolean(row.smoker),
      diabetes: parseBoolean(row.diabetes),
      hypertension: parseBoolean(row.hypertension)
    }
  ];
}

function normalizeSex(value: string): SyntheaPatientYear['sex'] {
  if (value === 'male' || value === 'female') return value;
  if (value === 'other') return 'other';
  return 'unknown';
}

function parseNumber(value: string | undefined) {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined) {
  return value?.toLowerCase() === 'true';
}

function getBmi(inputs: Pick<HealthInputs, 'heightCm' | 'weightKg'>) {
  return inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
}

function getUserProvidedDiabetes(inputs: HealthInputs, userMarkers?: ClinicalMarkers) {
  if (typeof userMarkers?.hasDiabetes === 'boolean') return userMarkers.hasDiabetes;
  if (inputs.existingConditions.some((condition) => /diabetes/i.test(condition))) return true;
  return undefined;
}

function median(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 10) / 10;
}

function majority(values: boolean[]) {
  const trueCount = values.filter(Boolean).length;
  return trueCount >= values.length / 2;
}
