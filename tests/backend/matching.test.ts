import { describe, expect, it } from 'vitest';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { findRuleBasedSyntheticPatients } from '@/lib/backend/matching';

describe('findRuleBasedSyntheticPatients', () => {
  it('returns matches selected by explicit interpretable filters', () => {
    const result = findRuleBasedSyntheticPatients(JAMES_PERSONA, 5, {
      userDiabetes: true
    });
    const matches = result.selected;

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(30);
    expect(matches.every((match) => match.inputs.sex === JAMES_PERSONA.sex)).toBe(true);
    expect(matches[0]).not.toHaveProperty('distance');
    expect(matches[0]).not.toHaveProperty('similarity');
    expect(['synthea-fhir', 'synthea-seed']).toContain(matches[0].source);
  });
});
