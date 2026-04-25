import type { HealthInputs, TwinProfile } from '@/lib/fhir';

export type HistoryYears = 5 | 10;

export interface ClinicalMarkers {
  totalCholesterolMgDl?: number;
  hdlMgDl?: number;
  ldlMgDl?: number;
  glucoseMgDl?: number;
  hba1cPercent?: number;
  systolicBloodPressureMmHg?: number;
  diastolicBloodPressureMmHg?: number;
  heartRateBpm?: number;
  restingHeartRateBpm?: number;
  smoker?: boolean;
  onBloodPressureTreatment?: boolean;
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
}

export type NormalizedHealthStateSource = 'synthea_fhir' | 'apple_healthkit' | 'manual' | 'estimated';

export interface NormalizedHealthState {
  source: NormalizedHealthStateSource;
  date: string;
  demographics: {
    age: number;
    sex: 'male' | 'female' | 'other' | 'unknown';
  };
  vitals: {
    systolicBloodPressure?: number;
    diastolicBloodPressure?: number;
    heartRate?: number;
    restingHeartRate?: number;
    bmi?: number;
    weightKg?: number;
    heightCm?: number;
  };
  labs: {
    totalCholesterol?: number;
    hdlCholesterol?: number;
    ldlCholesterol?: number;
    glucose?: number;
    hba1c?: number;
  };
  lifestyle: {
    sleepHours?: number;
    stepsPerDay?: number;
    activeMinutesPerWeek?: number;
    workoutsPerWeek?: number;
    smoker?: boolean;
  };
  conditions: {
    diabetes?: boolean;
    hypertension?: boolean;
  };
}

export interface SyntheaModelState {
  age: number;
  sex: 'male' | 'female' | 'other' | 'unknown';
  SBP?: number;
  DBP?: number;
  BMI?: number;
  total_chol?: number;
  HDL?: number;
  glucose?: number;
  smoker?: boolean;
  diabetes?: boolean;
  hypertension?: boolean;
}

export interface BiomarkerEffect {
  metric:
    | 'systolicBloodPressure'
    | 'diastolicBloodPressure'
    | 'bmi'
    | 'totalCholesterol'
    | 'hdlCholesterol'
    | 'glucose'
    | 'smoker';
  totalDelta: number | boolean;
  horizonWeeks: number;
  confidence: 'high' | 'medium';
  scenarioId: 'stop_smoking' | 'structured_exercise' | 'sleep_improvement' | 'stress_reduction';
  label: string;
}

export interface TrajectoryPoint {
  year: number;
  age: number;
  biomarkers: {
    systolicBloodPressure: number;
    diastolicBloodPressure: number;
    bmi: number;
    totalCholesterol: number;
    hdlCholesterol: number;
    glucose: number;
    smoker: boolean;
    diabetes: boolean;
    hypertension: boolean;
  };
  cardiovascularRiskPercent: number;
  riskEvidence: RiskEvidence;
}

export interface TrajectoryOutput {
  model: 'synthea_gradient_boosting_v1' | 'synthea_proxy_transition_v0';
  startYear: number;
  endYear: number;
  normalizedState: NormalizedHealthState;
  syntheaModelInput: SyntheaModelState;
  missingModelFields: string[];
  baseline: TrajectoryPoint[];
  interventions: Array<{
    scenarioId: BiomarkerEffect['scenarioId'];
    label: string;
    effects: BiomarkerEffect[];
    curve: TrajectoryPoint[];
    warnings: string[];
  }>;
  warnings: string[];
}

export interface PipelineRequest {
  inputs: HealthInputs;
  healthStateSource?: NormalizedHealthStateSource;
  yearsOfHistory?: HistoryYears;
  kNearest?: number;
  clinicalMarkers?: ClinicalMarkers;
  includePubMed?: boolean;
  pubMedMaxArticles?: number;
  enableLlmSummary?: boolean;
  enableLocalRagCache?: boolean;
}

export interface ReferenceMatch {
  referenceId: string;
  name: string;
  historyYears: HistoryYears;
  source: 'questionnaire-derived';
  inputs: HealthInputs;
  clinicalMarkers?: ClinicalMarkers;
}

export interface DerivedClinicalMarkers extends ClinicalMarkers {
  source: 'user-provided' | 'questionnaire-derived' | 'mixed';
  providedByUser: Array<keyof ClinicalMarkers>;
  estimatedFromQuestionnaire: Array<keyof ClinicalMarkers>;
  estimationMethod: 'questionnaire-derived heuristic';
  warnings: string[];
}

export interface RiskEvidence {
  framingham10YearRiskPercent: number;
  ascvdProxy10YearRiskPercent: number;
  metabolicSyndromeProxyRiskPercent: number;
  allostaticLoadIndex: number;
  lifeEssential8ProxyScore: number;
  lifestyleScore: number;
  evidence: string[];
  assumptions: string[];
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  journal?: string;
  year?: string;
  abstractSnippet?: string;
}

export interface LlmOutput {
  model: string;
  summary: string;
  provider: 'anthropic' | 'fallback';
}

export interface PromptPayload {
  system: string;
  user: string;
}

export interface PipelineResponse {
  profile: TwinProfile;
  matching: {
    selected: ReferenceMatch[];
    totalCandidates: number;
    matchingMethod?: 'not-used';
    warnings?: string[];
  };
  riskEvidence: RiskEvidence;
  prompt: PromptPayload;
  pubmed: {
    query: string;
    articles: PubMedArticle[];
  };
  llm?: LlmOutput;
  derivedClinicalMarkers?: DerivedClinicalMarkers;
  trajectory?: TrajectoryOutput;
  generatedAt: string;
}
