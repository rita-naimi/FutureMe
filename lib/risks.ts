import type { HealthInputs, RiskScores } from './fhir';
import { getBmi } from './fhir';

export function computeRisks(inputs: HealthInputs): RiskScores {
  const bmi = getBmi(inputs);

  const cardiovascular = clamp(
    20 +
      (bmi > 30 ? 20 : bmi > 25 ? 10 : 0) +
      (inputs.smokingStatus === 'current' ? 25 : inputs.smokingStatus === 'former' ? 10 : 0) +
      (inputs.familyHistoryHeart ? 15 : 0) +
      (inputs.stressLevel > 3 ? 10 : 0) +
      (inputs.exerciseDaysPerWeek < 2 ? 10 : 0) +
      (inputs.alcoholDrinksPerWeek > 14 ? 10 : 0) -
      (inputs.exerciseDaysPerWeek > 4 ? 10 : 0) -
      (inputs.dietQuality > 3 ? 8 : 0)
  );

  const metabolic = clamp(
    15 +
      (bmi > 30 ? 25 : bmi > 25 ? 12 : 0) +
      (inputs.dietQuality < 3 ? 20 : 0) +
      (inputs.exerciseDaysPerWeek < 2 ? 15 : 0) +
      (inputs.familyHistoryDiabetes ? 15 : 0) +
      (inputs.sleepHours < 6 ? 10 : 0) -
      (inputs.dietQuality > 4 ? 10 : 0) -
      (inputs.exerciseDaysPerWeek > 4 ? 15 : 0)
  );

  const mentalResilience = clamp(
    10 +
      (inputs.stressLevel > 3 ? (inputs.stressLevel - 3) * 15 : 0) +
      (inputs.sleepHours < 6 ? 20 : inputs.sleepHours < 7 ? 10 : 0) +
      (inputs.exerciseDaysPerWeek < 2 ? 10 : 0) -
      (inputs.exerciseDaysPerWeek > 3 ? 10 : 0) -
      (inputs.sleepHours >= 8 ? 10 : 0)
  );

  const longevity = clamp(
    100 -
      cardiovascular * 0.3 -
      metabolic * 0.25 -
      mentalResilience * 0.2 -
      (inputs.smokingStatus === 'current' ? 15 : 0) -
      (inputs.familyHistoryCancer ? 5 : 0) +
      (inputs.dietQuality > 4 ? 5 : 0) +
      (inputs.exerciseDaysPerWeek > 4 ? 5 : 0)
  );

  const overall = clamp(
    cardiovascular * 0.3 +
      metabolic * 0.25 +
      mentalResilience * 0.2 +
      (100 - longevity) * 0.25
  );

  return { cardiovascular, metabolic, mentalResilience, longevity, overall };
}

export function computeBiologicalAge(inputs: HealthInputs, risks?: RiskScores): number {
  void risks;
  const bmi = getBmi(inputs);
  let delta = 0;

  if (inputs.sleepHours < 6) delta += 3;
  else if (inputs.sleepHours < 7) delta += 1.5;
  else if (inputs.sleepHours >= 8) delta -= 1;

  if (inputs.exerciseDaysPerWeek >= 5) delta -= 3;
  else if (inputs.exerciseDaysPerWeek >= 3) delta -= 1;
  else if (inputs.exerciseDaysPerWeek < 1) delta += 3;

  if (inputs.smokingStatus === 'current') delta += 5;
  if (inputs.smokingStatus === 'former') delta += 2;
  if (bmi > 30) delta += 3;
  else if (bmi > 25) delta += 1;
  if (inputs.stressLevel > 3) delta += (inputs.stressLevel - 3) * 1.5;
  if (inputs.dietQuality > 4) delta -= 2;
  if (inputs.dietQuality < 2) delta += 2;
  if (inputs.familyHistoryHeart) delta += 1;

  return Math.round(inputs.age + delta);
}

export function getTopRisk(risks: RiskScores): string {
  const scores = {
    'cardiovascular disease': risks.cardiovascular,
    'metabolic disorder': risks.metabolic,
    'mental health decline': risks.mentalResilience
  };

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

export function getKeyInsight(inputs: HealthInputs, risks: RiskScores, biologicalAge: number) {
  const delta = biologicalAge - inputs.age;
  if (inputs.smokingStatus === 'current' && inputs.familyHistoryHeart) {
    return 'Quitting smoking is the highest-leverage move for your future cardiovascular health.';
  }
  if (inputs.sleepHours < 6 && inputs.stressLevel > 3) {
    return 'Your sleep and stress pattern is the fastest-aging part of your profile.';
  }
  if (inputs.exerciseDaysPerWeek < 2 && risks.metabolic > 45) {
    return 'Three deliberate movement days per week would shift both metabolic and longevity risk.';
  }
  if (delta <= 0) {
    return 'Your current habits are already buying your future self time.';
  }
  return `Your habits are adding about ${delta} biological ${delta === 1 ? 'year' : 'years'} today.`;
}

export function healthScoreFromRisks(risks: RiskScores) {
  return clamp(100 - risks.overall);
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
