import type { HealthInputs } from '@/lib/fhir';
import type { PromptPayload, RiskEvidence, SyntheticMatch } from './types';

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

function summarizeMatches(matches: SyntheticMatch[]) {
  return matches
    .map((match, index) => {
      const m = match.inputs;
      return [
        `${index + 1}. ${match.name} (distance ${match.distance}, similarite ${match.similarity})`,
        `   Age ${m.age}, sexe ${m.sex}, tabac ${m.smokingStatus}, sommeil ${m.sleepHours}h, exercice ${m.exerciseDaysPerWeek}j`
      ].join('\n');
    })
    .join('\n');
}

export function buildClinicalPrompt(inputs: HealthInputs, matches: SyntheticMatch[], riskEvidence: RiskEvidence): PromptPayload {
  const system = [
    'Vous etes un assistant de synthese clinique pour un prototype de prevention.',
    'Vous recevez des donnees reelles et des profils synthetiques proches.',
    'Objectif: resumer les tendances et facteurs contributifs sans fournir de prescription.',
    'Ne pas donner de recommandations de traitement individualisees.',
    'Sortie attendue: sections Markdown courtes: Resume, Evolution probable, Facteurs dominants, Limites.'
  ].join(' ');

  const user = [
    '### Donnees reelles',
    summarizeInput(inputs),
    '',
    '### Cohorte synthetique la plus proche',
    summarizeMatches(matches),
    '',
    '### Score calcule',
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
    'Tache: produire une synthese concise, expliquer les variables qui tirent le plus le risque vers le haut, et rappeler les limites de simulation.'
  ].join('\n');

  return { system, user };
}
