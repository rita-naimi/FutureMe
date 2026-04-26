#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/api/pipeline}"

ask() {
  local label="$1"
  local default_value="$2"
  local value
  read -r -p "$label [$default_value]: " value
  if [[ -z "$value" ]]; then
    value="$default_value"
  fi
  printf '%s' "$value"
}

ask_bool() {
  local label="$1"
  local default_value="$2"
  local value
  while true; do
    read -r -p "$label (true/false) [$default_value]: " value
    if [[ -z "$value" ]]; then
      value="$default_value"
    fi
    if [[ "$value" == "true" || "$value" == "false" ]]; then
      printf '%s' "$value"
      return 0
    fi
    echo "Valeur invalide. Tape true ou false."
  done
}

ask_choice() {
  local label="$1"
  local default_value="$2"
  local options="$3"
  local value
  while true; do
    read -r -p "$label $options [$default_value]: " value
    if [[ -z "$value" ]]; then
      value="$default_value"
    fi
    for opt in $options; do
      if [[ "$value" == "$opt" ]]; then
        printf '%s' "$value"
        return 0
      fi
    done
    echo "Choix invalide. Options: $options"
  done
}

echo "=== Questionnaire medical de base (demo) ==="
echo ""
echo "Donnees a fournir:"
echo "1. Identite: name, age, sex"
echo "2. Anthropometrie: heightCm, weightKg"
echo "3. Habitudes: sleepHours, exerciseDaysPerWeek, dietQuality, stressLevel"
echo "4. Facteurs: smokingStatus, alcoholDrinksPerWeek"
echo "5. Historique: familyHistoryHeart, familyHistoryDiabetes, familyHistoryCancer"
echo "6. Conditions existantes: existingConditions[]"
echo ""

NAME="$(ask 'Nom' 'Sam')"
AGE="$(ask 'Age' '52')"
SEX="$(ask_choice 'Sexe' 'male' 'male female other')"
HEIGHT_CM="$(ask 'Taille (cm)' '181')"
WEIGHT_KG="$(ask 'Poids (kg)' '103')"
SLEEP_HOURS="$(ask 'Sommeil (h/nuit)' '5.5')"
EXERCISE_DAYS="$(ask 'Exercice (jours/semaine)' '1')"
DIET_QUALITY="$(ask 'Qualite alimentation (1-5)' '2')"
STRESS_LEVEL="$(ask 'Stress (1-5)' '5')"
SMOKING_STATUS="$(ask_choice 'Tabac' 'current' 'never former current')"
ALCOHOL_WEEK="$(ask 'Alcool (verres/semaine)' '14')"
FAMILY_HEART="$(ask_bool 'Antecedent familial coeur' 'true')"
FAMILY_DIABETES="$(ask_bool 'Antecedent familial diabete' 'true')"
FAMILY_CANCER="$(ask_bool 'Antecedent familial cancer' 'false')"
CONDITIONS_RAW="$(ask 'Conditions existantes (separees par virgules)' 'hypertension')"
YEARS_HISTORY="$(ask_choice 'Historique synthetique (ans)' '5' '5 10')"
K_NEAREST="$(ask 'k patients synthetiques proches' '3')"
INCLUDE_PUBMED="$(ask_bool 'Inclure PubMed' 'true')"
PUBMED_MAX="$(ask 'Nombre max articles PubMed (1-5)' '2')"
ENABLE_LLM="$(ask_bool 'Activer synthese LLM' 'true')"
ENABLE_RAG_CACHE="$(ask_bool 'Activer cache RAG local' 'true')"

export NAME AGE SEX HEIGHT_CM WEIGHT_KG SLEEP_HOURS EXERCISE_DAYS DIET_QUALITY STRESS_LEVEL
export SMOKING_STATUS ALCOHOL_WEEK FAMILY_HEART FAMILY_DIABETES FAMILY_CANCER CONDITIONS_RAW
export YEARS_HISTORY K_NEAREST INCLUDE_PUBMED PUBMED_MAX ENABLE_LLM ENABLE_RAG_CACHE

node -e "
const fs = require('fs');

const conditions = process.env.CONDITIONS_RAW
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const payload = {
  inputs: {
    name: process.env.NAME,
    age: Number(process.env.AGE),
    sex: process.env.SEX,
    heightCm: Number(process.env.HEIGHT_CM),
    weightKg: Number(process.env.WEIGHT_KG),
    sleepHours: Number(process.env.SLEEP_HOURS),
    exerciseDaysPerWeek: Number(process.env.EXERCISE_DAYS),
    dietQuality: Number(process.env.DIET_QUALITY),
    stressLevel: Number(process.env.STRESS_LEVEL),
    smokingStatus: process.env.SMOKING_STATUS,
    alcoholDrinksPerWeek: Number(process.env.ALCOHOL_WEEK),
    familyHistoryHeart: process.env.FAMILY_HEART === 'true',
    familyHistoryDiabetes: process.env.FAMILY_DIABETES === 'true',
    familyHistoryCancer: process.env.FAMILY_CANCER === 'true',
    existingConditions: conditions
  },
  yearsOfHistory: Number(process.env.YEARS_HISTORY),
  kNearest: Number(process.env.K_NEAREST),
  includePubMed: process.env.INCLUDE_PUBMED === 'true',
  pubMedMaxArticles: Number(process.env.PUBMED_MAX),
  enableLlmSummary: process.env.ENABLE_LLM === 'true',
  enableLocalRagCache: process.env.ENABLE_RAG_CACHE === 'true'
};

fs.writeFileSync('/tmp/meror-questionnaire-payload.json', JSON.stringify(payload, null, 2));
"

echo "Payload questionnaire (envoye a l'API):"
cat /tmp/meror-questionnaire-payload.json

echo ""
echo "=== Requete API en cours ==="

http_code="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || true)"
if [[ "$http_code" == "000" ]]; then
  echo ""
  echo "Impossible de joindre localhost."
  echo "Cause probable: serveur Next.js non demarre ou lance dans le mauvais dossier."
  echo "Commande correcte:"
  echo "  npm --prefix /Users/tahrihassani/Documents/hackathon/Meror run dev"
  exit 7
fi

response="$(curl -sS -X POST "$API_URL" -H 'Content-Type: application/json' --data-binary @/tmp/meror-questionnaire-payload.json)"

echo "$response" > /tmp/meror-questionnaire-response.json

echo ""
echo "=== Reaction de la LLM ==="
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/meror-questionnaire-response.json', 'utf8'));
if (!data.llm) {
  console.log('Aucune sortie LLM (champ llm absent).');
  process.exit(0);
}
console.log('Modele:', data.llm.model);
console.log('Provider:', data.llm.provider);
console.log('');
console.log(data.llm.summary || '(summary vide)');
"

echo ""
echo "=== Indices de score ==="
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/meror-questionnaire-response.json', 'utf8'));
const r = data.riskEvidence || {};
console.log('Framingham 10y:', r.framingham10YearRiskPercent);
console.log('ASCVD proxy 10y:', r.ascvdProxy10YearRiskPercent);
console.log('Metabolic syndrome proxy:', r.metabolicSyndromeProxyRiskPercent);
console.log('Allostatic load:', r.allostaticLoadIndex);
console.log('Life Essential 8 proxy:', r.lifeEssential8ProxyScore);
console.log('Lifestyle score:', r.lifestyleScore);
"
