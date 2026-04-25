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
import { findNearestSyntheticPatients, getSyntheaSeedCandidates, retroProjectInputs } from './matching';
import { fetchPubMedContext } from './pubmed';
import { generateClinicalSummary } from './llm';

function userHasMarkers(m?: ClinicalMarkers): boolean {
  if (!m) return false;
  return (
    m.totalCholesterolMgDl !== undefined ||
    m.hdlMgDl !== undefined ||
    m.systolicBloodPressureMmHg !== undefined ||
    m.hasDiabetes !== undefined ||
    m.onBloodPressureTreatment !== undefined
  );
}

function deriveMarkersFromCohort(matches: SyntheticMatch[]): DerivedClinicalMarkers | undefined {
  const withMarkers = matches.filter((m) => m.clinicalMarkers);
  if (withMarkers.length === 0) return undefined;

  const weighted = (key: 'totalCholesterolMgDl' | 'hdlMgDl' | 'systolicBloodPressureMmHg') => {
    let sum = 0;
    let weights = 0;
    for (const match of withMarkers) {
      const value = match.clinicalMarkers?.[key];
      if (typeof value === 'number') {
        const w = Math.max(0.05, match.similarity);
        sum += value * w;
        weights += w;
      }
    }
    return weights > 0 ? Number((sum / weights).toFixed(1)) : undefined;
  };

  return {
    totalCholesterolMgDl: weighted('totalCholesterolMgDl'),
    hdlMgDl: weighted('hdlMgDl'),
    systolicBloodPressureMmHg: weighted('systolicBloodPressureMmHg'),
    source: 'cohort-knn'
  };
}

export async function runSimulationPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  const yearsOfHistory = request.yearsOfHistory ?? 5;
  const kNearest = request.kNearest ?? 3;

  const profile = createTwinProfile(request.inputs, 'synthea-generated');
  const retroInputs = retroProjectInputs(request.inputs, yearsOfHistory);
  const selected = findNearestSyntheticPatients(retroInputs, yearsOfHistory, kNearest);

  let derivedClinicalMarkers: DerivedClinicalMarkers | undefined;
  let effectiveMarkers: ClinicalMarkers | undefined = request.clinicalMarkers;

  if (userHasMarkers(request.clinicalMarkers)) {
    derivedClinicalMarkers = { ...request.clinicalMarkers!, source: 'user-provided' };
  } else {
    const cohortMarkers = deriveMarkersFromCohort(selected);
    if (cohortMarkers) {
      derivedClinicalMarkers = cohortMarkers;
      effectiveMarkers = {
        totalCholesterolMgDl: cohortMarkers.totalCholesterolMgDl,
        hdlMgDl: cohortMarkers.hdlMgDl,
        systolicBloodPressureMmHg: cohortMarkers.systolicBloodPressureMmHg
      };
    }
  }

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
      totalCandidates: getSyntheaSeedCandidates().length
    },
    riskEvidence,
    prompt,
    pubmed,
    llm,
    derivedClinicalMarkers,
    generatedAt: new Date().toISOString()
  };
}
