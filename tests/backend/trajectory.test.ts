import { describe, expect, it } from 'vitest';
import { normalizeHealthState, toSyntheaModelState } from '@/lib/backend/normalized-state';
import { buildTrajectoryOutput } from '@/lib/backend/trajectory';
import { HIGH_RISK_PROFILE } from '../fixtures/health-inputs';

describe('Synthea-compatible trajectory pipeline', () => {
  it('keeps only Synthea/FHIR model fields for Apple Health trajectory input', () => {
    const normalized = normalizeHealthState(
      HIGH_RISK_PROFILE,
      {
        systolicBloodPressureMmHg: 145,
        diastolicBloodPressureMmHg: 88,
        totalCholesterolMgDl: 220,
        hdlMgDl: 42,
        glucoseMgDl: 99,
        hasDiabetes: false,
        hasHypertension: true
      },
      { source: 'apple_healthkit', date: '2026-01-01T00:00:00.000Z' }
    );

    const modelState = toSyntheaModelState(normalized);

    expect(modelState).toEqual({
      age: HIGH_RISK_PROFILE.age,
      sex: HIGH_RISK_PROFILE.sex,
      SBP: 145,
      DBP: 88,
      BMI: expect.any(Number),
      total_chol: 220,
      HDL: 42,
      glucose: 99,
      smoker: true,
      diabetes: false,
      hypertension: true
    });
    expect('sleepHours' in modelState).toBe(false);
  });

  it('generates baseline and intervention curves without direct risk edits', async () => {
    const markers = {
      systolicBloodPressureMmHg: 145,
      diastolicBloodPressureMmHg: 88,
      totalCholesterolMgDl: 220,
      hdlMgDl: 42,
      glucoseMgDl: 99,
      hasDiabetes: false,
      hasHypertension: true,
      onBloodPressureTreatment: true
    };
    const normalized = normalizeHealthState(HIGH_RISK_PROFILE, markers, {
      source: 'manual',
      date: '2026-01-01T00:00:00.000Z'
    });

    const output = await buildTrajectoryOutput(normalized, HIGH_RISK_PROFILE, markers, { startYear: 2026, endYear: 2028 });
    const exercise = output.interventions.find((intervention) => intervention.scenarioId === 'structured_exercise');

    expect(output.baseline.map((point) => point.year)).toEqual([2026, 2027, 2028]);
    expect(exercise).toBeDefined();
    expect(exercise?.curve[1].biomarkers.systolicBloodPressure).toBeLessThan(output.baseline[1].biomarkers.systolicBloodPressure);
    expect(exercise?.curve[1].biomarkers.totalCholesterol).toBeLessThan(output.baseline[1].biomarkers.totalCholesterol);
    expect(exercise?.curve[1].biomarkers.hdlCholesterol).toBeGreaterThan(output.baseline[1].biomarkers.hdlCholesterol);
    expect(exercise?.curve[1].cardiovascularRiskPercent).toBe(
      exercise?.curve[1].riskEvidence.framingham10YearRiskPercent
    );
  });
});
