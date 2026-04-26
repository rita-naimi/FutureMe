import { calculateCardioRisk } from '@/lib/riskCalculator';
import type { AppliedEffect, CompletedMedicalProfile, ScenarioResult } from '@/types/medical';

export type ProjectionPoint = {
  label: 'Today' | '3 months' | '1 year' | '5 years' | '10 years';
  yearsFromNow: number;
  age: number;
  risk: number;
  profile: CompletedMedicalProfile;
};

export type RiskProjection = {
  baseline: ProjectionPoint[];
  intervention?: ProjectionPoint[];
  assumptions: string[];
};

export type BiomarkerTrajectoryPoint = {
  week: number;
  value: number;
};

export type BiomarkerInterventionTrajectory = {
  biomarker: AppliedEffect['biomarker'];
  label: string;
  unit: string;
  before: number;
  after: number;
  delta: number;
  confidence: AppliedEffect['confidence'];
  timeHorizon: string;
  displayHorizon: string;
  source: string;
  totalWeeks: number;
  xAxisTicks: number[];
  points: BiomarkerTrajectoryPoint[];
};

export type CategoricalTransition = {
  biomarker: AppliedEffect['biomarker'];
  label: string;
  before: boolean;
  after: boolean;
  confidence: AppliedEffect['confidence'];
  timeHorizon: string;
  source: string;
};

const PROJECTION_POINTS = [
  { label: 'Today', yearsFromNow: 0 },
  { label: '3 months', yearsFromNow: 0.25 },
  { label: '1 year', yearsFromNow: 1 },
  { label: '5 years', yearsFromNow: 5 },
  { label: '10 years', yearsFromNow: 10 }
] as const;

const FRAMINGHAM_MIN_AGE = 30;
const FRAMINGHAM_MAX_AGE = 74;

const NUMERIC_TRAJECTORY_BIOMARKERS = new Set<AppliedEffect['biomarker']>([
  'systolicBloodPressure',
  'totalCholesterol',
  'hdlCholesterol',
  'bmi'
]);

export function generateRiskProjection(profile: CompletedMedicalProfile, scenarioResult?: ScenarioResult): RiskProjection {
  const assumptions = [
    'Baseline projection keeps biomarkers constant and recalculates Framingham risk as age changes.',
    'Intervention projection applies evidence-backed biomarker changes once, then assumes the improved profile is maintained.'
  ];

  const baseline = PROJECTION_POINTS.map((point) => buildProjectionPoint(profile, point, profile.age));
  const usedAgeConstraint = baseline.some((point) => point.profile.age !== getFraminghamCalculationAge(point.age));

  if (!scenarioResult?.appliedEffects.length) {
    if (usedAgeConstraint) assumptions.push(getAgeConstraintAssumption());
    return { baseline, assumptions };
  }

  const intervention = PROJECTION_POINTS.map((point, index) => {
    const sourceProfile = index === 0 ? scenarioResult.currentProfile : scenarioResult.simulatedProfile;
    return buildProjectionPoint(sourceProfile, point, profile.age);
  });
  const interventionUsedAgeConstraint = intervention.some(
    (point) => point.profile.age !== getFraminghamCalculationAge(point.age)
  );

  if (usedAgeConstraint || interventionUsedAgeConstraint) assumptions.push(getAgeConstraintAssumption());

  return {
    baseline,
    intervention,
    assumptions
  };
}

export function buildBiomarkerInterventionTrajectories(scenarioResult?: ScenarioResult): BiomarkerInterventionTrajectory[] {
  if (!scenarioResult) return [];

  return scenarioResult.appliedEffects
    .filter(isNumericTrajectoryEffect)
    .map((effect) => {
      const before = Number(effect.before);
      const after = Number(effect.after);
      const totalWeeks = getInterventionWeeks(effect);
      const denominator = 1 - Math.exp(-3);
      const points = Array.from({ length: totalWeeks + 1 }, (_, week) => {
        const progress = week === totalWeeks ? 1 : (1 - Math.exp((-3 * week) / totalWeeks)) / denominator;
        return {
          week,
          value: round2(before + (after - before) * progress)
        };
      });

      points[points.length - 1] = {
        week: totalWeeks,
        value: round2(after)
      };

      return {
        biomarker: effect.biomarker,
        label: getEffectDisplayLabel(effect),
        unit: effect.unit ?? '',
        before,
        after,
        delta: round2(after - before),
        confidence: effect.confidence,
        timeHorizon: effect.timeHorizon,
        displayHorizon: getDisplayTimeHorizon(effect),
        source: effect.source,
        totalWeeks,
        xAxisTicks: getTrajectoryTicks(totalWeeks),
        points
      };
    });
}

export function buildCategoricalTransitions(scenarioResult?: ScenarioResult): CategoricalTransition[] {
  if (!scenarioResult) return [];

  return scenarioResult.appliedEffects
    .filter((effect) => typeof effect.before === 'boolean' && typeof effect.after === 'boolean')
    .map((effect) => ({
      biomarker: effect.biomarker,
      label: getEffectDisplayLabel(effect),
      before: Boolean(effect.before),
      after: Boolean(effect.after),
      confidence: effect.confidence,
      timeHorizon: effect.timeHorizon,
      source: effect.source
    }));
}

function buildProjectionPoint(
  sourceProfile: CompletedMedicalProfile,
  point: (typeof PROJECTION_POINTS)[number],
  currentAge: number
): ProjectionPoint {
  const age = round2(currentAge + point.yearsFromNow);
  const profile = {
    ...sourceProfile,
    age
  };
  const calculationProfile = {
    ...profile,
    age: getFraminghamCalculationAge(age)
  };

  return {
    label: point.label,
    yearsFromNow: point.yearsFromNow,
    age,
    risk: calculateCardioRisk(calculationProfile),
    profile
  };
}

function isNumericTrajectoryEffect(effect: AppliedEffect) {
  return (
    NUMERIC_TRAJECTORY_BIOMARKERS.has(effect.biomarker) &&
    typeof effect.before === 'number' &&
    typeof effect.after === 'number'
  );
}

function getInterventionWeeks(effect: AppliedEffect) {
  if (effect.scenarioId === 'stress_reduction') return 8;
  if (effect.scenarioId === 'sleep_improvement') return 12;
  return 12;
}

function getDisplayTimeHorizon(effect: AppliedEffect) {
  if (effect.scenarioId === 'sleep_improvement') return '3-16 weeks in evidence';
  if (effect.scenarioId === 'stress_reduction') return '8 weeks';
  return '12 weeks';
}

function getTrajectoryTicks(totalWeeks: number) {
  return [0, 2, 4, 8, 12].filter((week) => week <= totalWeeks);
}

function getEffectDisplayLabel(effect: AppliedEffect) {
  if (effect.biomarker === 'systolicBloodPressure') return 'Systolic blood pressure';
  if (effect.biomarker === 'totalCholesterol') return 'Total cholesterol';
  if (effect.biomarker === 'hdlCholesterol') return 'HDL cholesterol';
  if (effect.biomarker === 'bmi') return 'BMI';
  if (effect.biomarker === 'smoker') return 'Smoking status';
  return effect.label;
}

function getFraminghamCalculationAge(age: number) {
  return Math.max(FRAMINGHAM_MIN_AGE, Math.min(FRAMINGHAM_MAX_AGE, age));
}

function getAgeConstraintAssumption() {
  return 'Framingham calculation age is constrained to 30-74 when a projected age falls outside the published equation range.';
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
