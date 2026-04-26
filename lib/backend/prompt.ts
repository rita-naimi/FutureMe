import type { HealthInputs } from '@/lib/fhir';
import type { DerivedClinicalMarkers, PromptPayload, RiskEvidence } from './types';

function summarizeInput(inputs: HealthInputs) {
  return [
    `Sexe: ${inputs.sex}`,
    `Age: ${inputs.age}`,
    `Sommeil: ${inputs.sleepHours} h/nuit`,
    `Exercice: ${inputs.exerciseDaysPerWeek} j/semaine`,
    `Qualite alimentation: ${inputs.dietQuality}/5`,
    `Stress: ${inputs.stressLevel}/5`,
    `Tabac: ${inputs.smokingStatus}`,
    `Alcool: ${inputs.alcoholDrinksPerWeek} verres/semaine`,
    `ATCD coeur: ${inputs.familyHistoryHeart ? 'oui' : 'non'}`,
    `ATCD diabete: ${inputs.familyHistoryDiabetes ? 'oui' : 'non'}`,
    `ATCD cancer: ${inputs.familyHistoryCancer ? 'oui' : 'non'}`,
    `Conditions existantes: ${inputs.existingConditions.join(', ') || 'aucune'}`
  ].join('\n');
}

function summarizeDerivedMarkers(derived: DerivedClinicalMarkers | undefined, yearsBefore: number) {
  void yearsBefore;
  if (!derived) return null;
  const sourceLabel =
    derived.source === 'user-provided'
      ? 'fournis par le patient (etat actuel)'
      : derived.source === 'mixed'
        ? 'fournis par le patient et completes par estimation Synthea'
        : 'estimes depuis une cohorte Synthea appariee';
  return [
    `### Marqueurs cliniques (${sourceLabel})`,
    'Missing biomarkers are estimated from a rule-based matched cohort of similar synthetic Synthea patients. This is an explainable prototype estimation method, not a validated clinical prediction model.',
    `Methode: ${derived.estimationMethod}`,
    `Cohorte appariee: ${derived.matchedCohortSize} patients synthetiques`,
    ...(derived.relaxedFiltersUsed.length ? [`Filtres relaxes: ${derived.relaxedFiltersUsed.join(', ')}`] : []),
    `Cholesterol total: ${derived.totalCholesterolMgDl ?? 'NA'} mg/dL`,
    `HDL: ${derived.hdlMgDl ?? 'NA'} mg/dL`,
    `Pression arterielle systolique: ${derived.systolicBloodPressureMmHg ?? 'NA'} mmHg`,
    `Diabete: ${derived.hasDiabetes === undefined ? 'NA' : derived.hasDiabetes ? 'oui' : 'non'}`,
    `Traitement antihypertenseur: ${derived.onBloodPressureTreatment === undefined ? 'NA' : derived.onBloodPressureTreatment ? 'oui' : 'non'}`,
    ...(derived.warnings.length ? [`Avertissements: ${derived.warnings.join(' ')}`] : [])
  ].join('\n');
}

export function buildClinicalPrompt(
  inputs: HealthInputs,
  riskEvidence: RiskEvidence,
  derivedMarkers?: DerivedClinicalMarkers,
  yearsOfHistory: number = 5
): PromptPayload {
  const system = [
    'Vous etes un assistant de synthese clinique pour la prevention.',
    'Vous recevez les donnees actuelles du patient et des marqueurs cliniques fournis ou estimes depuis une cohorte Synthea appariee.',
    'Les marqueurs manquants peuvent etre estimes par une methode rule-based sur patients synthetiques Synthea. Cette methode n est pas un modele clinique valide.',
    'Objectif: comparer la trajectoire passe -> present, identifier les facteurs ayant evolue, et projeter l\'evolution future probable si les habitudes restent inchangees.',
    'Ne pas donner de recommandations de traitement individualisees. Ne pas inventer de valeurs.',
    'Sortie attendue: sections Markdown courtes: Resume, Trajectoire (passe -> present), Evolution probable a 5-10 ans, Facteurs dominants, Limites.'
  ].join(' ');

  const markersBlock = summarizeDerivedMarkers(derivedMarkers, yearsOfHistory);

  const user = [
    `### Donnees reelles ACTUELLES du patient (T0 = aujourd'hui)`,
    summarizeInput(inputs),
    '',
    ...(markersBlock ? [markersBlock, ''] : []),
    '### Scores calcules sur l\'etat actuel',
    `Framingham 10 ans: ${riskEvidence.framingham10YearRiskPercent}%`,
    `ASCVD proxy 10 ans: ${riskEvidence.ascvdProxy10YearRiskPercent}%`,
    `Syndrome metabolique proxy: ${riskEvidence.metabolicSyndromeProxyRiskPercent}%`,
    `Allostatic load index: ${riskEvidence.allostaticLoadIndex}/10`,
    `Life Essential 8 proxy: ${riskEvidence.lifeEssential8ProxyScore}/100`,
    `Lifestyle score: ${riskEvidence.lifestyleScore}/100`,
    ...riskEvidence.evidence.map((line) => `- ${line}`),
    '',
    '### Hypotheses',
    ...(riskEvidence.assumptions.length ? riskEvidence.assumptions.map((line) => `- ${line}`) : ['- Aucune hypothese supplementaire']),
    '',
    `Tache: (1) resumer l'etat actuel du patient, (2) expliquer quels marqueurs viennent du patient et lesquels sont estimes depuis Synthea, (3) projeter l'evolution probable a +5/+10 ans si trends inchangees, (4) rappeler les limites de simulation.`
  ].join('\n');

  return { system, user };
}
