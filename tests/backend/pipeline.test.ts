import { describe, expect, it } from 'vitest';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { runSimulationPipeline } from '@/lib/backend/pipeline';

describe('runSimulationPipeline', () => {
  it('builds a pipeline response without remote dependencies', async () => {
    const result = await runSimulationPipeline({
      inputs: JAMES_PERSONA,
      yearsOfHistory: 5,
      kNearest: 3,
      clinicalMarkers: {
        onBloodPressureTreatment: true
      },
      includePubMed: false,
      enableLlmSummary: false
    });

    expect(result.profile.inputs.name).toBe('James');
    expect(result.matching.selected.length).toBeGreaterThan(0);
    expect(result.matching.matchingMethod).toBe('rule-based filters');
    expect(result.riskEvidence.framingham10YearRiskPercent).toBeGreaterThan(0);
    expect(result.derivedClinicalMarkers?.estimationMethod).toBe('rule-based matched cohort median');
    expect(result.derivedClinicalMarkers?.matchedCohortSize).toBe(result.matching.selected.length);
    expect(result.prompt.system.length).toBeGreaterThan(20);
    expect(result.pubmed.articles).toHaveLength(0);
    expect(result.llm).toBeUndefined();
  });
});
