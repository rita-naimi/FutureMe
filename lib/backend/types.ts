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
  distance: number;
  similarity: number;
  historyYears: HistoryYears;
  source: 'synthea-fhir' | 'synthea-seed';
  inputs: HealthInputs;
  clinicalMarkers?: ClinicalMarkers;
}

export interface DerivedClinicalMarkers extends ClinicalMarkers {
  source: 'user-provided' | 'cohort-knn' | 'estimated';
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
