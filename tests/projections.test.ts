import { describe, expect, it } from 'vitest';
import { generateFutureProjection } from '@/lib/projections';
import { generateScenarioResult } from '@/lib/scenarios';
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
  hdlCholesterol: 42
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

describe('future projection helper', () => {
  it('always returns a baseline Framingham risk path', () => {
    const projection = generateFutureProjection(profile);

    expect(projection.baselineRisk.map((point) => point.label)).toEqual(['Today', '3 months', '1 year', '5 years', '10 years']);
    expect(projection.baselineRisk[4].risk).toBeGreaterThan(projection.baselineRisk[0].risk);
    expect(projection.interventionRisk).toBeUndefined();
    expect(projection.biomarkerTrajectories).toHaveLength(0);
  });

  it('selecting structured exercise updates SBP, total cholesterol, HDL, and secondary BMI trajectories', () => {
    const scenario = generateScenarioResult(profile, userInput, 'structured_exercise');
    const projection = generateFutureProjection(profile, scenario);
    const biomarkers = projection.biomarkerTrajectories.map((trajectory) => trajectory.biomarker);

    expect(biomarkers).toEqual(['systolicBloodPressure', 'totalCholesterol', 'hdlCholesterol', 'bmi']);
    expect(projection.biomarkerTrajectories.find((trajectory) => trajectory.biomarker === 'systolicBloodPressure')?.delta).toBe(-4.15);
    expect(projection.biomarkerTrajectories.find((trajectory) => trajectory.biomarker === 'totalCholesterol')?.delta).toBe(-5.9);
    expect(projection.biomarkerTrajectories.find((trajectory) => trajectory.biomarker === 'hdlCholesterol')?.delta).toBe(2.11);
    expect(projection.interventionRisk?.[4].risk).toBeLessThan(projection.baselineRisk[4].risk);
  });

  it('selecting sleep extension updates only the SBP biomarker trajectory', () => {
    const scenario = generateScenarioResult(profile, userInput, 'sleep_improvement');
    const projection = generateFutureProjection(profile, scenario);

    expect(projection.biomarkerTrajectories.map((trajectory) => trajectory.biomarker)).toEqual(['systolicBloodPressure']);
    expect(projection.biomarkerTrajectories[0].delta).toBe(-5);
    expect(projection.biomarkerTrajectories[0].displayHorizon).toBe('3-16 weeks in evidence');
    expect(projection.interventionRisk?.[4].risk).toBeLessThan(projection.baselineRisk[4].risk);
  });

  it('selecting MBSR updates only the SBP biomarker trajectory over 8 weeks', () => {
    const scenario = generateScenarioResult(profile, userInput, 'stress_reduction');
    const projection = generateFutureProjection(profile, scenario);

    expect(projection.biomarkerTrajectories.map((trajectory) => trajectory.biomarker)).toEqual(['systolicBloodPressure']);
    expect(projection.biomarkerTrajectories[0].delta).toBe(-6.64);
    expect(projection.biomarkerTrajectories[0].totalWeeks).toBe(8);
    expect(projection.biomarkerTrajectories[0].xAxisTicks).toEqual([0, 2, 4, 8]);
  });

  it('selecting stop smoking updates risk projection without creating a fake numeric biomarker curve', () => {
    const scenario = generateScenarioResult(profile, userInput, 'stop_smoking');
    const projection = generateFutureProjection(profile, scenario);

    expect(projection.interventionRisk?.[4].risk).toBeLessThan(projection.baselineRisk[4].risk);
    expect(projection.biomarkerTrajectories).toHaveLength(0);
    expect(projection.categoricalTransitions).toEqual([
      expect.objectContaining({ biomarker: 'smoker', before: true, after: false })
    ]);
  });

  it('changing clinical inputs recomputes the Framingham projection', () => {
    const lowerSbpProfile = {
      ...profile,
      systolicBloodPressure: 125
    };

    expect(generateFutureProjection(lowerSbpProfile).baselineRisk[0].risk).toBeLessThan(
      generateFutureProjection(profile).baselineRisk[0].risk
    );
  });

  it('does not generate unsupported glucose or arbitrary health-score predictions', () => {
    const scenario = generateScenarioResult(profile, userInput, 'structured_exercise');
    const projection = generateFutureProjection(profile, scenario);
    const serialized = JSON.stringify(projection);

    expect(projection.biomarkerTrajectories.map((trajectory) => trajectory.biomarker)).not.toContain('hba1c');
    expect(serialized).not.toContain('glucose');
    expect(serialized).not.toContain('healthScore');
    expect(serialized).not.toContain('overall');
  });
});

