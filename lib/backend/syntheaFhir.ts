import syntheaAlexBundle from '@/data/synthea/fhir/synthea-alex.json';
import syntheaJamesBundle from '@/data/synthea/fhir/synthea-james.json';
import syntheaMayaBundle from '@/data/synthea/fhir/synthea-maya.json';
import type { HealthInputs } from '@/lib/fhir';

interface Coding {
  code?: string;
  display?: string;
}

interface Codeable {
  text?: string;
  coding?: Coding[];
}

interface Quantity {
  value?: number;
  unit?: string;
}

interface GenericResource {
  resourceType: string;
  id?: string;
  name?: Array<{ text?: string }>;
  gender?: string;
  birthDate?: string;
  code?: Codeable;
  valueQuantity?: Quantity;
  valueString?: string;
  valueCodeableConcept?: Codeable;
}

interface BundleEntry {
  resource?: GenericResource;
}

interface BundleLike {
  resourceType: 'Bundle';
  entry?: BundleEntry[];
}

const BUNDLES: Array<{ syntheticId: string; bundle: BundleLike }> = [
  { syntheticId: 'synthea-alex', bundle: syntheaAlexBundle as BundleLike },
  { syntheticId: 'synthea-james', bundle: syntheaJamesBundle as BundleLike },
  { syntheticId: 'synthea-maya', bundle: syntheaMayaBundle as BundleLike }
];

const LOINC = {
  sleep: '93832-4',
  bmi: '39156-5',
  exercise: '68516-4',
  diet: '75302-0',
  stress: '72133-2',
  smoking: '72166-2',
  alcohol: '74013-4',
  systolicBp: '8480-6',
  totalCholesterol: '2093-3',
  hdl: '2085-9'
};

function yearsOld(birthDate?: string) {
  if (!birthDate) return 40;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(1, age);
}

function normalizeSex(gender?: string): HealthInputs['sex'] {
  if (gender === 'male' || gender === 'female' || gender === 'other') return gender;
  return 'other';
}

function isObservation(resource: GenericResource): boolean {
  return resource.resourceType === 'Observation';
}

function isPatient(resource: GenericResource): boolean {
  return resource.resourceType === 'Patient';
}

function isCondition(resource: GenericResource): boolean {
  return resource.resourceType === 'Condition';
}

function isDefinedResource(resource: GenericResource | undefined): resource is GenericResource {
  return Boolean(resource);
}

function findObsValue(obs: GenericResource[], code: string): number | undefined {
  const hit = obs.find((o) => o.code?.coding?.some((c) => c.code === code));
  const value = hit?.valueQuantity?.value;
  return typeof value === 'number' ? value : undefined;
}

function findObsString(obs: GenericResource[], code: string): string | undefined {
  const hit = obs.find((o) => o.code?.coding?.some((c) => c.code === code));
  return hit?.valueString ?? hit?.valueCodeableConcept?.text;
}

function boolFromKeyword(values: string[], keyword: string) {
  return values.some((value) => value.toLowerCase().includes(keyword));
}

function inferConditions(bundle: BundleLike) {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource).filter(Boolean) as GenericResource[];
  const conditionTexts = resources
    .filter((resource) => isCondition(resource))
    .map((condition) => {
      return condition.code?.text ?? condition.code?.coding?.map((c) => c.display).filter(Boolean).join(' ') ?? '';
    })
    .filter((text): text is string => Boolean(text));

  return {
    familyHistoryHeart: boolFromKeyword(conditionTexts, 'cardio') || boolFromKeyword(conditionTexts, 'hypertension'),
    familyHistoryDiabetes: boolFromKeyword(conditionTexts, 'diabet'),
    familyHistoryCancer: boolFromKeyword(conditionTexts, 'cancer'),
    existingConditions: conditionTexts.slice(0, 5)
  };
}

export function extractHealthInputsFromBundle(bundle: BundleLike, fallbackName: string): HealthInputs {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource).filter(Boolean) as GenericResource[];
  const patient = resources.find((resource) => isPatient(resource));
  const observations = resources.filter((resource) => isObservation(resource));

  const age = yearsOld(patient?.birthDate);
  const sex = normalizeSex(patient?.gender);
  const name = patient?.name?.[0]?.text ?? fallbackName;

  const bmi = findObsValue(observations, LOINC.bmi);
  const heightCm = 170;
  const weightKg = bmi ? Number((bmi * Math.pow(heightCm / 100, 2)).toFixed(1)) : 75;

  const smokingRaw = (findObsString(observations, LOINC.smoking) ?? 'never').toLowerCase();
  const smokingStatus: HealthInputs['smokingStatus'] = smokingRaw.includes('current')
    ? 'current'
    : smokingRaw.includes('former')
      ? 'former'
      : 'never';

  const inferred = inferConditions(bundle);

  return {
    name,
    age,
    sex,
    heightCm,
    weightKg,
    sleepHours: findObsValue(observations, LOINC.sleep) ?? 7,
    exerciseDaysPerWeek: Math.round(findObsValue(observations, LOINC.exercise) ?? 2),
    dietQuality: Math.max(1, Math.min(5, Math.round(findObsValue(observations, LOINC.diet) ?? 3))),
    stressLevel: Math.max(1, Math.min(5, Math.round(findObsValue(observations, LOINC.stress) ?? 3))),
    smokingStatus,
    alcoholDrinksPerWeek: Math.max(0, Math.round(findObsValue(observations, LOINC.alcohol) ?? 2)),
    familyHistoryHeart: inferred.familyHistoryHeart,
    familyHistoryDiabetes: inferred.familyHistoryDiabetes,
    familyHistoryCancer: inferred.familyHistoryCancer,
    existingConditions: inferred.existingConditions
  };
}

export function extractClinicalMarkersFromBundle(bundle: BundleLike) {
  const observations = (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter(isDefinedResource)
    .filter((resource) => isObservation(resource));

  return {
    totalCholesterolMgDl: findObsValue(observations, LOINC.totalCholesterol),
    hdlMgDl: findObsValue(observations, LOINC.hdl),
    systolicBloodPressureMmHg: findObsValue(observations, LOINC.systolicBp)
  };
}

export function loadSyntheaBundles(): Array<{
  syntheticId: string;
  bundle: BundleLike;
  inputs: HealthInputs;
  clinicalMarkers: ReturnType<typeof extractClinicalMarkersFromBundle>;
}> {
  return BUNDLES.map((item) => ({
    syntheticId: item.syntheticId,
    bundle: item.bundle,
    inputs: extractHealthInputsFromBundle(item.bundle, item.syntheticId),
    clinicalMarkers: extractClinicalMarkersFromBundle(item.bundle)
  }));
}
