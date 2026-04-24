# FutureMe
## Talk to the person your habits are building.

## Backend MVP (real + synthetic + risk + LLM context)

Une implementation backend a ete ajoutee pour demarrer le pipeline du guide:

- Ingestion d'un profil patient (payload JSON)
- Matching sur une cohorte de bundles FHIR Synthea (`data/synthea/fhir/*.json`)
- Calcul d'indices de sante: Framingham, ASCVD proxy, metabolic syndrome proxy, allostatic load, Life Essential 8 proxy, lifestyle score
- Recuperation contextuelle PubMed via eUtils NCBI
- Generation de synthese clinique via BioMistral (`BioMistral/BioMistral-7B`) avec fallback local
- Construction d'un prompt structure pret pour un LLM biomedical

### Endpoint

- `POST /api/pipeline`

Exemple de payload:

```json
{
	"inputs": {
		"name": "James",
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
- `matching`: patients synthetiques les plus proches
- `riskEvidence`: indices de score + hypotheses
- `pubmed`: query + articles contextuels
- `llm`: synthese generee (si activee)
- `prompt`: bloc system/user a transmettre au LLM

### Front (mode optionnel backend)

Pour activer le branchement front sur `/api/pipeline` depuis onboarding/simulate:

```bash
NEXT_PUBLIC_USE_PIPELINE_API=1
```

### Tests

```bash
npm run test
```
