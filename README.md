# FutureMe
## Talk to the person your habits are building.

## Backend MVP (user profile + risk + LLM context)

Une implementation backend a ete ajoutee pour demarrer le pipeline du guide:

- Ingestion d'un profil patient (payload JSON)
- Estimation explicite des marqueurs cliniques manquants depuis le questionnaire utilisateur
- Calcul d'indices de sante: Framingham, ASCVD proxy, metabolic syndrome proxy, allostatic load, Life Essential 8 proxy, lifestyle score
- Recuperation contextuelle PubMed via eUtils NCBI
- Generation de synthese clinique via un modele open source/open-weight sur Hugging Face avec fallback local explicite
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

### Modele LLM open source

Par defaut, le backend utilise Hugging Face Inference Providers avec `openai/gpt-oss-120b:fastest`.

Variables utiles:

```bash
HUGGINGFACE_API_KEY=hf_xxxxx
HF_MODEL=openai/gpt-oss-120b:fastest
HF_CHAT_MODEL=openai/gpt-oss-120b:fastest
HF_CLINICAL_MODEL=openai/gpt-oss-120b:fastest
HF_CHAT_MAX_TOKENS=900
HF_CLINICAL_MAX_TOKENS=1100
```

`HF_CHAT_MODEL` controle le chat `/api/chat`; `HF_CLINICAL_MODEL` controle la synthese `/api/pipeline`. Si le modele live n'est pas disponible, l'application affiche explicitement le fallback local au lieu de masquer l'erreur.

### Tests

```bash
npm run test
```
