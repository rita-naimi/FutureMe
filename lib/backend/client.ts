import type { HealthInputs } from '@/lib/fhir';
import type { PipelineRequest, PipelineResponse } from './types';

function parseErrorPayload(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: string }).error;
    if (typeof error === 'string') return error;
  }
  return 'Pipeline request failed';
}

export async function runPipelineFromClient(params: {
  inputs: HealthInputs;
  yearsOfHistory?: 5 | 10;
  includePubMed?: boolean;
  enableLlmSummary?: boolean;
  enableLocalRagCache?: boolean;
  kNearest?: number;
  clinicalMarkers?: PipelineRequest['clinicalMarkers'];
}): Promise<PipelineResponse> {
  const payload: PipelineRequest = {
    inputs: params.inputs,
    yearsOfHistory: params.yearsOfHistory ?? 5,
    kNearest: params.kNearest ?? 3,
    includePubMed: params.includePubMed ?? true,
    pubMedMaxArticles: 3,
    enableLlmSummary: params.enableLlmSummary ?? true,
    enableLocalRagCache: params.enableLocalRagCache ?? true,
    clinicalMarkers: params.clinicalMarkers
  };

  const response = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as unknown;
    throw new Error(parseErrorPayload(errorPayload));
  }

  return (await response.json()) as PipelineResponse;
}
