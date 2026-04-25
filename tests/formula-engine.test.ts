import { describe, expect, it } from 'vitest';
import { applyEvidenceEffects, clamp } from '@/lib/applyEvidenceEffects';
import { buildCompletedMedicalProfile, calculateBmi, calculateCardioRisk, calculateFramingham10YearRisk } from '@/lib/riskCalculator';
import { generateScenarioResult } from '@/lib/scenarios';
import { evidenceEffects } from '@/lib/evidenceEffects';
import type { CompletedMedicalProfile, UserInput } from '@/types/medical';

const profile: CompletedMedicalProfile = {
  age: 52,
  sex: 'male',
  bmi: 28,
  smoker: true,
  diabetes: false,
  onBloodPressureTreatment: false,
  systolicBloodPressure: 145,
  totalCholesterol: 220,
  hdlCholesterol: 42,
  ldlCholesterol: 130,
  energyIntake: 2400
};

const userInput: UserInput = {
  age: 52,
  sex: 'male',
  heightCm: 178,
  weightKg: 88.7,
  smokingStatus: 'current',
  exerciseDaysPerWeek: 1,
  sleepHours: 5.8,
  stressLevel: 4,
  systolicBloodPressure: 145,
  totalCholesterol: 220,
  hdlCholesterol: 42,
  diabetes: false
};

describe('formula engine', () => {
  it('calculates BMI from height and weight', () => {
    expect(calculateBmi(180, 81)).toBe(25);
  });

  it('applies structured exercise biomarker changes exactly', () => {
    const result = applyEvidenceEffects(profile, userInput, ['structured_exercise']);

    expect(result.simulatedProfile.systolicBloodPressure).toBe(140.85);
    expect(result.simulatedProfile.totalCholesterol).toBe(214.1);
    expect(result.simulatedProfile.hdlCholesterol).toBe(44.11);
    expect(result.simulatedProfile.bmi).toBe(27.32);
  });

  it('keeps exercise BMI as a secondary metric outside the cardiovascular risk formula', () => {
    const baselineRisk = calculateCardioRisk(profile);
    const bmiOnlyProfile = { ...profile, bmi: 18 };

    expect(calculateCardioRisk(bmiOnlyProfile)).toBe(baselineRisk);
  });

  it('uses the Framingham 10-year risk implementation for cardiovascular risk', () => {
    expect(calculateCardioRisk(profile)).toBe(calculateFramingham10YearRisk(profile));
  });

  it('does not require optional unavailable biomarkers outside the Framingham input set', () => {
    const minimalProfile: CompletedMedicalProfile = {
      age: 52,
      sex: 'male',
      bmi: 28,
      smoker: true,
      diabetes: false,
      onBloodPressureTreatment: false,
      systolicBloodPressure: 145,
      totalCholesterol: 220,
      hdlCholesterol: 42
    };

    expect(calculateCardioRisk(minimalProfile)).toBeGreaterThan(0);
  });

  it('requires questionnaire or Synthea sources for all Framingham inputs instead of inventing defaults', () => {
    expect(() =>
      buildCompletedMedicalProfile({
        age: 52,
        sex: 'male',
        heightCm: 178,
        weightKg: 88.7,
        smokingStatus: 'current',
        exerciseDaysPerWeek: 1,
        sleepHours: 5.8,
        stressLevel: 4
      })
    ).toThrow('missing systolicBloodPressure');

    const completed = buildCompletedMedicalProfile(
      {
        age: 52,
        sex: 'male',
        heightCm: 178,
        weightKg: 88.7,
        smokingStatus: 'current',
        exerciseDaysPerWeek: 1,
        sleepHours: 5.8,
        stressLevel: 4
      },
      {
        systolicBloodPressure: 145,
        totalCholesterol: 220,
        hdlCholesterol: 42,
        diabetes: false,
        onBloodPressureTreatment: false
      }
    );

    expect(completed.estimatedFromSynthea).toEqual({
      systolicBloodPressure: true,
      totalCholesterol: true,
      hdlCholesterol: true,
      diabetes: true,
      onBloodPressureTreatment: true
    });
  });

  it('applies sleep SBP only for short sleepers and does not change lipids', () => {
    const result = applyEvidenceEffects(profile, userInput, ['sleep_improvement']);

    expect(result.simulatedProfile.systolicBloodPressure).toBe(140);
    expect(result.simulatedProfile.totalCholesterol).toBe(profile.totalCholesterol);
    expect(result.simulatedProfile.hdlCholesterol).toBe(profile.hdlCholesterol);
    expect(result.simulatedProfile.ldlCholesterol).toBe(profile.ldlCholesterol);
    expect(result.simulatedProfile.energyIntake).toBe(2130);
  });

  it('skips sleep effects when the user is not a short sleeper', () => {
    const result = applyEvidenceEffects(profile, { ...userInput, sleepHours: 7.5 }, ['sleep_improvement']);

    expect(result.simulatedProfile.systolicBloodPressure).toBe(profile.systolicBloodPressure);
    expect(result.warnings).toContain('Sleep SBP effect skipped because user is not a short sleeper.');
  });

  it('applies MBSR as an SBP-only change', () => {
    const result = applyEvidenceEffects(profile, userInput, ['stress_reduction']);

    expect(result.simulatedProfile.systolicBloodPressure).toBe(138.36);
    expect(result.simulatedProfile.totalCholesterol).toBe(profile.totalCholesterol);
    expect(result.simulatedProfile.hdlCholesterol).toBe(profile.hdlCholesterol);
    expect(result.simulatedProfile.bmi).toBe(profile.bmi);
  });

  it('sets smoker to false for stop smoking and warns if already non-smoker', () => {
    const smokerResult = applyEvidenceEffects(profile, userInput, ['stop_smoking']);
    expect(smokerResult.simulatedProfile.smoker).toBe(false);

    const nonSmokerResult = applyEvidenceEffects({ ...profile, smoker: false }, { ...userInput, smokingStatus: 'never' }, ['stop_smoking']);
    expect(nonSmokerResult.simulatedProfile.smoker).toBe(false);
    expect(nonSmokerResult.warnings).toContain('Already non-smoker.');
  });

  it('changes smoking risk only by changing the smoker formula input', () => {
    const result = generateScenarioResult(profile, userInput, 'stop_smoking');
    const expectedFutureRisk = calculateCardioRisk({ ...profile, smoker: false });

    expect(result.appliedEffects).toHaveLength(1);
    expect(result.appliedEffects[0].biomarker).toBe('smoker');
    expect(result.simulatedProfile).toEqual({ ...profile, smoker: false });
    expect(result.futureRisk).toBe(expectedFutureRisk);
    expect(result.absoluteRiskReduction).toBeCloseTo(result.currentRisk - expectedFutureRisk, 1);
  });

  it('recalculates risk after biomarker updates without direct risk edits', () => {
    const result = generateScenarioResult(profile, userInput, 'structured_exercise');
    const recomputedFutureRisk = calculateCardioRisk(result.simulatedProfile);

    expect(result.futureRisk).toBe(recomputedFutureRisk);
    expect(result.absoluteRiskReduction).toBeCloseTo(result.currentRisk - result.futureRisk, 1);
    expect(result.futureRisk).toBeLessThan(result.currentRisk);
  });

  it('clamps biomarker values after applying effects', () => {
    expect(clamp(80, 90, 220)).toBe(90);

    const result = applyEvidenceEffects(
      {
        ...profile,
        systolicBloodPressure: 92,
        totalCholesterol: 101,
        hdlCholesterol: 119,
        bmi: 16.2
      },
      userInput,
      ['structured_exercise']
    );

    expect(result.simulatedProfile.systolicBloodPressure).toBe(90);
    expect(result.simulatedProfile.totalCholesterol).toBe(100);
    expect(result.simulatedProfile.hdlCholesterol).toBe(120);
    expect(result.simulatedProfile.bmi).toBe(16);
  });

  it('conservatively aggregates same-biomarker effects in combined mode', () => {
    const result = applyEvidenceEffects(profile, userInput, ['structured_exercise', 'sleep_improvement', 'stress_reduction'], {
      mode: 'combined'
    });

    expect(result.simulatedProfile.systolicBloodPressure).toBe(134.82);
    expect(result.warnings).toContain(
      'Combined same-biomarker effects were conservatively aggregated to avoid double-counting. This is a modeling assumption, not a validated clinical formula.'
    );
  });

  it('does not include low-confidence effects', () => {
    expect(evidenceEffects.some((effect) => effect.confidence === 'low')).toBe(false);
  });
});
