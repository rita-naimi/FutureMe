import type { HealthInputs } from '@/lib/fhir';

export const ALEX_PERSONA: HealthInputs = {
  name: 'Alex',
  age: 34,
  sex: 'male',
  heightCm: 178,
  weightKg: 89,
  sleepHours: 5.2,
  exerciseDaysPerWeek: 1,
  dietQuality: 2,
  stressLevel: 4,
  smokingStatus: 'current',
  alcoholDrinksPerWeek: 11,
  familyHistoryHeart: true,
  familyHistoryDiabetes: false,
  familyHistoryCancer: false,
  existingConditions: []
};
