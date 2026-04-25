import type { HealthInputs } from '@/lib/fhir';
import type { DerivedClinicalMarkers, PromptPayload, RiskEvidence, SyntheticMatch } from './types';

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

function summarizeMatches(matches: SyntheticMatch[], yearsBefore: number) {
  void yearsBefore;
  return matches
    .map((match, index) => {
      const m = match.inputs;
      const cm = match.clinicalMarkers;
      const clinical = cm
        ? ` | TC ${cm.totalCholesterolMgDl ?? 'NA'} mg/dL, HDL ${cm.hdlMgDl ?? 'NA'} mg/dL, PAS ${cm.systolicBloodPressureMmHg ?? 'NA'} mmHg`
        : '';
      return [
        `${index + 1}. ${match.name} — patient synthetique retenu par filtres explicites`,
        `   Age: ${m.age}, sexe ${m.sex}, IMC ${(m.weightKg / Math.pow(m.heightCm / 100, 2)).toFixed(1)}, tabac ${m.smokingStatus}, sommeil ${m.sleepHours}h, exercice ${m.exerciseDaysPerWeek}j${clinical}`
      ].join('\n');
    })
    .join('\n');
}

function summarizeDerivedMarkers(derived: DerivedClinicalMarkers | undefined, yearsBefore: number) {
  void yearsBefore;
  if (!derived) return null;
  const sourceLabel =
    derived.source === 'user-provided'
      ? 'fournis par le patient (etat actuel)'
      : derived.source === 'mixed'
        ? 'fournis par le patient et completes par cohorte Synthea filtree'
        : 'estimes par cohorte Synthea filtree';
  return [
    `### Marqueurs cliniques (${sourceLabel})`,
    'Missing biomarkers are estimated from a rule-based matched cohort of similar synthetic Synthea patients. This is an explainable prototype estimation method, not a validated clinical prediction model.',
    `Methode: ${derived.estimationMethod}; taille cohorte: ${derived.matchedCohortSize}; filtres relaches: ${derived.relaxedFiltersUsed.join(', ') || 'aucun'}`,
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
  matches: SyntheticMatch[],
  riskEvidence: RiskEvidence,
  derivedMarkers?: DerivedClinicalMarkers,
  yearsOfHistory: number = 5
): PromptPayload {
  const system = [
    'Vous etes un assistant de synthese clinique pour un prototype de prevention.',
    'Vous recevez les donnees REELLES actuelles du patient et une cohorte synthetique Synthea selectionnee avec des filtres explicites et interpretables.',
    'Les marqueurs manquants peuvent etre estimes par mediane ou vote majoritaire de cette cohorte Synthea filtree. Cette methode est un prototype explicable, pas un modele clinique valide.',
    'Objectif: comparer la trajectoire passe -> present, identifier les facteurs ayant evolue, et projeter l\'evolution future probable si les habitudes restent inchangees.',
    'Ne pas donner de recommandations de traitement individualisees. Ne pas inventer de valeurs.',
    'Sortie attendue: sections Markdown courtes: Resume, Trajectoire (passe -> present), Evolution probable a 5-10 ans, Facteurs dominants, Limites.'
  ].join(' ');

  const markersBlock = summarizeDerivedMarkers(derivedMarkers, yearsOfHistory);

  const user = [
    `### Donnees reelles ACTUELLES du patient (T0 = aujourd'hui)`,
    summarizeInput(inputs),
    '',
    `### Cohorte synthetique Synthea — appariement par filtres explicites`,
    `Ces ${matches.length} patient(s) synthetiques sont retenus par regles interpretables: meme sexe, age proche, IMC proche, tabac identique si possible, diabete identique si fourni. Ce n'est pas une formule medicale validee.`,
    summarizeMatches(matches, yearsOfHistory),
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
    `Tache: (1) resumer l'etat actuel du patient, (2) expliquer quels marqueurs viennent du patient et lesquels sont estimes par cohorte Synthea filtree, (3) projeter l'evolution probable a +5/+10 ans si trends inchangees, (4) rappeler les limites de simulation.`
  ].join('\n');

  return { system, user };
}
