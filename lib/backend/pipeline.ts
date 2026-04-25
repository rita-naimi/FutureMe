import { createTwinProfile } from '@/lib/profile';
import type {
  ClinicalMarkers,
  DerivedClinicalMarkers,
  PipelineRequest,
  PipelineResponse,
  SyntheticMatch
} from './types';
import { buildRiskEvidence } from './risk-evidence';
import { buildClinicalPrompt } from './prompt';
import { findRuleBasedSyntheticPatients } from './matching';
import { fetchPubMedContext } from './pubmed';
import { generateClinicalSummary } from './llm';

const CLINICAL_MARKER_KEYS = [
  'totalCholesterolMgDl',
  'hdlMgDl',
  'systolicBloodPressureMmHg',
  'hasDiabetes',
  'onBloodPressureTreatment'
] as const;

type ClinicalMarkerKey = (typeof CLINICAL_MARKER_KEYS)[number];

function markerProvidedByUser(markers: ClinicalMarkers | undefined, key: ClinicalMarkerKey) {
  return markers?.[key] !== undefined;
}

function median(values: number[]) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  return Number(value.toFixed(1));
}

function majority(values: boolean[]) {
  if (values.length === 0) return undefined;
  const trueCount = values.filter(Boolean).length;
  const falseCount = values.length - trueCount;
  if (trueCount === falseCount) return undefined;
  return trueCount > falseCount;
}

function estimateMarkersFromCohort(matches: SyntheticMatch[]) {
  const withMarkers = matches.filter((m) => m.clinicalMarkers);

  return {
    totalCholesterolMgDl: median(
      withMarkers
        .map((match) => match.clinicalMarkers?.totalCholesterolMgDl)
        .filter((value): value is number => typeof value === 'number')
    ),
    hdlMgDl: median(
      withMarkers
        .map((match) => match.clinicalMarkers?.hdlMgDl)
        .filter((value): value is number => typeof value === 'number')
    ),
    systolicBloodPressureMmHg: median(
      withMarkers
        .map((match) => match.clinicalMarkers?.systolicBloodPressureMmHg)
        .filter((value): value is number => typeof value === 'number')
    ),
    hasDiabetes: majority(
      withMarkers
        .map((match) => match.clinicalMarkers?.hasDiabetes)
        .filter((value): value is boolean => typeof value === 'boolean')
    ),
    onBloodPressureTreatment: majority(
      withMarkers
        .map((match) => match.clinicalMarkers?.onBloodPressureTreatment)
        .filter((value): value is boolean => typeof value === 'boolean')
    )
  };
}

function buildEffectiveClinicalMarkers(
  userMarkers: ClinicalMarkers | undefined,
  selected: SyntheticMatch[],
  relaxedFiltersUsed: string[],
  matchingWarnings: string[]
): { markers: ClinicalMarkers; derived: DerivedClinicalMarkers } {
  const cohortEstimates = estimateMarkersFromCohort(selected);
  const markers: ClinicalMarkers = {};
  const providedByUser: ClinicalMarkerKey[] = [];
  const estimatedFromSynthea: ClinicalMarkerKey[] = [];
  const warnings = [...matchingWarnings];

  CLINICAL_MARKER_KEYS.forEach((key) => {
    if (markerProvidedByUser(userMarkers, key)) {
      markers[key] = userMarkers?.[key] as never;
      providedByUser.push(key);
      return;
    }

    const estimate = cohortEstimates[key];
    if (estimate !== undefined) {
      markers[key] = estimate as never;
      estimatedFromSynthea.push(key);
      return;
    }

    warnings.push(`Unable to estimate ${key} from the matched Synthea cohort.`);
  });

  const missing = CLINICAL_MARKER_KEYS.filter((key) => markers[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing clinical markers after rule-based Synthea estimation: ${missing.join(', ')}. Provide them from the questionnaire or expand the Synthea cohort.`
    );
  }

  return {
    markers,
    derived: {
      ...markers,
      source:
        providedByUser.length === CLINICAL_MARKER_KEYS.length
          ? 'user-provided'
          : providedByUser.length > 0
            ? 'mixed'
            : 'rule-based-synthea',
      providedByUser,
      estimatedFromSynthea,
      matchedCohortSize: selected.length,
      relaxedFiltersUsed,
      estimationMethod: 'rule-based matched cohort median',
      warnings
    }
  };
}

export async function runSimulationPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  const yearsOfHistory = request.yearsOfHistory ?? 5;
  void request.kNearest;

  const profile = createTwinProfile(request.inputs, 'synthea-generated');
  const matchResult = findRuleBasedSyntheticPatients(request.inputs, yearsOfHistory, {
    userDiabetes: request.clinicalMarkers?.hasDiabetes
  });
  const selected = matchResult.selected;
  const { markers: effectiveMarkers, derived: derivedClinicalMarkers } = buildEffectiveClinicalMarkers(
    request.clinicalMarkers,
    selected,
    matchResult.relaxedFiltersUsed,
    matchResult.warnings
  );

  const riskEvidence = buildRiskEvidence(request.inputs, effectiveMarkers);
  const prompt = buildClinicalPrompt(request.inputs, selected, riskEvidence, derivedClinicalMarkers, yearsOfHistory);
  const pubmed = request.includePubMed
    ? await fetchPubMedContext(
        request.inputs,
        riskEvidence,
        request.pubMedMaxArticles ?? 3,
        request.enableLocalRagCache ?? true
      )
    : { query: 'PubMed disabled', articles: [] };

  const llm = request.enableLlmSummary
    ? await generateClinicalSummary({
        inputs: request.inputs,
        riskEvidence,
        prompt,
        pubmedArticles: pubmed.articles
      })
    : undefined;

  return {
    profile,
    matching: {
      selected,
      totalCandidates: matchResult.totalCandidates,
      matchingMethod: 'rule-based filters',
      relaxedFiltersUsed: matchResult.relaxedFiltersUsed,
      warnings: matchResult.warnings
    },
    riskEvidence,
    prompt,
    pubmed,
    llm,
    derivedClinicalMarkers,
    generatedAt: new Date().toISOString()
  };
}
