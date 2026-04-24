import type { HealthInputs } from '@/lib/fhir';

export const JAMES_PERSONA: HealthInputs = {
  name: 'James',
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
