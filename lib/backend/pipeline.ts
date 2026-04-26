import { createTwinProfile } from '@/lib/profile';
import type { ClinicalMarkers, DerivedClinicalMarkers, PipelineRequest, PipelineResponse } from './types';
import { buildRiskEvidence } from './risk-evidence';
import { buildClinicalPrompt } from './prompt';
import { fetchPubMedContext } from './pubmed';
import { generateClinicalSummary } from './llm';
import { buildTrajectoryOutput } from './trajectory';
import { explainAppleHealthSyntheaOverlap, normalizeHealthState } from './normalized-state';
import type { HealthInputs } from '@/lib/fhir';
import { estimateClinicalMarkersFromMatchedSynthea } from './syntheaMatching';

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

function buildEffectiveClinicalMarkers(
  inputs: HealthInputs,
  userMarkers: ClinicalMarkers | undefined
): { markers: ClinicalMarkers; derived: DerivedClinicalMarkers } {
  const syntheaEstimate = estimateClinicalMarkersFromMatchedSynthea(inputs, userMarkers);
  const markers: ClinicalMarkers = {};
  const providedByUser: ClinicalMarkerKey[] = [];
  const estimatedFromSynthea: ClinicalMarkerKey[] = [];
  const warnings: string[] = [];

  CLINICAL_MARKER_KEYS.forEach((key) => {
    if (markerProvidedByUser(userMarkers, key)) {
      markers[key] = userMarkers?.[key] as never;
      providedByUser.push(key);
      return;
    }

    markers[key] = syntheaEstimate.markers[key] as never;
    estimatedFromSynthea.push(key);
  });

  Object.entries(userMarkers ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (markers[key as keyof ClinicalMarkers] !== undefined) return;
    markers[key as keyof ClinicalMarkers] = value as never;
  });

  if (estimatedFromSynthea.length > 0) {
    warnings.push(...syntheaEstimate.warnings);
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
            : 'synthea-matched-cohort',
      providedByUser,
      estimatedFromQuestionnaire: [],
      estimatedFromSynthea,
      matchedCohortSize: syntheaEstimate.matchedCohortSize,
      relaxedFiltersUsed: syntheaEstimate.relaxedFiltersUsed,
      estimationMethod: syntheaEstimate.estimationMethod,
      warnings
    }
  };
}

export async function runSimulationPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  const yearsOfHistory = request.yearsOfHistory ?? 5;
  void request.kNearest;

  const profile = createTwinProfile(request.inputs);
  const { markers: effectiveMarkers, derived: derivedClinicalMarkers } = buildEffectiveClinicalMarkers(request.inputs, request.clinicalMarkers);
  const normalizedState = normalizeHealthState(request.inputs, effectiveMarkers, {
    source: request.healthStateSource ?? 'manual'
  });
  const trajectory = await buildTrajectoryOutput(normalizedState, request.inputs, effectiveMarkers);
  const normalizationWarnings = explainAppleHealthSyntheaOverlap(normalizedState);

  trajectory.warnings.push(...normalizationWarnings);

  const riskEvidence = buildRiskEvidence(request.inputs, effectiveMarkers);
  const prompt = buildClinicalPrompt(request.inputs, riskEvidence, derivedClinicalMarkers, yearsOfHistory);
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
      selected: [],
      totalCandidates: 0,
      matchingMethod: 'not-used',
      warnings: []
    },
    riskEvidence,
    prompt,
    pubmed,
    llm,
    derivedClinicalMarkers,
    trajectory,
    generatedAt: new Date().toISOString()
  };
}
