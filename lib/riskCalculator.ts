import type { CompletedMedicalProfile, UserInput } from '@/types/medical';

type ProfileEstimates = Partial<
  Pick<
    CompletedMedicalProfile,
    'systolicBloodPressure' | 'totalCholesterol' | 'hdlCholesterol' | 'diabetes' | 'onBloodPressureTreatment'
  >
>;

export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function buildCompletedMedicalProfile(userInput: UserInput, questionnaireEstimates?: ProfileEstimates): CompletedMedicalProfile {
  const systolicBloodPressure =
    userInput.systolicBloodPressure ?? questionnaireEstimates?.systolicBloodPressure;
  const totalCholesterol = userInput.totalCholesterol ?? questionnaireEstimates?.totalCholesterol;
  const hdlCholesterol = userInput.hdlCholesterol ?? questionnaireEstimates?.hdlCholesterol;
  const diabetes = userInput.diabetes ?? questionnaireEstimates?.diabetes;
  const onBloodPressureTreatment = questionnaireEstimates?.onBloodPressureTreatment;
  const requiredSystolicBloodPressure = requireNumber('systolicBloodPressure', systolicBloodPressure);
  const requiredTotalCholesterol = requireNumber('totalCholesterol', totalCholesterol);
  const requiredHdlCholesterol = requireNumber('hdlCholesterol', hdlCholesterol);
  const requiredDiabetes = requireBoolean('diabetes', diabetes);
  const requiredOnBloodPressureTreatment = requireBoolean('onBloodPressureTreatment', onBloodPressureTreatment);

  return {
    age: userInput.age,
    sex: userInput.sex,
    bmi: round1(calculateBmi(userInput.heightCm, userInput.weightKg)),
    smoker: userInput.smokingStatus === 'current',
    diabetes: requiredDiabetes,
    onBloodPressureTreatment: requiredOnBloodPressureTreatment,
    systolicBloodPressure: requiredSystolicBloodPressure,
    totalCholesterol: requiredTotalCholesterol,
    hdlCholesterol: requiredHdlCholesterol,
    estimatedFromQuestionnaire: {
      systolicBloodPressure: userInput.systolicBloodPressure === undefined && questionnaireEstimates?.systolicBloodPressure !== undefined,
      totalCholesterol: userInput.totalCholesterol === undefined && questionnaireEstimates?.totalCholesterol !== undefined,
      hdlCholesterol: userInput.hdlCholesterol === undefined && questionnaireEstimates?.hdlCholesterol !== undefined,
      diabetes: userInput.diabetes === undefined && questionnaireEstimates?.diabetes !== undefined,
      onBloodPressureTreatment: questionnaireEstimates?.onBloodPressureTreatment !== undefined
    }
  };
}

export function calculateCardioRisk(profile: CompletedMedicalProfile): number {
  return calculateFramingham10YearRisk(profile);
}

/**
 * Official Framingham Heart Study 2008 General Cardiovascular Disease 10-year risk equation.
 *
 * Source:
 * D'Agostino RB Sr, Vasan RS, Pencina MJ, et al.
 * "General cardiovascular risk profile for use in primary care: the Framingham Heart Study."
 * Circulation. 2008;117(6):743-753. PMID: 18212285.
 *
 * Formula inputs and app source:
 * - age: user questionnaire
 * - sex: user questionnaire
 * - systolicBloodPressure: user questionnaire or Synthea matched-cohort estimate
 * - totalCholesterol: user questionnaire or Synthea matched-cohort estimate
 * - hdlCholesterol: user questionnaire or Synthea matched-cohort estimate
 * - smoker: derived only from user questionnaire smokingStatus === "current"
 * - diabetes: user questionnaire or Synthea matched-cohort estimate
 * - onBloodPressureTreatment: user questionnaire or Synthea matched-cohort estimate
 *
 * Deliberately not used by this equation:
 * - BMI, exerciseDaysPerWeek, sleepHours, stressLevel, LDL, triglycerides, HbA1c, energyIntake.
 *
 * Remaining assumption:
 * - The published Framingham population of interest is age 30-74 and free of CVD at baseline.
 *   This module can enforce the age range, but the current app model does not include a known-CVD
 *   exclusion field. Callers must only use this result where that applicability assumption is acceptable.
 */
export function calculateFramingham10YearRisk(profile: CompletedMedicalProfile): number {
  validateFraminghamProfile(profile);

  const lnAge = toLn(profile.age);
  const lnTotalCholesterol = toLn(profile.totalCholesterol);
  const lnHdlCholesterol = toLn(profile.hdlCholesterol);
  const lnSystolicBloodPressure = toLn(profile.systolicBloodPressure);
  const smoker = profile.smoker ? 1 : 0;
  const diabetes = profile.diabetes ? 1 : 0;

  if (profile.sex === 'female') {
    const sbpCoefficient = profile.onBloodPressureTreatment ? 2.82263 : 2.76157;
    const sum =
      2.32888 * lnAge +
      1.20904 * lnTotalCholesterol -
      0.70833 * lnHdlCholesterol +
      sbpCoefficient * lnSystolicBloodPressure +
      0.52873 * smoker +
      0.69154 * diabetes;
    const risk = 1 - Math.pow(0.95012, Math.exp(sum - 26.1931));
    return round1(clamp(risk * 100, 0, 100));
  }

  const sbpCoefficient = profile.onBloodPressureTreatment ? 1.99881 : 1.93303;
  const sum =
    3.06117 * lnAge +
    1.1237 * lnTotalCholesterol -
    0.93263 * lnHdlCholesterol +
    sbpCoefficient * lnSystolicBloodPressure +
    0.65451 * smoker +
    0.57367 * diabetes;
  const risk = 1 - Math.pow(0.88936, Math.exp(sum - 23.9802));
  return round1(clamp(risk * 100, 0, 100));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function requireNumber(field: string, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`Cannot build Framingham profile: missing ${field}. Provide it from the questionnaire or derived estimate.`);
  }

  return value;
}

function requireBoolean(field: string, value: boolean | undefined): boolean {
  if (value === undefined) {
    throw new Error(`Cannot build Framingham profile: missing ${field}. Provide it from the questionnaire or derived estimate.`);
  }

  return value;
}

function validateFraminghamProfile(profile: CompletedMedicalProfile): void {
  if (profile.age < 30 || profile.age > 74) {
    throw new Error('Framingham 2008 General CVD risk is intended for ages 30-74.');
  }

  requireNumber('systolicBloodPressure', profile.systolicBloodPressure);
  requireNumber('totalCholesterol', profile.totalCholesterol);
  requireNumber('hdlCholesterol', profile.hdlCholesterol);
  requireBoolean('diabetes', profile.diabetes);
  requireBoolean('onBloodPressureTreatment', profile.onBloodPressureTreatment);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toLn(value: number): number {
  return Math.log(Math.max(value, 1));
}
