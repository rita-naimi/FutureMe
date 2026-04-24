import type { HealthInputs } from '@/lib/fhir';
import type { ClinicalMarkers, RiskEvidence } from './types';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function toLn(value: number) {
  return Math.log(Math.max(value, 1));
}

function deriveMarkers(inputs: HealthInputs, markers?: ClinicalMarkers) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);

  const derivedTotalCholesterol = Math.round(170 + Math.max(0, bmi - 22) * 3 + (5 - inputs.dietQuality) * 6);
  const derivedHdl = Math.round(62 - Math.max(0, bmi - 23) * 1.1 - (inputs.smokingStatus === 'current' ? 6 : 0));
  const derivedSystolic = Math.round(112 + Math.max(0, bmi - 24) * 1.4 + inputs.stressLevel * 2.2);

  return {
    totalCholesterolMgDl: markers?.totalCholesterolMgDl ?? derivedTotalCholesterol,
    hdlMgDl: markers?.hdlMgDl ?? clamp(derivedHdl, 30, 90),
    systolicBloodPressureMmHg: markers?.systolicBloodPressureMmHg ?? derivedSystolic,
    onBloodPressureTreatment: markers?.onBloodPressureTreatment ?? inputs.existingConditions.includes('hypertension'),
    hasDiabetes: markers?.hasDiabetes ?? inputs.familyHistoryDiabetes
  };
}

function framingham10YearRisk(inputs: HealthInputs, markers: ReturnType<typeof deriveMarkers>) {
  const lnAge = toLn(inputs.age);
  const lnTc = toLn(markers.totalCholesterolMgDl);
  const lnHdl = toLn(markers.hdlMgDl);
  const lnSbp = toLn(markers.systolicBloodPressureMmHg);
  const smoker = inputs.smokingStatus === 'current' ? 1 : 0;
  const diabetes = markers.hasDiabetes ? 1 : 0;

  if (inputs.sex === 'female') {
    const sbpCoeff = markers.onBloodPressureTreatment ? 2.82263 : 2.76157;
    const sum =
      2.32888 * lnAge +
      1.20904 * lnTc +
      -0.70833 * lnHdl +
      sbpCoeff * lnSbp +
      0.52873 * smoker +
      0.69154 * diabetes;
    const risk = 1 - Math.pow(0.95012, Math.exp(sum - 26.1931));
    return clamp(risk * 100);
  }

  const sbpCoeff = markers.onBloodPressureTreatment ? 1.99881 : 1.93303;
  const sum =
    3.06117 * lnAge +
    1.1237 * lnTc +
    -0.93263 * lnHdl +
    sbpCoeff * lnSbp +
    0.65451 * smoker +
    0.57367 * diabetes;
  const risk = 1 - Math.pow(0.88936, Math.exp(sum - 23.9802));
  return clamp(risk * 100);
}

function ascvdProxyRisk(inputs: HealthInputs, markers: ReturnType<typeof deriveMarkers>) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const score =
    inputs.age * 0.35 +
    (markers.systolicBloodPressureMmHg - 110) * 0.25 +
    (markers.totalCholesterolMgDl - 170) * 0.08 +
    (50 - markers.hdlMgDl) * 0.25 +
    (inputs.smokingStatus === 'current' ? 14 : inputs.smokingStatus === 'former' ? 6 : 0) +
    (markers.hasDiabetes ? 10 : 0) +
    Math.max(0, bmi - 25) * 0.8;

  return clamp(score, 0, 80);
}

function metabolicSyndromeProxy(inputs: HealthInputs, markers: ReturnType<typeof deriveMarkers>) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const score =
    Math.max(0, bmi - 25) * 3.2 +
    Math.max(0, markers.systolicBloodPressureMmHg - 130) * 0.6 +
    (inputs.exerciseDaysPerWeek < 2 ? 12 : 0) +
    (inputs.dietQuality < 3 ? 14 : 0) +
    (markers.hasDiabetes ? 15 : 0);

  return clamp(score);
}

function allostaticLoadIndex(inputs: HealthInputs, markers: ReturnType<typeof deriveMarkers>) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const points =
    (inputs.sleepHours < 6 ? 2 : 0) +
    (inputs.stressLevel >= 4 ? 2 : 0) +
    (markers.systolicBloodPressureMmHg >= 130 ? 2 : 0) +
    (inputs.smokingStatus === 'current' ? 2 : 0) +
    (bmi >= 30 ? 2 : bmi >= 25 ? 1 : 0);

  return Math.max(0, Math.min(10, points));
}

function lifeEssential8ProxyScore(inputs: HealthInputs, markers: ReturnType<typeof deriveMarkers>) {
  const bmi = inputs.weightKg / Math.pow(inputs.heightCm / 100, 2);
  const sleep = clamp((inputs.sleepHours / 9) * 100);
  const diet = clamp((inputs.dietQuality / 5) * 100);
  const activity = clamp((inputs.exerciseDaysPerWeek / 7) * 100);
  const nicotine = inputs.smokingStatus === 'never' ? 100 : inputs.smokingStatus === 'former' ? 70 : 20;
  const bp = clamp(100 - Math.max(0, markers.systolicBloodPressureMmHg - 110) * 1.5);
  const lipids = clamp(100 - Math.max(0, markers.totalCholesterolMgDl - 170) * 0.7 + Math.max(0, markers.hdlMgDl - 50) * 0.5);
  const weight = clamp(100 - Math.max(0, bmi - 22) * 6);
  const glucose = markers.hasDiabetes ? 35 : 85;

  const avg = (sleep + diet + activity + nicotine + bp + lipids + weight + glucose) / 8;
  return clamp(avg);
}

function lifestyleScore(inputs: HealthInputs) {
  const score =
    100 -
    (inputs.smokingStatus === 'current' ? 25 : inputs.smokingStatus === 'former' ? 10 : 0) -
    Math.max(0, 7 - inputs.sleepHours) * 6 -
    Math.max(0, 3 - inputs.exerciseDaysPerWeek) * 7 -
    Math.max(0, 3 - inputs.dietQuality) * 8 -
    Math.max(0, inputs.stressLevel - 2) * 6 -
    Math.max(0, inputs.alcoholDrinksPerWeek - 7) * 1.2;

  return clamp(score);
}

export function buildRiskEvidence(inputs: HealthInputs, markers?: ClinicalMarkers): RiskEvidence {
  const resolved = deriveMarkers(inputs, markers);
  const framingham = framingham10YearRisk(inputs, resolved);
  const ascvdProxy = ascvdProxyRisk(inputs, resolved);
  const metabolicProxy = metabolicSyndromeProxy(inputs, resolved);
  const allostatic = allostaticLoadIndex(inputs, resolved);
  const life8 = lifeEssential8ProxyScore(inputs, resolved);
  const lifestyle = lifestyleScore(inputs);

  const assumptions: string[] = [];
  if (!markers?.totalCholesterolMgDl) assumptions.push('Total cholesterol estimated from anthropometrics and lifestyle proxy variables.');
  if (!markers?.hdlMgDl) assumptions.push('HDL estimated with BMI and smoking status proxy.');
  if (!markers?.systolicBloodPressureMmHg) assumptions.push('Systolic blood pressure estimated from BMI and stress proxy.');
  if (markers?.hasDiabetes === undefined) assumptions.push('Diabetes status inferred from family history in this MVP.');

  return {
    framingham10YearRiskPercent: round1(framingham),
    ascvdProxy10YearRiskPercent: round1(ascvdProxy),
    metabolicSyndromeProxyRiskPercent: round1(metabolicProxy),
    allostaticLoadIndex: allostatic,
    lifeEssential8ProxyScore: round1(life8),
    lifestyleScore: round1(lifestyle),
    evidence: [
      `Age ${inputs.age}, sex ${inputs.sex}`,
      `Total cholesterol ${resolved.totalCholesterolMgDl} mg/dL`,
      `HDL ${resolved.hdlMgDl} mg/dL`,
      `Systolic BP ${resolved.systolicBloodPressureMmHg} mmHg`,
      `Smoking status ${inputs.smokingStatus}`,
      `On BP treatment ${resolved.onBloodPressureTreatment ? 'yes' : 'no'}`,
      `Diabetes ${resolved.hasDiabetes ? 'yes' : 'no'}`,
      `ASCVD proxy 10y ${round1(ascvdProxy)}%`,
      `Metabolic syndrome proxy ${round1(metabolicProxy)}%`,
      `AHA Life Essential 8 proxy ${round1(life8)}/100`,
      `Allostatic load index ${allostatic}/10`,
      `Lifestyle score ${round1(lifestyle)}/100`
    ],
    assumptions
  };
}
