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
  return matches
    .map((match, index) => {
      const m = match.inputs;
      const cm = match.clinicalMarkers;
      const clinical = cm
        ? ` | TC ${cm.totalCholesterolMgDl ?? 'NA'} mg/dL, HDL ${cm.hdlMgDl ?? 'NA'} mg/dL, PAS ${cm.systolicBloodPressureMmHg ?? 'NA'} mmHg`
        : '';
      return [
        `${index + 1}. ${match.name} — snapshot baseline il y a ${yearsBefore} ans (distance ${match.distance}, similarite ${match.similarity})`,
        `   Age a l'epoque: ${m.age}, sexe ${m.sex}, tabac ${m.smokingStatus}, sommeil ${m.sleepHours}h, exercice ${m.exerciseDaysPerWeek}j${clinical}`
      ].join('\n');
    })
    .join('\n');
}

function summarizeDerivedMarkers(derived: DerivedClinicalMarkers | undefined, yearsBefore: number) {
  if (!derived) return null;
  const sourceLabel =
    derived.source === 'user-provided'
      ? 'fournis par le patient (etat actuel)'
      : derived.source === 'cohort-knn'
        ? `derives de la cohorte synthetique k-NN Synthea — represente l'etat biologique probable du patient il y a ${yearsBefore} ans`
        : 'estimes par proxy IMC/lifestyle';
  return [
    `### Marqueurs cliniques (${sourceLabel})`,
    `Cholesterol total: ${derived.totalCholesterolMgDl ?? 'NA'} mg/dL`,
    `HDL: ${derived.hdlMgDl ?? 'NA'} mg/dL`,
    `Pression arterielle systolique: ${derived.systolicBloodPressureMmHg ?? 'NA'} mmHg`
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
    `Vous recevez deux types de donnees: (1) les donnees REELLES actuelles du patient, (2) une cohorte synthetique Synthea matchee par k-NN contre un profil RETRO-PROJETE du patient (age - ${yearsOfHistory} ans, IMC legerement reduit), representant son etat probable il y a ${yearsOfHistory} ans.`,
    `Les marqueurs cliniques (cholesterol, HDL, tension) derives de cette cohorte k-NN doivent etre interpretes comme une BASELINE PASSEE (etat il y a ${yearsOfHistory} ans), PAS comme l'etat actuel.`,
    'Objectif: comparer la trajectoire passe -> present, identifier les facteurs ayant evolue, et projeter l\'evolution future probable si les habitudes restent inchangees.',
    'Ne pas donner de recommandations de traitement individualisees. Ne pas inventer de valeurs.',
    'Sortie attendue: sections Markdown courtes: Resume, Trajectoire (passe -> present), Evolution probable a 5-10 ans, Facteurs dominants, Limites.'
  ].join(' ');

  const markersBlock = summarizeDerivedMarkers(derivedMarkers, yearsOfHistory);

  const user = [
    `### Donnees reelles ACTUELLES du patient (T0 = aujourd'hui)`,
    summarizeInput(inputs),
    '',
    `### Cohorte synthetique Synthea — snapshot retrospectif a T0 - ${yearsOfHistory} ans`,
    `Ces patients synthetiques sont les ${matches.length} plus proches du profil RETRO-PROJETE du patient (age - ${yearsOfHistory} ans). Leurs valeurs representent la BASELINE PASSEE probable du patient il y a ${yearsOfHistory} ans (point de comparaison historique, pas etat actuel).`,
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
    `Tache: (1) decrire la trajectoire passe (cohorte Synthea T0-${yearsOfHistory}) -> present (donnees reelles), (2) identifier les variables ayant le plus evolue, (3) projeter l'evolution probable a +5/+10 ans si trends inchangees, (4) rappeler les limites de simulation.`
  ].join('\n');

  return { system, user };
}
