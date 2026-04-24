import type { HealthInputs } from './fhir';

export interface RedFlag {
  condition: (inputs: HealthInputs) => boolean;
  message: string;
  severity: 'warning' | 'critical';
}

export const RED_FLAGS: RedFlag[] = [
  {
    condition: (i) => i.sleepHours < 6 && i.stressLevel > 3 && i.exerciseDaysPerWeek < 2,
    message:
      "I need to tell you something. The combination of chronic sleep deprivation, high stress, and no physical outlet is exactly the pattern that showed up before my body forced me to stop. Change one of those three things this week.",
    severity: 'critical'
  },
  {
    condition: (i) => i.smokingStatus === 'current' && i.familyHistoryHeart,
    message:
      "With our family history and still smoking at your age, the future narrowed faster than I expected. I wish I had treated quitting as urgent, not optional.",
    severity: 'critical'
  },
  {
    condition: (i) => i.alcoholDrinksPerWeek > 14 && i.stressLevel > 3,
    message:
      "I know what you're using the alcohol for. I did the same thing. It did not reduce the stress; it postponed it and added a new problem.",
    severity: 'warning'
  },
  {
    condition: (i) => i.sleepHours < 5.5,
    message:
      "Under five and a half hours. I remember thinking I could handle it. That sleep debt quietly changed my mood, appetite, and blood pressure long before I called it a health problem.",
    severity: 'warning'
  }
];

export function getRedFlags(inputs: HealthInputs): RedFlag[] {
  return RED_FLAGS.filter((flag) => flag.condition(inputs));
}
