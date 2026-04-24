import { describe, expect, it } from 'vitest';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { findNearestSyntheticPatients } from '@/lib/backend/matching';

describe('findNearestSyntheticPatients', () => {
  it('returns nearest matches from FHIR cohort', () => {
    const matches = findNearestSyntheticPatients(JAMES_PERSONA, 5, 2);

    expect(matches).toHaveLength(2);
    expect(matches[0].distance).toBeLessThanOrEqual(matches[1].distance);
    expect(['synthea-fhir', 'synthea-seed']).toContain(matches[0].source);
  });
});
