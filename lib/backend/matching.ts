import type { HealthInputs } from '@/lib/fhir';
import type { HistoryYears, SyntheticMatch } from './types';
import { ALEX_PERSONA } from '@/data/synthea/alex';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { MAYA_PERSONA } from '@/data/synthea/maya';
import { loadSyntheaBundles } from './syntheaFhir';

const SEED_COHORT: Array<{ syntheticId: string; inputs: HealthInputs }> = [
  { syntheticId: 'synthea-alex-seed', inputs: ALEX_PERSONA },
  { syntheticId: 'synthea-james-seed', inputs: JAMES_PERSONA },
  { syntheticId: 'synthea-maya-seed', inputs: MAYA_PERSONA }
];

function getSyntheaCohort() {
  const bundles = loadSyntheaBundles();
  if (bundles.length > 0) {
    return bundles.map((item: { syntheticId: string; inputs: HealthInputs }) => ({
      syntheticId: item.syntheticId,
      inputs: item.inputs,
      source: 'synthea-fhir' as const
    }));
  }

  return SEED_COHORT.map((item) => ({ ...item, source: 'synthea-seed' as const }));
}

const NORMALIZATION = {
  age: 90,
  bmi: 20,
  sleep: 6,
  exercise: 7,
  diet: 5,
  stress: 5,
  alcohol: 30
};

function bmi(inputs: HealthInputs) {
  return inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
}

function boolDistance(a: boolean, b: boolean) {
  return a === b ? 0 : 1;
}

function smokingDistance(a: HealthInputs['smokingStatus'], b: HealthInputs['smokingStatus']) {
  const order: Record<HealthInputs['smokingStatus'], number> = { never: 0, former: 1, current: 2 };
  return Math.abs(order[a] - order[b]) / 2;
}

function sexDistance(a: HealthInputs['sex'], b: HealthInputs['sex']) {
  return a === b ? 0 : 1;
}

function normalizedAbs(a: number, b: number, scale: number) {
  return Math.abs(a - b) / scale;
}

function computeDistance(real: HealthInputs, synthetic: HealthInputs) {
  const terms = [
    normalizedAbs(real.age, synthetic.age, NORMALIZATION.age),
    sexDistance(real.sex, synthetic.sex),
    normalizedAbs(bmi(real), bmi(synthetic), NORMALIZATION.bmi),
    normalizedAbs(real.sleepHours, synthetic.sleepHours, NORMALIZATION.sleep),
    normalizedAbs(real.exerciseDaysPerWeek, synthetic.exerciseDaysPerWeek, NORMALIZATION.exercise),
    normalizedAbs(real.dietQuality, synthetic.dietQuality, NORMALIZATION.diet),
    normalizedAbs(real.stressLevel, synthetic.stressLevel, NORMALIZATION.stress),
    smokingDistance(real.smokingStatus, synthetic.smokingStatus),
    normalizedAbs(real.alcoholDrinksPerWeek, synthetic.alcoholDrinksPerWeek, NORMALIZATION.alcohol),
    boolDistance(real.familyHistoryHeart, synthetic.familyHistoryHeart),
    boolDistance(real.familyHistoryDiabetes, synthetic.familyHistoryDiabetes),
    boolDistance(real.familyHistoryCancer, synthetic.familyHistoryCancer)
  ];

  return terms.reduce((sum, term) => sum + term, 0) / terms.length;
}

export function getSyntheaSeedCandidates() {
  return getSyntheaCohort();
}

export function findNearestSyntheticPatients(
  real: HealthInputs,
  yearsOfHistory: HistoryYears,
  kNearest = 3
): SyntheticMatch[] {
  const cohort = getSyntheaCohort();
  const boundedK = Math.max(1, Math.min(kNearest, cohort.length));

  return cohort
    .map(({ syntheticId, inputs, source }: { syntheticId: string; inputs: HealthInputs; source: 'synthea-fhir' | 'synthea-seed' }) => {
      const distance = Number(computeDistance(real, inputs).toFixed(4));
      return {
        syntheticId,
        name: inputs.name,
        distance,
        similarity: Number((1 - distance).toFixed(4)),
        historyYears: yearsOfHistory,
        source,
        inputs
      };
    })
    .sort((a: SyntheticMatch, b: SyntheticMatch) => a.distance - b.distance)
    .slice(0, boundedK);
}
