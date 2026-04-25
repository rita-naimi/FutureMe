export type Sex = 'male' | 'female';

export type SmokingStatus = 'never' | 'former' | 'current';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type Biomarker =
  | 'systolicBloodPressure'
  | 'diastolicBloodPressure'
  | 'totalCholesterol'
  | 'hdlCholesterol'
  | 'ldlCholesterol'
  | 'triglycerides'
  | 'bmi'
  | 'hba1c'
  | 'smoker'
  | 'energyIntake';

export type UserInput = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  smokingStatus: SmokingStatus;

  exerciseDaysPerWeek: number;
  sleepHours: number;
  stressLevel: number;

  dietQuality?: 'poor' | 'average' | 'good';
  alcoholDrinksPerWeek?: number;

  systolicBloodPressure?: number;
  totalCholesterol?: number;
  hdlCholesterol?: number;
  diabetes?: boolean;
};

export type CompletedMedicalProfile = {
  age: number;
  sex: Sex;
  bmi: number;

  smoker: boolean;
  diabetes: boolean;
  onBloodPressureTreatment: boolean;

  systolicBloodPressure: number;
  totalCholesterol: number;
  hdlCholesterol: number;

  diastolicBloodPressure?: number;
  ldlCholesterol?: number;
  triglycerides?: number;
  hba1c?: number;
  energyIntake?: number;

  estimatedFromSynthea?: {
    systolicBloodPressure: boolean;
    totalCholesterol: boolean;
    hdlCholesterol: boolean;
    diabetes: boolean;
    onBloodPressureTreatment: boolean;
  };
};

export type EvidenceEffect = {
  id: string;
  scenarioId: string;
  label: string;
  biomarker: Biomarker;
  deltaType: 'absolute' | 'boolean';
  delta: number | boolean;
  unit?: 'mmHg' | 'mg/dL' | 'kg/m2' | '%' | 'kcal/day';
  confidence: ConfidenceLevel;
  useInRiskScore: boolean;
  timeHorizon: string;
  appliesIf?: string;
  source: string;
  note: string;
};

export type AppliedEffect = EvidenceEffect & {
  before: number | boolean;
  after: number | boolean;
};

export type ScenarioResult = {
  scenarioId: string;
  scenarioName: string;
  currentProfile: CompletedMedicalProfile;
  simulatedProfile: CompletedMedicalProfile;
  appliedEffects: AppliedEffect[];
  currentRisk: number;
  futureRisk: number;
  absoluteRiskReduction: number;
  relativeRiskReduction: number;
  warnings: string[];
};
