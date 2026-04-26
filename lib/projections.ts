import {
  buildBiomarkerInterventionTrajectories,
  buildCategoricalTransitions,
  generateRiskProjection,
  type BiomarkerInterventionTrajectory,
  type CategoricalTransition,
  type ProjectionPoint
} from '@/lib/riskProjection';
import type { CompletedMedicalProfile, ScenarioResult } from '@/types/medical';

export type FutureProjectionResult = {
  baselineRisk: ProjectionPoint[];
  interventionRisk?: ProjectionPoint[];
  biomarkerTrajectories: BiomarkerInterventionTrajectory[];
  categoricalTransitions: CategoricalTransition[];
  assumptions: string[];
  warnings: string[];
};

export function generateFutureProjection(
  profile: CompletedMedicalProfile,
  scenarioResult?: ScenarioResult
): FutureProjectionResult {
  const riskProjection = generateRiskProjection(profile, scenarioResult);

  return {
    baselineRisk: riskProjection.baseline,
    interventionRisk: riskProjection.intervention,
    biomarkerTrajectories: buildBiomarkerInterventionTrajectories(scenarioResult),
    categoricalTransitions: buildCategoricalTransitions(scenarioResult),
    assumptions: riskProjection.assumptions,
    warnings: scenarioResult?.warnings ?? []
  };
}

