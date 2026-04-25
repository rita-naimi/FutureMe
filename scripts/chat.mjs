#!/usr/bin/env node
/**
 * ============================================================
 *  CHAT LIVE avec BioMistral-7B — FutureMe
 *
 *  Usage :
 *    1. Démarre le serveur Next.js dans un autre terminal :
 *         npm run dev
 *    2. Exporte ta clé HuggingFace :
 *         export HUGGINGFACE_API_KEY=hf_xxxxx
 *    3. Modifie MES_DONNEES ci-dessous
 *    4. Lance :
 *         node scripts/chat.mjs
 *
 *  Commandes pendant le chat :
 *    /quit        quitter
 *    /reset       effacer l'historique de conversation
 *    /context     afficher le system prompt
 *    /risks       afficher les risques calculés
 *    /help        afficher l'aide
 * ============================================================
 */

import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

// ─────────────────────────────────────────────
//  TES DONNÉES — MODIFIE ICI
// ─────────────────────────────────────────────
const MES_DONNEES = {
  inputs: {
    name: 'Tahri',
    age: 25,
    sex: 'male',
    heightCm: 178,
    weightKg: 75,
    sleepHours: 7,
    exerciseDaysPerWeek: 3,
    dietQuality: 3,
    stressLevel: 3,
    smokingStatus: 'never',
    alcoholDrinksPerWeek: 4,
    familyHistoryHeart: false,
    familyHistoryDiabetes: false,
    familyHistoryCancer: false,
    existingConditions: []
  },
  yearsOfHistory: 10,
  kNearest: 3,
  enableLlmSummary: false,
  includePubMed: false
};

const PIPELINE_URL = process.env.PIPELINE_URL || 'http://localhost:3000/api/pipeline';
const MODEL_ID = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';  //meta-llama/Llama-3.1-8B-Instruct
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

// ─── couleurs ANSI ──────────────────────────────────────────
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', gray: '\x1b[90m'
};
function log(color, ...args) { console.log(color + args.join(' ') + C.reset); }

// ─── vérifs préalables ──────────────────────────────────────
if (!process.env.HUGGINGFACE_API_KEY) {
  log(C.red, '❌ HUGGINGFACE_API_KEY manquant. Exporte-le d\'abord :');
  log(C.dim, '   export HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx');
  process.exit(1);
}

// ─── 1. lance le pipeline pour obtenir le contexte twin ─────
async function runPipeline() {
  log(C.dim, `⏳ Appel pipeline (${PIPELINE_URL})...`);
  let res;
  try {
    res = await fetch(PIPELINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(MES_DONNEES)
    });
  } catch (err) {
    log(C.red, `❌ Pipeline injoignable : ${err.message}`);
    log(C.yellow, '   Lance `npm run dev` dans un autre terminal d\'abord.');
    process.exit(1);
  }
  if (!res.ok) {
    log(C.red, `❌ Pipeline a répondu ${res.status} ${res.statusText}`);
    log(C.dim, await res.text());
    process.exit(1);
  }
  return res.json();
}

// ─── 2. construit le system prompt ──────────────────────────
function buildSystemPrompt(pipeline) {
  const { profile, riskEvidence, derivedClinicalMarkers } = pipeline;
  const i = profile.inputs;
  const r = profile.risks;
  const yrs = MES_DONNEES.yearsOfHistory;

  const markersLine = derivedClinicalMarkers
    ? `Cholestérol total ${derivedClinicalMarkers.totalCholesterolMgDl ?? 'NA'} mg/dL, HDL ${derivedClinicalMarkers.hdlMgDl ?? 'NA'} mg/dL, PAS ${derivedClinicalMarkers.systolicBloodPressureMmHg ?? 'NA'} mmHg (source: ${derivedClinicalMarkers.source})`
    : 'non disponibles';

  return `Tu es le "futur soi" de ${i.name}, ${i.age + yrs} ans (soit ${yrs} ans dans le futur). Tu parles à ton "toi présent" (${i.age} ans) en français, à la première personne.

Profil santé actuel de ton "toi présent" :
- ${i.sex}, ${i.heightCm} cm, ${i.weightKg} kg, IMC ${(i.weightKg / Math.pow(i.heightCm / 100, 2)).toFixed(1)}
- Sommeil ${i.sleepHours}h/nuit, sport ${i.exerciseDaysPerWeek}j/sem, alimentation ${i.dietQuality}/5, stress ${i.stressLevel}/5
- Tabac ${i.smokingStatus}, alcool ${i.alcoholDrinksPerWeek} verres/sem
- ATCD familiaux : cœur=${i.familyHistoryHeart}, diabète=${i.familyHistoryDiabetes}, cancer=${i.familyHistoryCancer}

Risques calculés :
- Framingham 10 ans : ${riskEvidence.framingham10YearRiskPercent}%
- ASCVD proxy : ${riskEvidence.ascvdProxy10YearRiskPercent}%
- Syndrome métabolique : ${riskEvidence.metabolicSyndromeProxyRiskPercent}%
- Charge allostatique : ${riskEvidence.allostaticLoadIndex}/10
- Life Essential 8 : ${riskEvidence.lifeEssential8ProxyScore}/100
- Lifestyle score : ${riskEvidence.lifestyleScore}/100
- Cardio global ${r.cardiovascular}/100, métabolique ${r.metabolic}/100, longévité ${r.longevity}/100
- Âge biologique estimé : ${profile.biologicalAge} ans

Marqueurs cliniques : ${markersLine}

Insight clé : ${profile.keyInsight}
Risque dominant : ${profile.topRisk}

Consignes :
- Réponds en français, ton chaleureux et concret, pas paternaliste
- Base tes réponses sur les chiffres ci-dessus
- Pas de prescription médicale individualisée
- Rappelle que c'est une simulation de prévention
- 3 à 6 phrases max sauf demande explicite`;
}

// ─── 3. appel HuggingFace via Inference Providers (OpenAI-compatible) ──
async function callHuggingFaceStreaming(systemPrompt, history, userMsg, onToken) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMsg }
  ];

  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages,
      max_tokens: 600,
      temperature: 0.3,
      stream: true
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HF ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { onToken(delta); full += delta; }
      } catch { /* ignore */ }
    }
  }
  return full;
}

// ─── 5. boucle de chat ──────────────────────────────────────
async function chat(systemPrompt, pipelineSnapshot) {
  const history = [];
  const rl = readline.createInterface({ input, output });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  log(C.cyan + C.bold, '\n╔════════════════════════════════════════════════════════════╗');
  log(C.cyan + C.bold, `║  CHAT avec ton futur toi (+${MES_DONNEES.yearsOfHistory} ans) — ${MODEL_ID}`);
  log(C.cyan + C.bold, '╚════════════════════════════════════════════════════════════╝');
  log(C.dim, `Tape /help pour les commandes, /quit pour sortir.\n`);

  while (true) {
    const userMsg = (await ask(C.green + 'toi> ' + C.reset)).trim();
    if (!userMsg) continue;

    if (userMsg === '/quit' || userMsg === '/exit') {
      log(C.dim, 'À bientôt.');
      rl.close();
      return;
    }
    if (userMsg === '/help') {
      log(C.yellow, '  /quit     — quitter');
      log(C.yellow, '  /reset    — effacer l\'historique');
      log(C.yellow, '  /context  — réafficher le system prompt');
      log(C.yellow, '  /risks    — afficher les risques calculés');
      continue;
    }
    if (userMsg === '/reset') {
      history.length = 0;
      log(C.dim, '  ↻ historique effacé');
      continue;
    }
    if (userMsg === '/context') {
      log(C.gray, systemPrompt);
      continue;
    }
    if (userMsg === '/risks') {
      const r = pipelineSnapshot.riskEvidence;
      log(C.magenta, `  Framingham=${r.framingham10YearRiskPercent}% | ASCVD=${r.ascvdProxy10YearRiskPercent}% | Métabolique=${r.metabolicSyndromeProxyRiskPercent}% | Allostatic=${r.allostaticLoadIndex}/10 | LE8=${r.lifeEssential8ProxyScore}/100 | Lifestyle=${r.lifestyleScore}/100`);
      continue;
    }

    process.stdout.write(C.magenta + 'futur> ' + C.reset);

    try {
      const fullText = await callHuggingFaceStreaming(systemPrompt, history, userMsg, (tok) => {
        process.stdout.write(tok);
      });
      process.stdout.write('\n\n');
      history.push({ role: 'user', content: userMsg });
      history.push({ role: 'assistant', content: fullText.trim() });
    } catch (err) {
      log(C.red, `\n  ❌ ${err.message}`);
      if (err.message.includes('503') || err.message.includes('loading')) {
        log(C.yellow, '  💤 BioMistral est en train de se charger sur HF (cold start), réessaie dans 30s.');
      }
      console.log();
    }
  }
}

// ─── main ───────────────────────────────────────────────────
const pipeline = await runPipeline();
log(C.green, '✅ Pipeline OK');
log(C.dim, `   ${pipeline.riskEvidence.evidence.length} évidences cliniques`);
const systemPrompt = buildSystemPrompt(pipeline);
await chat(systemPrompt, pipeline);
