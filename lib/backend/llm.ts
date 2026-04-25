import type { HealthInputs } from '@/lib/fhir';
import type { LlmOutput, PromptPayload, PubMedArticle, RiskEvidence } from './types';

const MODEL_ID = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

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

async function generateWithHuggingFace(systemMsg: string, userMsg: string): Promise<string> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new Error('Missing HUGGINGFACE_API_KEY');
  }

  const response = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg }
      ],
      max_tokens: 420,
      temperature: 0.2,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`HuggingFace request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (text) return text;

  throw new Error('No content returned by model');
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

  try {
    const summary = await generateWithHuggingFace(params.prompt.system, userMsg);
    return {
      model: MODEL_ID,
      summary,
      provider: 'huggingface'
    };
  } catch {
    return {
      model: MODEL_ID,
      summary: fallbackSummary(params.inputs, params.riskEvidence, params.pubmedArticles.length),
      provider: 'fallback'
    };
  }
}
