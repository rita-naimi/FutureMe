import type { HealthInputs } from '@/lib/fhir';
import { buildRiskEvidence } from './risk-evidence';
import type {
  BiomarkerEffect,
  ClinicalMarkers,
  NormalizedHealthState,
  SyntheaModelState,
  TrajectoryOutput,
  TrajectoryPoint
} from './types';
import { listMissingSyntheaModelFields, toSyntheaModelState } from './normalized-state';
import { generateTrainedTrajectory } from './trained-trajectory';

export type CompleteTrajectoryState = TrajectoryPoint['biomarkers'] & {
  age: number;
  sex: 'male' | 'female' | 'other' | 'unknown';
  heightCm: number;
  sleepHours?: number;
};

const DEFAULT_START_YEAR = 2026;
const DEFAULT_END_YEAR = 2046;

export const trajectoryBiomarkerEffects: BiomarkerEffect[] = [
  {
    scenarioId: 'stop_smoking',
    label: 'Stop smoking',
    metric: 'smoker',
    totalDelta: false,
    horizonWeeks: 0,
    confidence: 'high'
  },
  {
    scenarioId: 'structured_exercise',
    label: 'Structured exercise: systolic blood pressure',
    metric: 'systolicBloodPressure',
    totalDelta: -4.15,
    horizonWeeks: 12,
    confidence: 'high'
  },
  {
    scenarioId: 'structured_exercise',
    label: 'Structured exercise: total cholesterol',
    metric: 'totalCholesterol',
    totalDelta: -5.9,
    horizonWeeks: 12,
    confidence: 'high'
  },
  {
    scenarioId: 'structured_exercise',
    label: 'Structured exercise: HDL cholesterol',
    metric: 'hdlCholesterol',
    totalDelta: 2.11,
    horizonWeeks: 12,
    confidence: 'high'
  },
  {
    scenarioId: 'structured_exercise',
    label: 'Structured exercise: BMI',
    metric: 'bmi',
    totalDelta: -0.68,
    horizonWeeks: 12,
    confidence: 'medium'
  },
  {
    scenarioId: 'sleep_improvement',
    label: 'Sleep improvement for short sleepers',
    metric: 'systolicBloodPressure',
    totalDelta: -5,
    horizonWeeks: 12,
    confidence: 'medium'
  },
  {
    scenarioId: 'stress_reduction',
    label: 'MBSR / stress reduction',
    metric: 'systolicBloodPressure',
    totalDelta: -6.64,
    horizonWeeks: 8,
    confidence: 'high'
  }
];

export function progressAtWeek(week: number, horizonWeeks: number) {
  if (horizonWeeks <= 0) return week >= 0 ? 1 : 0;
  const x = Math.min(1, Math.max(0, week / horizonWeeks));
  return x * x * (3 - 2 * x);
}

export function effectAtWeek(totalDelta: number, week: number, horizonWeeks: number) {
  return totalDelta * progressAtWeek(week, horizonWeeks);
}

export async function buildTrajectoryOutput(
  normalizedState: NormalizedHealthState,
  inputs: HealthInputs,
  markers: ClinicalMarkers,
  options?: {
    startYear?: number;
    endYear?: number;
  }
): Promise<TrajectoryOutput> {
  const startYear = options?.startYear ?? DEFAULT_START_YEAR;
  const endYear = options?.endYear ?? DEFAULT_END_YEAR;
  const syntheaModelInput = toSyntheaModelState(normalizedState);
  const completedState = completeTrajectoryState(syntheaModelInput, inputs, markers);
  const trained = await generateTrainedTrajectory(completedState, startYear, endYear);
  const baseline = trained
    ? trained.points.map((point) =>
        makeTrajectoryPoint(point.year, {
          ...completedState,
          age: point.age,
          ...point.biomarkers
        })
      )
    : generateBaselineTrajectory(completedState, startYear, endYear);
  const warnings = trained
    ? [
        'Baseline trajectory comes from the exported Synthea-trained Gradient Boosting model.',
        'The LLM only explains these curves; it does not generate medical predictions.'
      ]
    : [
        'Current trajectory model is a deterministic Synthea-compatible transition surrogate because the trained exported model was not available.',
        'The LLM only explains these curves; it does not generate medical predictions.'
      ];

  const metrics = trained?.metadata?.metrics;
  if (metrics) {
    warnings.push(
      `Training eval MAE: SBP ${formatMetric(metrics.SBP_next_mae)} mmHg, BMI ${formatMetric(metrics.BMI_next_mae)}, glucose ${formatMetric(metrics.glucose_next_mae)} mg/dL.`
    );
  }

  const interventions = (['stop_smoking', 'structured_exercise', 'sleep_improvement', 'stress_reduction'] as const).map((scenarioId) => {
    const effects = trajectoryBiomarkerEffects.filter((effect) => effect.scenarioId === scenarioId);
    const result = applyInterventionToBaseline(baseline, completedState, scenarioId, effects, startYear);
    return {
      scenarioId,
      label: scenarioLabel(scenarioId),
      effects,
      curve: result.curve,
      warnings: result.warnings
    };
  });

  return {
    model: trained ? 'synthea_gradient_boosting_v1' : 'synthea_proxy_transition_v0',
    startYear,
    endYear,
    normalizedState,
    syntheaModelInput,
    missingModelFields: listMissingSyntheaModelFields(syntheaModelInput),
    baseline,
    interventions,
    warnings
  };
}

function generateBaselineTrajectory(initial: CompleteTrajectoryState, startYear: number, endYear: number): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  let state = { ...initial };

  for (let year = startYear; year <= endYear; year += 1) {
    points.push(makeTrajectoryPoint(year, state));
    state = predictNextYear(state);
  }

  return points;
}

function predictNextYear(state: CompleteTrajectoryState): CompleteTrajectoryState {
  const bmiAboveHealthy = Math.max(0, state.bmi - 25);
  const smokerPenalty = state.smoker ? 1 : 0;
  const diabetesPenalty = state.diabetes ? 1 : 0;
  const hypertensionPenalty = state.hypertension ? 1 : 0;

  const systolicBloodPressure = clamp(
    state.systolicBloodPressure + 0.45 + bmiAboveHealthy * 0.08 + smokerPenalty * 0.35 + diabetesPenalty * 0.25 + hypertensionPenalty * 0.2,
    90,
    220
  );
  const totalCholesterol = clamp(
    state.totalCholesterol + 0.9 + bmiAboveHealthy * 0.18 + smokerPenalty * 0.7 + diabetesPenalty * 0.4,
    100,
    350
  );
  const hdlCholesterol = clamp(state.hdlCholesterol - 0.15 - smokerPenalty * 0.18 + Math.max(0, 24 - state.bmi) * 0.03, 20, 120);
  const bmi = clamp(state.bmi + 0.07 + smokerPenalty * 0.03 + diabetesPenalty * 0.02, 16, 60);
  const glucose = clamp(state.glucose + 0.45 + bmiAboveHealthy * 0.12 + diabetesPenalty * 1.05, 65, 300);

  return {
    ...state,
    age: state.age + 1,
    systolicBloodPressure: round1(systolicBloodPressure),
    diastolicBloodPressure: round1(clamp(state.diastolicBloodPressure + 0.18 + bmiAboveHealthy * 0.03, 50, 140)),
    bmi: round1(bmi),
    totalCholesterol: round1(totalCholesterol),
    hdlCholesterol: round1(hdlCholesterol),
    glucose: round1(glucose),
    diabetes: state.diabetes || glucose >= 126,
    hypertension: state.hypertension || systolicBloodPressure >= 130
  };
}

function applyInterventionToBaseline(
  baseline: TrajectoryPoint[],
  initial: CompleteTrajectoryState,
  scenarioId: BiomarkerEffect['scenarioId'],
  effects: BiomarkerEffect[],
  startYear: number
): { curve: TrajectoryPoint[]; warnings: string[] } {
  const warnings: string[] = [];

  if (scenarioId === 'sleep_improvement' && (initial.sleepHours === undefined || initial.sleepHours >= 7)) {
    warnings.push('Sleep improvement effect skipped because the user is not a short sleeper.');
  }

  const curve = baseline.map((point) => {
    const week = (point.year - startYear) * 52;
    const updated = { ...point.biomarkers };

    effects.forEach((effect) => {
      if (effect.scenarioId === 'sleep_improvement' && (initial.sleepHours === undefined || initial.sleepHours >= 7)) return;

      if (effect.metric === 'smoker') {
        updated.smoker = effect.totalDelta as boolean;
        return;
      }

      if (typeof effect.totalDelta !== 'number') return;
      const delta = effectAtWeek(effect.totalDelta, week, effect.horizonWeeks);
      applyNumericMetricDelta(updated, effect.metric, delta);
    });

    return makeTrajectoryPoint(point.year, {
      ...initial,
      age: point.age,
      ...updated
    });
  });

  return { curve, warnings };
}

function applyNumericMetricDelta(
  biomarkers: TrajectoryPoint['biomarkers'],
  metric: Exclude<BiomarkerEffect['metric'], 'smoker'>,
  delta: number
) {
  if (metric === 'systolicBloodPressure') {
    biomarkers.systolicBloodPressure = round1(clamp(biomarkers.systolicBloodPressure + delta, 90, 220));
  }
  if (metric === 'diastolicBloodPressure') {
    biomarkers.diastolicBloodPressure = round1(clamp(biomarkers.diastolicBloodPressure + delta, 50, 140));
  }
  if (metric === 'bmi') {
    biomarkers.bmi = round1(clamp(biomarkers.bmi + delta, 16, 60));
  }
  if (metric === 'totalCholesterol') {
    biomarkers.totalCholesterol = round1(clamp(biomarkers.totalCholesterol + delta, 100, 350));
  }
  if (metric === 'hdlCholesterol') {
    biomarkers.hdlCholesterol = round1(clamp(biomarkers.hdlCholesterol + delta, 20, 120));
  }
  if (metric === 'glucose') {
    biomarkers.glucose = round1(clamp(biomarkers.glucose + delta, 65, 300));
  }
}

function makeTrajectoryPoint(year: number, state: CompleteTrajectoryState): TrajectoryPoint {
  const riskEvidence = buildRiskEvidence(toHealthInputs(state), {
    systolicBloodPressureMmHg: state.systolicBloodPressure,
    diastolicBloodPressureMmHg: state.diastolicBloodPressure,
    totalCholesterolMgDl: state.totalCholesterol,
    hdlMgDl: state.hdlCholesterol,
    glucoseMgDl: state.glucose,
    hasDiabetes: state.diabetes,
    hasHypertension: state.hypertension,
    onBloodPressureTreatment: state.hypertension
  });

  return {
    year,
    age: state.age,
    biomarkers: {
      systolicBloodPressure: round1(state.systolicBloodPressure),
      diastolicBloodPressure: round1(state.diastolicBloodPressure),
      bmi: round1(state.bmi),
      totalCholesterol: round1(state.totalCholesterol),
      hdlCholesterol: round1(state.hdlCholesterol),
      glucose: round1(state.glucose),
      smoker: state.smoker,
      diabetes: state.diabetes,
      hypertension: state.hypertension
    },
    cardiovascularRiskPercent: riskEvidence.framingham10YearRiskPercent,
    riskEvidence
  };
}

function completeTrajectoryState(
  syntheaState: SyntheaModelState,
  inputs: HealthInputs,
  markers: ClinicalMarkers
): CompleteTrajectoryState {
  const bmi = syntheaState.BMI ?? inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const systolicBloodPressure = syntheaState.SBP ?? markers.systolicBloodPressureMmHg ?? estimateSbp(inputs, bmi);
  const diabetes = syntheaState.diabetes ?? markers.hasDiabetes ?? inputs.familyHistoryDiabetes;

  return {
    age: syntheaState.age,
    sex: syntheaState.sex,
    heightCm: inputs.heightCm,
    sleepHours: inputs.sleepHours,
    systolicBloodPressure: round1(systolicBloodPressure),
    diastolicBloodPressure: round1(syntheaState.DBP ?? markers.diastolicBloodPressureMmHg ?? systolicBloodPressure * 0.62),
    bmi: round1(bmi),
    totalCholesterol: round1(syntheaState.total_chol ?? markers.totalCholesterolMgDl ?? estimateTotalCholesterol(inputs, bmi)),
    hdlCholesterol: round1(syntheaState.HDL ?? markers.hdlMgDl ?? estimateHdl(inputs, bmi)),
    glucose: round1(syntheaState.glucose ?? markers.glucoseMgDl ?? estimateGlucose(inputs, bmi, diabetes)),
    smoker: syntheaState.smoker ?? inputs.smokingStatus === 'current',
    diabetes,
    hypertension: syntheaState.hypertension ?? markers.hasHypertension ?? markers.onBloodPressureTreatment ?? systolicBloodPressure >= 130
  };
}

function toHealthInputs(state: CompleteTrajectoryState): HealthInputs {
  const heightM = state.heightCm / 100;
  const weightKg = round1(state.bmi * heightM * heightM);
  const existingConditions = [
    state.diabetes ? 'diabetes' : undefined,
    state.hypertension ? 'hypertension' : undefined
  ].filter((condition): condition is string => Boolean(condition));

  return {
    name: 'Future trajectory state',
    age: state.age,
    sex: state.sex === 'unknown' ? 'other' : state.sex,
    heightCm: state.heightCm,
    weightKg,
    sleepHours: state.sleepHours ?? 7,
    exerciseDaysPerWeek: 2,
    dietQuality: 3,
    stressLevel: 3,
    smokingStatus: state.smoker ? 'current' : 'never',
    alcoholDrinksPerWeek: 0,
    familyHistoryHeart: false,
    familyHistoryDiabetes: state.diabetes,
    familyHistoryCancer: false,
    existingConditions
  };
}

function estimateSbp(inputs: HealthInputs, bmi: number) {
  return clamp(112 + Math.max(0, inputs.age - 35) * 0.45 + Math.max(0, bmi - 24) * 1.2 + inputs.stressLevel * 1.6, 95, 185);
}

function estimateTotalCholesterol(inputs: HealthInputs, bmi: number) {
  return clamp(175 + Math.max(0, bmi - 23) * 2.4 + (5 - inputs.dietQuality) * 5, 130, 290);
}

function estimateHdl(inputs: HealthInputs, bmi: number) {
  return clamp((inputs.sex === 'female' ? 62 : 52) - Math.max(0, bmi - 24) * 0.9 - (inputs.smokingStatus === 'current' ? 6 : 0), 30, 95);
}

function estimateGlucose(inputs: HealthInputs, bmi: number, diabetes: boolean) {
  return clamp((diabetes ? 128 : 92) + Math.max(0, bmi - 25) * 1.1 + (inputs.dietQuality < 3 ? 4 : 0), 70, 220);
}

function scenarioLabel(scenarioId: BiomarkerEffect['scenarioId']) {
  if (scenarioId === 'stop_smoking') return 'Stop smoking';
  if (scenarioId === 'structured_exercise') return 'Structured exercise';
  if (scenarioId === 'sleep_improvement') return 'Sleep improvement';
  return 'MBSR / stress reduction';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatMetric(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : 'n/a';
}
