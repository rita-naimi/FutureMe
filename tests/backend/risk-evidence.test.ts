import { describe, expect, it } from 'vitest';
import { buildRiskEvidence } from '@/lib/backend/risk-evidence';
import { HIGH_RISK_PROFILE, LOW_RISK_PROFILE } from '../fixtures/health-inputs';

describe('buildRiskEvidence', () => {
  it('returns richer indices for a high-risk profile', () => {
    const risk = buildRiskEvidence(HIGH_RISK_PROFILE, {
      totalCholesterolMgDl: 228,
      hdlMgDl: 40,
      systolicBloodPressureMmHg: 142,
      onBloodPressureTreatment: true,
      hasDiabetes: true
    });

    expect(risk.framingham10YearRiskPercent).toBeGreaterThan(10);
    expect(risk.ascvdProxy10YearRiskPercent).toBeGreaterThan(20);
    expect(risk.metabolicSyndromeProxyRiskPercent).toBeGreaterThan(30);
    expect(risk.allostaticLoadIndex).toBeGreaterThanOrEqual(5);
    expect(risk.lifeEssential8ProxyScore).toBeLessThan(70);
  });

  it('shows better profile on low-risk data', () => {
    const risk = buildRiskEvidence(LOW_RISK_PROFILE, {
      totalCholesterolMgDl: 171,
      hdlMgDl: 68,
      systolicBloodPressureMmHg: 114,
      onBloodPressureTreatment: false,
      hasDiabetes: false
    });

    expect(risk.framingham10YearRiskPercent).toBeLessThan(10);
    expect(risk.lifestyleScore).toBeGreaterThan(70);
    expect(risk.lifeEssential8ProxyScore).toBeGreaterThan(70);
  });
});
