import type { HealthInputs } from '@/lib/fhir';
import {
  generateAnthropicText,
  getConfiguredAnthropicModel,
  getPositiveNumberFromEnv
} from './anthropic';
import type { LlmOutput, PromptPayload, PubMedArticle, RiskEvidence } from './types';

function buildPubMedSection(articles: PubMedArticle[]) {
  if (articles.length === 0) {
    return 'Aucun article PubMed additionnel n a ete recupere en temps reel.';
  }

  return articles
    .map((article, index) => {
      return [
        `${index + 1}) PMID ${article.pmid} - ${article.title}`,
        `Journal: ${article.journal ?? 'N/A'} (${article.year ?? 'N/A'})`,
        `Abstract: ${article.abstractSnippet ?? 'N/A'}`
      ].join('\n');
    })
    .join('\n\n');
}

function buildUserMessage(prompt: PromptPayload, articles: PubMedArticle[]) {
  return [
    prompt.user,
    '',
    '### Contexte PubMed (utiliser uniquement comme support, ne pas inventer de citation)',
    buildPubMedSection(articles),
    '',
    'Instruction finale: produire une synthese clinique de prevention en francais, concise, structuree et sans recommandation therapeutique personnalisee.'
  ].join('\n');
}

async function generateWithAnthropic(systemMsg: string, userMsg: string, model: string): Promise<string> {
  return generateAnthropicText({
    model,
    system: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: getPositiveNumberFromEnv('ANTHROPIC_CLINICAL_MAX_TOKENS', 900),
    temperature: getPositiveNumberFromEnv('ANTHROPIC_CLINICAL_TEMPERATURE', 0.2)
  });
}

function fallbackSummary(inputs: HealthInputs, risk: RiskEvidence, pubmedArticlesCount: number) {
  return [
    'Resume',
    `${inputs.name}, ${inputs.age} ans, presente un risque Framingham a 10 ans de ${risk.framingham10YearRiskPercent}% avec un proxy ASCVD a ${risk.ascvdProxy10YearRiskPercent}%.`,
    '',
    'Facteurs dominants',
    `Le profil metabolique proxy est a ${risk.metabolicSyndromeProxyRiskPercent}% et la charge allostatique a ${risk.allostaticLoadIndex}/10, ce qui suggere une contribution conjointe stress-mode de vie-metabolisme.`,
    '',
    'Contexte scientifique',
    `${pubmedArticlesCount} article(s) PubMed ont ete inclus pour contextualiser les tendances de prevention cardiovasculaire et metabolique.`,
    '',
    'Limites',
    'Cette synthese reste un outil de simulation et ne remplace pas une evaluation clinique.'
  ].join('\n');
}

export async function generateClinicalSummary(params: {
  inputs: HealthInputs;
  riskEvidence: RiskEvidence;
  prompt: PromptPayload;
  pubmedArticles: PubMedArticle[];
}): Promise<LlmOutput> {
  const userMsg = buildUserMessage(params.prompt, params.pubmedArticles);
  const model = getConfiguredAnthropicModel('ANTHROPIC_CLINICAL_MODEL', 'ANTHROPIC_MODEL');

  try {
    const summary = await generateWithAnthropic(params.prompt.system, userMsg, model);
    return {
      model,
      summary,
      provider: 'anthropic'
    };
  } catch {
    return {
      model,
      summary: fallbackSummary(params.inputs, params.riskEvidence, params.pubmedArticles.length),
      provider: 'fallback'
    };
  }
}
