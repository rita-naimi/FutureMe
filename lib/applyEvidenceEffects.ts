import { evidenceEffects } from '@/lib/evidenceEffects';
import type { AppliedEffect, Biomarker, CompletedMedicalProfile, EvidenceEffect, UserInput } from '@/types/medical';

type NumericBiomarker = Exclude<Biomarker, 'smoker'>;

export const BIOMARKER_BOUNDS = {
  systolicBloodPressure: { min: 90, max: 220 },
  diastolicBloodPressure: { min: 50, max: 140 },
  totalCholesterol: { min: 100, max: 350 },
  hdlCholesterol: { min: 20, max: 120 },
  ldlCholesterol: { min: 30, max: 250 },
  triglycerides: { min: 30, max: 500 },
  bmi: { min: 16, max: 60 },
  hba1c: { min: 4, max: 14 }
} as const;

const COMBINED_EFFECT_WARNING =
  'Combined same-biomarker effects were conservatively aggregated to avoid double-counting. This is a modeling assumption, not a validated clinical formula.';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyEvidenceEffects(
  profile: CompletedMedicalProfile,
  userInput: UserInput,
  selectedScenarioIds: string[],
  options?: {
    mode?: 'individual' | 'combined';
  }
): {
  simulatedProfile: CompletedMedicalProfile;
  appliedEffects: AppliedEffect[];
  warnings: string[];
} {
  const mode = options?.mode ?? 'individual';
  const simulatedProfile: CompletedMedicalProfile = {
    ...profile,
    estimatedFromQuestionnaire: profile.estimatedFromQuestionnaire ? { ...profile.estimatedFromQuestionnaire } : undefined
  };
  const appliedEffects: AppliedEffect[] = [];
  const warnings: string[] = [];

  const selectedEffects = evidenceEffects.filter((effect) => selectedScenarioIds.includes(effect.scenarioId));
  const eligibleEffects: EvidenceEffect[] = [];

  selectedEffects.forEach((effect) => {
    if (effect.confidence === 'low') return;
    if (!isConditionSatisfied(effect, userInput)) {
      warnings.push(getSkippedConditionWarning(effect));
      return;
    }
    eligibleEffects.push(effect);
  });

  const effectsByBiomarker = eligibleEffects.reduce<Record<string, EvidenceEffect[]>>((grouped, effect) => {
    grouped[effect.biomarker] = grouped[effect.biomarker] ?? [];
    grouped[effect.biomarker].push(effect);
    return grouped;
  }, {});

  Object.values(effectsByBiomarker).forEach((effects) => {
    const biomarker = effects[0].biomarker;
    const booleanEffects = effects.filter((effect) => effect.deltaType === 'boolean');
    const numericEffects = effects.filter((effect) => effect.deltaType === 'absolute');

    booleanEffects.forEach((effect) => {
      applyBooleanEffect(simulatedProfile, effect, appliedEffects, warnings);
    });

    if (numericEffects.length === 0) return;

    if (numericEffects.length === 1) {
      applySingleNumericEffect(simulatedProfile, numericEffects[0], appliedEffects, warnings);
      return;
    }

    if (mode === 'combined') {
      applyCombinedNumericEffects(simulatedProfile, biomarker, numericEffects, appliedEffects, warnings);
      return;
    }

    numericEffects.forEach((effect) => {
      applySingleNumericEffect(simulatedProfile, effect, appliedEffects, warnings);
    });
  });

  return {
    simulatedProfile,
    appliedEffects,
    warnings: Array.from(new Set(warnings))
  };
}

function isConditionSatisfied(effect: EvidenceEffect, userInput: UserInput): boolean {
  if (!effect.appliesIf) return true;

  if (effect.appliesIf === 'sleepHours < 7') {
    return userInput.sleepHours < 7;
  }

  if (effect.appliesIf === 'sleepHours < 6.5') {
    return userInput.sleepHours < 6.5;
  }

  return true;
}

function aggregateNumericDeltas(effects: EvidenceEffect[]): number {
  const numericEffects = effects
    .filter((effect) => effect.deltaType === 'absolute')
    .filter((effect) => typeof effect.delta === 'number')
    .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number));

  const weights = [1, 0.5, 0.25];

  return numericEffects.reduce((sum, effect, index) => {
    return sum + (effect.delta as number) * (weights[index] ?? 0);
  }, 0);
}

function applyBooleanEffect(
  simulatedProfile: CompletedMedicalProfile,
  effect: EvidenceEffect,
  appliedEffects: AppliedEffect[],
  warnings: string[]
) {
  if (effect.biomarker !== 'smoker' || typeof effect.delta !== 'boolean') return;

  const before = simulatedProfile.smoker;
  if (effect.scenarioId === 'stop_smoking' && before === false) {
    warnings.push('Already non-smoker.');
    return;
  }

  simulatedProfile.smoker = effect.delta;
  appliedEffects.push({
    ...effect,
    before,
    after: simulatedProfile.smoker
  });
}

function applySingleNumericEffect(
  simulatedProfile: CompletedMedicalProfile,
  effect: EvidenceEffect,
  appliedEffects: AppliedEffect[],
  warnings: string[]
) {
  if (typeof effect.delta !== 'number' || effect.biomarker === 'smoker') return;

  const biomarker = effect.biomarker;
  const before = simulatedProfile[biomarker];
  if (typeof before !== 'number') {
    warnings.push(`${effect.label} skipped because ${biomarker} is not available on the current profile.`);
    return;
  }

  const after = applyBounds(biomarker, before + effect.delta);
  simulatedProfile[biomarker] = after;
  appliedEffects.push({
    ...effect,
    before,
    after
  });
}

function applyCombinedNumericEffects(
  simulatedProfile: CompletedMedicalProfile,
  biomarker: Biomarker,
  effects: EvidenceEffect[],
  appliedEffects: AppliedEffect[],
  warnings: string[]
) {
  if (biomarker === 'smoker') return;

  const numericBiomarker = biomarker;
  const before = simulatedProfile[numericBiomarker];
  if (typeof before !== 'number') {
    warnings.push(`${numericBiomarker} effects skipped because the biomarker is not available on the current profile.`);
    return;
  }

  const after = applyBounds(numericBiomarker, before + aggregateNumericDeltas(effects));
  simulatedProfile[numericBiomarker] = after;
  warnings.push(COMBINED_EFFECT_WARNING);

  effects.forEach((effect) => {
    appliedEffects.push({
      ...effect,
      before,
      after
    });
  });
}

function applyBounds(biomarker: NumericBiomarker, value: number): number {
  const bounds = BIOMARKER_BOUNDS[biomarker as keyof typeof BIOMARKER_BOUNDS];
  const boundedValue = bounds ? clamp(value, bounds.min, bounds.max) : value;
  return round2(boundedValue);
}

function getSkippedConditionWarning(effect: EvidenceEffect): string {
  if (effect.id === 'sleep-sbp') {
    return 'Sleep SBP effect skipped because user is not a short sleeper.';
  }

  if (effect.id === 'sleep-energy-intake') {
    return 'Sleep energy intake effect skipped because user sleep is not below 6.5 hours.';
  }

  return `${effect.label} skipped because ${effect.appliesIf ?? 'its condition'} was not satisfied.`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export { aggregateNumericDeltas, isConditionSatisfied };
