import { describe, expect, it } from 'vitest';
import { runSimulationPipeline } from '@/lib/backend/pipeline';
import { HIGH_RISK_PROFILE } from '../fixtures/health-inputs';

describe('runSimulationPipeline', () => {
  it('builds a pipeline response without remote dependencies', async () => {
    const result = await runSimulationPipeline({
      inputs: HIGH_RISK_PROFILE,
      yearsOfHistory: 5,
      kNearest: 3,
      clinicalMarkers: {
        onBloodPressureTreatment: true
      },
      includePubMed: false,
      enableLlmSummary: false
    });

    expect(result.profile.inputs.name).toBe('Test User');
    expect(result.matching.selected).toHaveLength(0);
    expect(result.matching.matchingMethod).toBe('not-used');
    expect(result.riskEvidence.framingham10YearRiskPercent).toBeGreaterThan(0);
    expect(result.derivedClinicalMarkers?.estimationMethod).toBe('questionnaire-derived heuristic');
    expect(result.trajectory?.baseline).toHaveLength(21);
    expect(result.trajectory?.interventions.some((intervention) => intervention.scenarioId === 'structured_exercise')).toBe(true);
    expect(result.prompt.system.length).toBeGreaterThan(20);
    expect(result.pubmed.articles).toHaveLength(0);
    expect(result.llm).toBeUndefined();
  });
});
