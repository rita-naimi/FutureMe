import type { HealthInputs, TwinProfile } from './fhir';
import { buildFHIRBundle } from './fhir';
import { computeBiologicalAge, computeRisks, getKeyInsight, getTopRisk } from './risks';

export function createTwinProfile(
  inputs: HealthInputs,
  fhirSource: TwinProfile['fhirSource'] = 'questionnaire'
): TwinProfile {
  const risks = computeRisks(inputs);
  const biologicalAge = computeBiologicalAge(inputs, risks);

  return {
    inputs,
    fhir: buildFHIRBundle(inputs),
    risks,
    biologicalAge,
    topRisk: getTopRisk(risks),
    keyInsight: getKeyInsight(inputs, risks, biologicalAge),
    fhirSource,
    createdAt: new Date().toISOString()
  };
}
