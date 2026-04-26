/**
 * ============================================================
 *  TEST PERSONNEL — Meror Backend
 *  Remplis tes données ci-dessous, puis lance :
 *    npm run test -- tests/test-perso.test.ts
 * ============================================================
 */

import { describe, it } from 'vitest';
import { runSimulationPipeline } from '@/lib/backend/pipeline';
import type { PipelineRequest } from '@/lib/backend/types';

// ─────────────────────────────────────────────
//  TES DONNÉES PERSONNELLES — MODIFIE ICI
// ─────────────────────────────────────────────

const MES_DONNEES: PipelineRequest = {
  inputs: {
    name: 'Tahri',            // ton prénom
    age: 25,                  // ton âge
    sex: 'male',              // 'male' | 'female' | 'other'
    heightCm: 178,            // taille en cm
    weightKg: 75,             // poids en kg
    sleepHours: 7,            // heures de sommeil par nuit (0-24)
    exerciseDaysPerWeek: 3,   // jours de sport par semaine (0-7)
    dietQuality: 3,           // qualité alimentation (1=mauvaise, 5=excellente)
    stressLevel: 3,           // niveau de stress (1=faible, 5=élevé)
    smokingStatus: 'never',   // 'never' | 'former' | 'current'
    alcoholDrinksPerWeek: 4,  // verres d'alcool par semaine (0-70)
    familyHistoryHeart: false,     // antécédents familiaux cardiaques
    familyHistoryDiabetes: false,  // antécédents familiaux diabète
    familyHistoryCancer: false,    // antécédents familiaux cancer
    existingConditions: []         // ex: ['hypertension', 'asthma'] ou []
  },

  // ─── MARQUEURS CLINIQUES (optionnels — laisse undefined si tu n'as pas) ───
  clinicalMarkers: {
    // totalCholesterolMgDl: 200,          // cholestérol total (mg/dL)
    // hdlMgDl: 55,                        // HDL (mg/dL)
    // systolicBloodPressureMmHg: 120,     // tension systolique (mmHg)
    onBloodPressureTreatment: false,       // sous traitement antihypertenseur ?
    // hasDiabetes: false,                 // diabétique ?
  },

  // ─── OPTIONS PIPELINE ────────────────────────────────────────────────────
  yearsOfHistory: 10,        // 5 ou 10 ans de projection
  kNearest: 3,               // patients synthétiques similaires (1-10)
  enableLlmSummary: true,    // active le résumé LLM open source (nécessite HUGGINGFACE_API_KEY)
  includePubMed: false,      // désactivé par défaut (plus lent, nécessite internet)
  enableLocalRagCache: true,
};

// ─────────────────────────────────────────────────────────────────────────────

function couleur(risque: number, seuil_ok: number, seuil_alerte: number) {
  if (risque <= seuil_ok) return '🟢';
  if (risque <= seuil_alerte) return '🟡';
  return '🔴';
}

function barre(score: number, max = 100, longueur = 20) {
  const rempli = Math.round((score / max) * longueur);
  return '█'.repeat(rempli) + '░'.repeat(longueur - rempli);
}

function afficherResultats(result: Awaited<ReturnType<typeof runSimulationPipeline>>) {
  const { profile, riskEvidence, llm, generatedAt, derivedClinicalMarkers } = result;
  const { inputs } = profile;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║         MEROR — PROFIL DE ${inputs.name.toUpperCase().padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Généré le : ${new Date(generatedAt).toLocaleString('fr-FR')}`);
  console.log();

  // ── Profil de base ──
  const bmi = (inputs.weightKg / Math.pow(inputs.heightCm / 100, 2)).toFixed(1);
  console.log('📋  PROFIL DE BASE');
  console.log('  ─────────────────────────────────────');
  console.log(`  Âge              : ${inputs.age} ans`);
  console.log(`  Sexe             : ${inputs.sex}`);
  console.log(`  IMC              : ${bmi} kg/m²`);
  console.log(`  Âge biologique   : ${profile.biologicalAge} ans`);
  console.log(`  Risque principal : ${profile.topRisk}`);
  console.log(`  Insight clé      : ${profile.keyInsight}`);
  console.log();

  // ── Scores de risque ──
  console.log('⚠️   SCORES DE RISQUE CLINIQUE');
  console.log('  ─────────────────────────────────────');
  const f = riskEvidence.framingham10YearRiskPercent;
  const a = riskEvidence.ascvdProxy10YearRiskPercent;
  const m = riskEvidence.metabolicSyndromeProxyRiskPercent;
  const al = riskEvidence.allostaticLoadIndex;
  const le8 = riskEvidence.lifeEssential8ProxyScore;
  const ls = riskEvidence.lifestyleScore;

  console.log(`  ${couleur(f, 5, 10)} Framingham 10 ans   : ${f.toFixed(1)}%  ${barre(f, 30)}`);
  console.log(`  ${couleur(a, 10, 20)} ASCVD proxy 10 ans  : ${a.toFixed(1)}%  ${barre(a, 50)}`);
  console.log(`  ${couleur(m, 20, 40)} Syndrome métabolique : ${m.toFixed(1)}%  ${barre(m, 80)}`);
  console.log(`  ${couleur(al, 2, 4)} Charge allostatique : ${al}/10   ${barre(al, 10)}`);
  console.log(`  ${couleur(100 - le8, 30, 50)} Life Essential 8    : ${le8.toFixed(0)}/100  ${barre(le8)}`);
  console.log(`  ${couleur(100 - ls, 30, 50)} Score lifestyle     : ${ls.toFixed(0)}/100  ${barre(ls)}`);
  console.log();

  // ── Risques globaux (TwinProfile) ──
  console.log('🧬  RISQUES GLOBAUX (TwinProfile)');
  console.log('  ─────────────────────────────────────');
  const r = profile.risks;
  console.log(`  Cardiovasculaire  : ${r.cardiovascular.toFixed(0)}/100  ${barre(r.cardiovascular)}`);
  console.log(`  Métabolique       : ${r.metabolic.toFixed(0)}/100  ${barre(r.metabolic)}`);
  console.log(`  Résilience mentale: ${r.mentalResilience.toFixed(0)}/100  ${barre(r.mentalResilience)}`);
  console.log(`  Longévité         : ${r.longevity.toFixed(0)}/100  ${barre(r.longevity)}`);
  console.log(`  Score global      : ${r.overall.toFixed(0)}/100  ${barre(r.overall)}`);
  console.log();

  // ── Marqueurs cliniques utilisés (fournis vs estimés depuis le questionnaire) ──
  if (derivedClinicalMarkers) {
    const labels: Record<string, string> = {
      'user-provided': '✅ Fournis par toi',
      'synthea-matched-cohort': '🧬 Estimés depuis une cohorte Synthea',
      mixed: '🧬 Fournis par toi et complétés depuis Synthea'
    };
    console.log('🔬  MARQUEURS CLINIQUES UTILISÉS POUR LE CALCUL DES RISQUES');
    console.log('  ─────────────────────────────────────');
    console.log(`  Source : ${labels[derivedClinicalMarkers.source]}`);
    console.log(`  Méthode : ${derivedClinicalMarkers.estimationMethod}`);
    console.log(`  Cholestérol total : ${derivedClinicalMarkers.totalCholesterolMgDl ?? 'NA'} mg/dL`);
    console.log(`  HDL               : ${derivedClinicalMarkers.hdlMgDl ?? 'NA'} mg/dL`);
    console.log(`  Tension systolique: ${derivedClinicalMarkers.systolicBloodPressureMmHg ?? 'NA'} mmHg`);
    if (derivedClinicalMarkers.warnings.length > 0) {
      derivedClinicalMarkers.warnings.forEach(w => console.log(`  ⚠️ ${w}`));
    }
    console.log();
  }

  // ── Hypothèses utilisées ──
  if (riskEvidence.assumptions.length > 0) {
    console.log('💡  HYPOTHÈSES (estimées, non fournies)');
    console.log('  ─────────────────────────────────────');
    riskEvidence.assumptions.forEach(a => console.log(`  • ${a}`));
    console.log();
  }

  // ── Résumé LLM ──
  if (llm) {
    console.log(`🤖  RÉSUMÉ LLM (${llm.provider === 'anthropic' ? `Anthropic ${llm.model}` : 'Fallback déterministe'})`);
    console.log('  ─────────────────────────────────────');
    llm.summary.split('\n').forEach(line => console.log(`  ${line}`));
    console.log();
  } else {
    console.log('🤖  RÉSUMÉ LLM : désactivé (enableLlmSummary: false)');
    console.log();
  }

  // ── Légende ──
  console.log('  🟢 = faible risque   🟡 = modéré   🔴 = élevé');
  console.log('  Les barres ░░ représentent le niveau relatif (plein = maximum)');
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Test personnel Meror', () => {
  it('lance le pipeline complet avec mes données et affiche les résultats', async () => {
    console.log('\n⏳ Lancement du pipeline...');

    const result = await runSimulationPipeline(MES_DONNEES);

    afficherResultats(result);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📤  PROMPT ENVOYÉ AU LLM (system + user)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('--- SYSTEM ---');
    console.log(result.prompt.system);
    console.log('\n--- USER ---');
    console.log(result.prompt.user);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Assertions minimales pour valider que le pipeline a bien tourné
    const { riskEvidence, profile } = result;

    if (riskEvidence.framingham10YearRiskPercent < 0 || riskEvidence.framingham10YearRiskPercent > 100) {
      throw new Error(`Framingham hors bornes: ${riskEvidence.framingham10YearRiskPercent}`);
    }
    if (!profile.topRisk || !profile.keyInsight) {
      throw new Error('Profil incomplet (topRisk ou keyInsight manquant)');
    }
  }, 60_000); // timeout 60s pour le LLM
});
