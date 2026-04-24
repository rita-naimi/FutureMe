import type { HealthInputs } from './fhir';
import { createTwinProfile } from './profile';
import { ALEX_PERSONA } from '@/data/synthea/alex';
import { JAMES_PERSONA } from '@/data/synthea/james';
import { MAYA_PERSONA } from '@/data/synthea/maya';

export type DemoPersonaId = 'alex' | 'maya' | 'james';

export const DEMO_PERSONAS: Record<
  DemoPersonaId,
  { label: string; description: string; color: string; inputs: HealthInputs }
> = {
  alex: {
    label: 'Alex, 34',
    description: 'High risk: sleeps 5h, smokes, sedentary',
    color: '#EF4444',
    inputs: ALEX_PERSONA
  },
  maya: {
    label: 'Maya, 28',
    description: 'Low risk: active, strong recovery baseline',
    color: '#22C55E',
    inputs: MAYA_PERSONA
  },
  james: {
    label: 'James, 52',
    description: 'Critical: smoker, family history, poor sleep',
    color: '#F59E0B',
    inputs: JAMES_PERSONA
  }
};

export function createDemoProfile(id: DemoPersonaId) {
  return createTwinProfile(DEMO_PERSONAS[id].inputs, 'synthea-generated');
}
