import { describe, expect, it } from 'vitest';
import {
  buildBiomarkerInterventionTrajectories,
  buildCategoricalTransitions,
  generateRiskProjection
} from '@/lib/riskProjection';
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

describe('risk projection', () => {
  it('changes age and recalculates baseline Framingham risk while biomarkers stay constant', () => {
    const projection = generateRiskProjection(profile);

    expect(projection.baseline.map((point) => point.label)).toEqual(['Today', '3 months', '1 year', '5 years', '10 years']);
    expect(projection.baseline[0].age).toBe(52);
    expect(projection.baseline[4].age).toBe(62);
    expect(projection.baseline[4].profile.systolicBloodPressure).toBe(145);
    expect(projection.baseline[4].profile.totalCholesterol).toBe(220);
    expect(projection.baseline[4].profile.hdlCholesterol).toBe(42);
    expect(projection.baseline[4].risk).toBeGreaterThan(projection.baseline[0].risk);
  });

  it('uses scenarioResult.simulatedProfile for intervention projection after the current point', () => {
    const scenario = generateScenarioResult(profile, userInput, 'structured_exercise');
    const projection = generateRiskProjection(profile, scenario);

    expect(projection.intervention).toHaveLength(5);
    expect(projection.intervention?.[0].profile).toEqual(scenario.currentProfile);
    expect(projection.intervention?.[1].profile.systolicBloodPressure).toBe(scenario.simulatedProfile.systolicBloodPressure);
    expect(projection.intervention?.[1].profile.totalCholesterol).toBe(scenario.simulatedProfile.totalCholesterol);
    expect(projection.intervention?.[1].profile.hdlCholesterol).toBe(scenario.simulatedProfile.hdlCholesterol);
    expect(projection.intervention?.[4].risk).toBeLessThan(projection.baseline[4].risk);
  });

  it('builds biomarker trajectories only from numeric appliedEffects and lands on the simulated value', () => {
    const scenario = generateScenarioResult(profile, userInput, 'structured_exercise');
    const trajectories = buildBiomarkerInterventionTrajectories(scenario);
    const appliedBiomarkers = scenario.appliedEffects.map((effect) => effect.biomarker);

    expect(trajectories.length).toBeGreaterThan(0);
    trajectories.forEach((trajectory) => {
      expect(appliedBiomarkers).toContain(trajectory.biomarker);
      expect(trajectory.points[0]).toEqual({ week: 0, value: trajectory.before });
      expect(trajectory.points[trajectory.points.length - 1]).toEqual({
        week: trajectory.totalWeeks,
        value: trajectory.after
      });
    });
  });

  it('projects stop smoking as a categorical transition and Framingham risk path', () => {
    const scenario = generateScenarioResult(profile, userInput, 'stop_smoking');
    const projection = generateRiskProjection(profile, scenario);
    const transitions = buildCategoricalTransitions(scenario);

    expect(transitions).toEqual([
      expect.objectContaining({
        biomarker: 'smoker',
        before: true,
        after: false
      })
    ]);
    expect(buildBiomarkerInterventionTrajectories(scenario)).toHaveLength(0);
    expect(projection.intervention?.[4].risk).toBeLessThan(projection.baseline[4].risk);
  });

  it('does not generate unsupported glucose trajectories', () => {
    const scenario = generateScenarioResult(profile, userInput, 'structured_exercise');
    const trajectories = buildBiomarkerInterventionTrajectories(scenario);

    expect(trajectories.some((trajectory) => trajectory.biomarker === 'hba1c')).toBe(false);
    expect(trajectories.map((trajectory) => String(trajectory.biomarker))).not.toContain('glucose');
  });
});
