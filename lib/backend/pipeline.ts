import { createTwinProfile } from '@/lib/profile';
import type { ClinicalMarkers, DerivedClinicalMarkers, PipelineRequest, PipelineResponse } from './types';
import { buildRiskEvidence } from './risk-evidence';
import { buildClinicalPrompt } from './prompt';
import { fetchPubMedContext } from './pubmed';
import { generateClinicalSummary } from './llm';
import type { HealthInputs } from '@/lib/fhir';

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getBmi(inputs: Pick<HealthInputs, 'heightCm' | 'weightKg'>) {
  return inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
}

function deriveMarkersFromQuestionnaire(inputs: HealthInputs): Required<ClinicalMarkers> {
  const bmi = getBmi(inputs);
  const smokerPenalty = inputs.smokingStatus === 'current' ? 12 : inputs.smokingStatus === 'former' ? 4 : 0;
  const exerciseBenefit = Math.max(0, inputs.exerciseDaysPerWeek - 2) * 2;
  const dietPenalty = (3 - inputs.dietQuality) * 8;
  const stressPenalty = Math.max(0, inputs.stressLevel - 3) * 3;
  const alcoholPenalty = Math.max(0, inputs.alcoholDrinksPerWeek - 7) * 0.8;
  const hasKnownDiabetes = inputs.existingConditions.some((condition) => /diabetes/i.test(condition));
  const hasKnownHypertension = inputs.existingConditions.some((condition) => /hypertension|blood pressure/i.test(condition));

  const systolicBloodPressureMmHg = round1(
    clamp(
      108 + Math.max(0, inputs.age - 30) * 0.55 + Math.max(0, bmi - 24) * 1.35 + smokerPenalty * 0.55 + stressPenalty - exerciseBenefit,
      95,
      185
    )
  );

  return {
    totalCholesterolMgDl: round1(
      clamp(182 + Math.max(0, bmi - 24) * 2.1 + smokerPenalty + dietPenalty + alcoholPenalty - exerciseBenefit, 130, 290)
    ),
    hdlMgDl: round1(
      clamp((inputs.sex === 'female' ? 62 : 52) - Math.max(0, bmi - 24) * 0.9 - smokerPenalty * 0.35 + exerciseBenefit * 0.7, 30, 95)
    ),
    systolicBloodPressureMmHg,
    hasDiabetes: hasKnownDiabetes || bmi >= 32 || (bmi >= 29 && inputs.familyHistoryDiabetes && inputs.dietQuality <= 2),
    onBloodPressureTreatment: hasKnownHypertension || systolicBloodPressureMmHg >= 140
  };
}

function buildEffectiveClinicalMarkers(
  inputs: HealthInputs,
  userMarkers: ClinicalMarkers | undefined
): { markers: ClinicalMarkers; derived: DerivedClinicalMarkers } {
  const questionnaireEstimates = deriveMarkersFromQuestionnaire(inputs);
  const markers: ClinicalMarkers = {};
  const providedByUser: ClinicalMarkerKey[] = [];
  const estimatedFromQuestionnaire: ClinicalMarkerKey[] = [];
  const warnings: string[] = [];

  CLINICAL_MARKER_KEYS.forEach((key) => {
    if (markerProvidedByUser(userMarkers, key)) {
      markers[key] = userMarkers?.[key] as never;
      providedByUser.push(key);
      return;
    }

    markers[key] = questionnaireEstimates[key] as never;
    estimatedFromQuestionnaire.push(key);
  });

  if (estimatedFromQuestionnaire.length > 0) {
    warnings.push(
      'Some clinical markers were estimated from questionnaire data. Provide recent lab and blood-pressure values for more personalized calculations.'
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
            : 'questionnaire-derived',
      providedByUser,
      estimatedFromQuestionnaire,
      estimationMethod: 'questionnaire-derived heuristic',
      warnings
    }
  };
}

export async function runSimulationPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  const yearsOfHistory = request.yearsOfHistory ?? 5;
  void request.kNearest;

  const profile = createTwinProfile(request.inputs);
  const { markers: effectiveMarkers, derived: derivedClinicalMarkers } = buildEffectiveClinicalMarkers(request.inputs, request.clinicalMarkers);

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
    generatedAt: new Date().toISOString()
  };
}
