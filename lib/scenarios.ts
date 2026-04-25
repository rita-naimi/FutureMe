import { applyEvidenceEffects } from '@/lib/applyEvidenceEffects';
import { calculateCardioRisk } from '@/lib/riskCalculator';
import type { CompletedMedicalProfile, ScenarioResult, UserInput } from '@/types/medical';

export const scenarios = [
  {
    id: 'structured_exercise',
    name: 'Structured exercise',
    description: 'Simulates around 8-12 weeks of consistent structured exercise.'
  },
  {
    id: 'sleep_improvement',
    name: 'Sleep improvement',
    description: 'Applies only for short sleepers. Simulates sustained sleep improvement over several weeks.'
  },
  {
    id: 'stress_reduction',
    name: 'Stress reduction / MBSR',
    description: 'Simulates an 8-week mindfulness-based stress reduction intervention.'
  },
  {
    id: 'stop_smoking',
    name: 'Stop smoking',
    description: 'Changes smoking status from current smoker to non-smoker for risk recalculation.'
  }
] as const;

export function generateScenarioResult(
  profile: CompletedMedicalProfile,
  userInput: UserInput,
  scenarioId: string
): ScenarioResult {
  const currentRisk = calculateCardioRisk(profile);
  const { simulatedProfile, appliedEffects, warnings } = applyEvidenceEffects(profile, userInput, [scenarioId], {
    mode: 'individual'
  });

  const futureRisk = calculateCardioRisk(simulatedProfile);
  const absoluteRiskReduction = currentRisk - futureRisk;
  const relativeRiskReduction = currentRisk > 0 ? ((currentRisk - futureRisk) / currentRisk) * 100 : 0;
  const scenario = scenarios.find((item) => item.id === scenarioId);

  return {
    scenarioId,
    scenarioName: scenario?.name ?? scenarioId,
    currentProfile: profile,
    simulatedProfile,
    appliedEffects,
    currentRisk: round1(currentRisk),
    futureRisk: round1(futureRisk),
    absoluteRiskReduction: round1(absoluteRiskReduction),
    relativeRiskReduction: round1(relativeRiskReduction),
    warnings
  };
}

export function getUsefulScenarios(profile: CompletedMedicalProfile) {
  return scenarios.filter((scenario) => scenario.id !== 'stop_smoking' || profile.smoker);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
