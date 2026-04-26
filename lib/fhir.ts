import type { Bundle, Observation, Patient } from 'fhir/r4';

export interface HealthInputs {
  name: string;
  age: number;
  sex: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  sleepHours: number;
  exerciseDaysPerWeek: number;
  dietQuality: number;
  stressLevel: number;
  smokingStatus: 'never' | 'former' | 'current';
  alcoholDrinksPerWeek: number;
  familyHistoryHeart: boolean;
  familyHistoryDiabetes: boolean;
  familyHistoryCancer: boolean;
  existingConditions: string[];
}

export interface RiskScores {
  cardiovascular: number;
  metabolic: number;
  mentalResilience: number;
  longevity: number;
  overall: number;
}

export interface TwinProfile {
  inputs: HealthInputs;
  fhir: Bundle;
  risks: RiskScores;
  biologicalAge: number;
  topRisk: string;
  keyInsight: string;
  fhirSource?: 'questionnaire' | 'wearable-import';
  createdAt: string;
}

const LOINC = {
  sleep: '93832-4',
  bmi: '39156-5',
  exercise: '68516-4',
  diet: '75302-0',
  stress: '72133-2',
  smoking: '72166-2',
  alcohol: '74013-4'
};

export function buildFHIRBundle(inputs: HealthInputs): Bundle {
  const bmi = getBmi(inputs);

  const patient: Patient = {
    resourceType: 'Patient',
    id: 'meror-patient',
    name: [{ text: inputs.name }],
    gender: inputs.sex,
    birthDate: new Date(new Date().getFullYear() - inputs.age, 0, 1)
      .toISOString()
      .split('T')[0]
  };

  const observations: Observation[] = [
    makeQuantityObs(LOINC.sleep, inputs.sleepHours, 'h', 'Sleep duration'),
    makeQuantityObs(LOINC.bmi, round1(bmi), 'kg/m2', 'Body mass index'),
    makeQuantityObs(LOINC.exercise, inputs.exerciseDaysPerWeek, 'd/wk', 'Exercise frequency'),
    makeQuantityObs(LOINC.diet, inputs.dietQuality, '{score}', 'Diet quality score'),
    makeQuantityObs(LOINC.stress, inputs.stressLevel, '{score}', 'Perceived stress score'),
    makeQuantityObs(LOINC.alcohol, inputs.alcoholDrinksPerWeek, '{drinks}/wk', 'Alcohol use'),
    makeStringObs(LOINC.smoking, inputs.smokingStatus, 'Tobacco smoking status')
  ];

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { resource: patient },
      ...observations.map((resource) => ({ resource }))
    ]
  };
}

export function getBmi(inputs: Pick<HealthInputs, 'heightCm' | 'weightKg'>) {
  return inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
}

function makeQuantityObs(code: string, value: number, unit: string, display: string): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code, display }],
      text: display
    },
    valueQuantity: {
      value,
      unit,
      system: 'http://unitsofmeasure.org'
    },
    effectiveDateTime: new Date().toISOString()
  };
}

function makeStringObs(code: string, value: string, display: string): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code, display }],
      text: display
    },
    valueString: value,
    effectiveDateTime: new Date().toISOString()
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
