import { createTwinProfile } from '@/lib/profile';
import type { PipelineRequest, PipelineResponse } from './types';
import { buildRiskEvidence } from './risk-evidence';
import { buildClinicalPrompt } from './prompt';
import { findNearestSyntheticPatients, getSyntheaSeedCandidates } from './matching';
import { fetchPubMedContext } from './pubmed';
import { generateClinicalSummary } from './llm';

export async function runSimulationPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  const yearsOfHistory = request.yearsOfHistory ?? 5;
  const kNearest = request.kNearest ?? 3;

  const profile = createTwinProfile(request.inputs, 'synthea-generated');
  const selected = findNearestSyntheticPatients(request.inputs, yearsOfHistory, kNearest);
  const riskEvidence = buildRiskEvidence(request.inputs, request.clinicalMarkers);
  const prompt = buildClinicalPrompt(request.inputs, selected, riskEvidence);
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
    generatedAt: new Date().toISOString()
  };
}
