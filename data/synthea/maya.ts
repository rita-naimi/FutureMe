import type { HealthInputs } from '@/lib/fhir';

export const MAYA_PERSONA: HealthInputs = {
  name: 'Maya',
  age: 28,
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
