import type { HealthInputs } from '@/lib/fhir';

export const HIGH_RISK_PROFILE: HealthInputs = {
  name: 'Test User',
  age: 52,
  sex: 'male',
  heightCm: 181,
  weightKg: 104,
  sleepHours: 5.6,
  exerciseDaysPerWeek: 0,
  dietQuality: 2,
  stressLevel: 5,
  smokingStatus: 'current',
  alcoholDrinksPerWeek: 18,
  familyHistoryHeart: true,
  familyHistoryDiabetes: true,
  familyHistoryCancer: false,
  existingConditions: ['hypertension']
};

export const LOW_RISK_PROFILE: HealthInputs = {
  name: 'Test User',
  age: 38,
  sex: 'female',
  heightCm: 166,
  weightKg: 61,
  sleepHours: 7.8,
  exerciseDaysPerWeek: 5,
  dietQuality: 5,
  stressLevel: 2,
  smokingStatus: 'never',
  alcoholDrinksPerWeek: 3,
  familyHistoryHeart: false,
  familyHistoryDiabetes: false,
  familyHistoryCancer: true,
  existingConditions: []
};
