import type { HealthInputs } from '@/lib/fhir';
import type { ClinicalMarkers, HistoryYears, SyntheticMatch } from './types';
import { ALEX_PERSONA } from '@/data/synthea/alex';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { MAYA_PERSONA } from '@/data/synthea/maya';
import { loadSyntheaBundles } from './syntheaFhir';

interface CohortEntry {
  syntheticId: string;
  inputs: HealthInputs;
  source: 'synthea-fhir' | 'synthea-seed';
  clinicalMarkers?: ClinicalMarkers;
}

export interface RuleBasedMatchResult {
  selected: SyntheticMatch[];
  totalCandidates: number;
  relaxedFiltersUsed: string[];
  warnings: string[];
}

interface MatchFilters {
  relaxSmoking: boolean;
  ageWindowYears: number;
  bmiWindow: number;
  relaxDiabetes: boolean;
}

const SEED_COHORT: Array<{ syntheticId: string; inputs: HealthInputs }> = [
  { syntheticId: 'synthea-alex-seed', inputs: ALEX_PERSONA },
  { syntheticId: 'synthea-james-seed', inputs: JAMES_PERSONA },
  { syntheticId: 'synthea-maya-seed', inputs: MAYA_PERSONA }
];

const RELAXATION_STEPS: MatchFilters[] = [
  { relaxSmoking: false, ageWindowYears: 10, bmiWindow: 5, relaxDiabetes: false },
  { relaxSmoking: true, ageWindowYears: 10, bmiWindow: 5, relaxDiabetes: false },
  { relaxSmoking: true, ageWindowYears: 15, bmiWindow: 5, relaxDiabetes: false },
  { relaxSmoking: true, ageWindowYears: 15, bmiWindow: 7, relaxDiabetes: false },
  { relaxSmoking: true, ageWindowYears: 15, bmiWindow: 7, relaxDiabetes: true }
];

function getSyntheaCohort(): CohortEntry[] {
  const bundles = loadSyntheaBundles();
  if (bundles.length > 0) {
    return bundles.map((item) => ({
      syntheticId: item.syntheticId,
      inputs: item.inputs,
      source: 'synthea-fhir' as const,
      clinicalMarkers: item.clinicalMarkers
    }));
  }

  return SEED_COHORT.map((item) => ({ ...item, source: 'synthea-seed' as const }));
}

function bmi(inputs: Pick<HealthInputs, 'heightCm' | 'weightKg'>) {
  return inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
}

function candidateHasMatchingDiabetes(
  candidate: CohortEntry,
  userDiabetes: boolean | undefined,
  relaxDiabetes: boolean
) {
  if (userDiabetes === undefined || relaxDiabetes) return true;
  return candidate.clinicalMarkers?.hasDiabetes === userDiabetes;
}

function matchesFilters(real: HealthInputs, candidate: CohortEntry, filters: MatchFilters, userDiabetes?: boolean) {
  const candidateInputs = candidate.inputs;

  if (candidateInputs.sex !== real.sex) return false;
  if (Math.abs(candidateInputs.age - real.age) > filters.ageWindowYears) return false;
  if (Math.abs(bmi(candidateInputs) - bmi(real)) > filters.bmiWindow) return false;
  if (!filters.relaxSmoking && candidateInputs.smokingStatus !== real.smokingStatus) return false;
  if (!candidateHasMatchingDiabetes(candidate, userDiabetes, filters.relaxDiabetes)) return false;

  return true;
}

function getRelaxedFiltersUsed(filters: MatchFilters) {
  const relaxed: string[] = [];

  if (filters.relaxSmoking) relaxed.push('smoking');
  if (filters.ageWindowYears > 10) relaxed.push('age ±15 years');
  if (filters.bmiWindow > 5) relaxed.push('BMI ±7 kg/m2');
  if (filters.relaxDiabetes) relaxed.push('diabetes');

  return relaxed;
}

function toSyntheticMatch(entry: CohortEntry, historyYears: HistoryYears): SyntheticMatch {
  return {
    syntheticId: entry.syntheticId,
    name: entry.inputs.name,
    historyYears,
    source: entry.source,
    inputs: entry.inputs,
    clinicalMarkers: entry.clinicalMarkers
  };
}

export function getSyntheaSeedCandidates() {
  return getSyntheaCohort();
}

export function retroProjectInputs(real: HealthInputs, yearsBack: number): HealthInputs {
  const projectedAge = Math.max(1, real.age - yearsBack);

  return {
    ...real,
    age: projectedAge,
    existingConditions: []
  };
}

export function findRuleBasedSyntheticPatients(
  real: HealthInputs,
  yearsOfHistory: HistoryYears,
  options?: {
    userDiabetes?: boolean;
    minimumCohortSize?: number;
    maxCandidates?: number;
  }
): RuleBasedMatchResult {
  const cohort = getSyntheaCohort();
  const minimumCohortSize = options?.minimumCohortSize ?? 10;
  const maxCandidates = options?.maxCandidates ?? 30;
  let matched: CohortEntry[] = [];
  let filtersUsed = RELAXATION_STEPS[RELAXATION_STEPS.length - 1];

  for (const filters of RELAXATION_STEPS) {
    matched = cohort.filter((candidate) => matchesFilters(real, candidate, filters, options?.userDiabetes));
    filtersUsed = filters;
    if (matched.length >= minimumCohortSize) break;
  }

  const selected = matched.slice(0, maxCandidates).map((entry) => toSyntheticMatch(entry, yearsOfHistory));
  const warnings: string[] = [];

  if (selected.length === 0) {
    warnings.push('No Synthea candidates matched the rule-based cohort filters.');
  } else if (selected.length < minimumCohortSize) {
    warnings.push(
      `Matched Synthea cohort has ${selected.length} candidate(s), below the preferred ${minimumCohortSize}. Treat biomarker estimates as prototype-only.`
    );
  }

  return {
    selected,
    totalCandidates: cohort.length,
    relaxedFiltersUsed: getRelaxedFiltersUsed(filtersUsed),
    warnings
  };
}
