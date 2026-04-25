# FutureMe
## Talk to the person your habits are building.

## Backend MVP (user profile + risk + LLM context)

Une implementation backend a ete ajoutee pour demarrer le pipeline du guide:

- Ingestion d'un profil patient (payload JSON)
- Estimation explicite des marqueurs cliniques manquants depuis le questionnaire utilisateur
- Calcul d'indices de sante: Framingham, ASCVD proxy, metabolic syndrome proxy, allostatic load, Life Essential 8 proxy, lifestyle score
- Recuperation contextuelle PubMed via eUtils NCBI
- Generation de synthese clinique via Claude Sonnet 4 cote serveur avec fallback local explicite
- Construction d'un prompt structure pret pour un LLM biomedical

### Endpoint

- `POST /api/pipeline`

Exemple de payload:

```json
{
	"inputs": {
		"name": "Test User",
		"age": 52,
		"sex": "male",
		"heightCm": 181,
		"weightKg": 104,
		"sleepHours": 5.6,
		"exerciseDaysPerWeek": 0,
		"dietQuality": 2,
		"stressLevel": 5,
		"smokingStatus": "current",
		"alcoholDrinksPerWeek": 18,
		"familyHistoryHeart": true,
		"familyHistoryDiabetes": true,
		"familyHistoryCancer": false,
		"existingConditions": ["hypertension"]
	},
	"yearsOfHistory": 5,
	"kNearest": 2,
	"clinicalMarkers": {
		"totalCholesterolMgDl": 220,
		"hdlMgDl": 45,
		"systolicBloodPressureMmHg": 135,
		"onBloodPressureTreatment": true,
		"hasDiabetes": true
	}
}
```

La reponse inclut:

- `profile`: profil Twin/FHIR existant
- `derivedClinicalMarkers`: marqueurs fournis ou estimes depuis le questionnaire
- `riskEvidence`: indices de score + hypotheses
- `pubmed`: query + articles contextuels
- `llm`: synthese generee (si activee)
- `prompt`: bloc system/user a transmettre au LLM

### Front (mode optionnel backend)

Pour activer le branchement front sur `/api/pipeline` depuis onboarding/simulate:

```bash
NEXT_PUBLIC_USE_PIPELINE_API=1
```

### Modele LLM Claude

Par defaut, le backend utilise Anthropic avec `claude-sonnet-4-6`. La cle API reste cote serveur et ne doit jamais etre exposee avec un prefixe `NEXT_PUBLIC_`.

Variables utiles:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_CHAT_MODEL=claude-sonnet-4-6
ANTHROPIC_CLINICAL_MODEL=claude-sonnet-4-6
ANTHROPIC_CHAT_MAX_TOKENS=700
ANTHROPIC_CLINICAL_MAX_TOKENS=900
```

`ANTHROPIC_CHAT_MODEL` controle le chat `/api/chat`; `ANTHROPIC_CLINICAL_MODEL` controle la synthese `/api/pipeline`. Les plafonds `MAX_TOKENS` limitent la longueur des sorties pour garder la consommation de credits raisonnable. Si Claude n'est pas disponible ou si la cle manque de credit, l'application affiche explicitement le fallback local au lieu de masquer l'erreur.

### Tests

```bash
npm run test
```
