import type { HealthInputs, TwinProfile } from '@/lib/fhir';

export type HistoryYears = 5 | 10;

export interface ClinicalMarkers {
  totalCholesterolMgDl?: number;
  hdlMgDl?: number;
  systolicBloodPressureMmHg?: number;
  onBloodPressureTreatment?: boolean;
  hasDiabetes?: boolean;
}

export interface PipelineRequest {
  inputs: HealthInputs;
  yearsOfHistory?: HistoryYears;
  kNearest?: number;
  clinicalMarkers?: ClinicalMarkers;
  includePubMed?: boolean;
  pubMedMaxArticles?: number;
  enableLlmSummary?: boolean;
  enableLocalRagCache?: boolean;
}

export interface SyntheticMatch {
  syntheticId: string;
  name: string;
  historyYears: HistoryYears;
  source: 'synthea-fhir' | 'synthea-seed';
  inputs: HealthInputs;
  clinicalMarkers?: ClinicalMarkers;
}

export interface DerivedClinicalMarkers extends ClinicalMarkers {
  source: 'user-provided' | 'rule-based-synthea' | 'mixed';
  providedByUser: Array<keyof ClinicalMarkers>;
  estimatedFromSynthea: Array<keyof ClinicalMarkers>;
  matchedCohortSize: number;
  relaxedFiltersUsed: string[];
  estimationMethod: 'rule-based matched cohort median';
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
  provider: 'huggingface' | 'fallback';
}

export interface PromptPayload {
  system: string;
  user: string;
}

export interface PipelineResponse {
  profile: TwinProfile;
  matching: {
    selected: SyntheticMatch[];
    totalCandidates: number;
    matchingMethod?: 'rule-based filters';
    relaxedFiltersUsed?: string[];
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
  generatedAt: string;
}
