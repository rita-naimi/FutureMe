import type { FieldPath } from 'react-hook-form';
import type { OnboardingValues } from '@/app/onboarding/page';

export interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  fields: FieldPath<OnboardingValues>[];
  insight?: string;
  optional?: boolean;
}

export const STEPS: OnboardingStep[] = [
  {
    id: 'name',
    title: 'What should we call you?',
    subtitle: 'Start with the name your future self will use.',
    fields: ['name']
  },
  {
    id: 'age',
    title: 'How old are you?',
    subtitle: 'Age anchors the baseline for every projection.',
    fields: ['age']
  },
  {
    id: 'sex',
    title: 'What sex should we use for risk calculations?',
    subtitle: 'Some clinical formulas use sex-specific coefficients.',
    fields: ['sex']
  },
  {
    id: 'body',
    title: 'What are your height and weight?',
    subtitle: 'Your body right now sets the metabolic baseline.',
    fields: ['heightCm', 'weightKg']
  },
  {
    id: 'sleep',
    title: 'How many hours do you actually sleep each night?',
    subtitle: 'Sleep is where aging happens.',
    fields: ['sleepHours'],
    insight: 'Each hour under 7 pushes the simulation toward faster biological aging.'
  },
  {
    id: 'movement',
    title: 'How much do you move?',
    subtitle: 'Intentional exercise changes the long-term trajectory.',
    fields: ['exerciseDaysPerWeek'],
    insight: 'Five or more movement days can subtract years from the projected biological age.'
  },
  {
    id: 'diet',
    title: 'How balanced is your average plate?',
    subtitle: 'Food quality shapes metabolic load over time.',
    fields: ['dietQuality']
  },
  {
    id: 'stress',
    title: 'How stressed have you felt lately?',
    subtitle: 'Stress ages you from the inside.',
    fields: ['stressLevel']
  },
  {
    id: 'smoking',
    title: 'What is your smoking status?',
    subtitle: 'This honest answer changes the projection quickly.',
    fields: ['smokingStatus']
  },
  {
    id: 'alcohol',
    title: 'How many drinks do you have in a normal week?',
    subtitle: 'Alcohol patterns affect sleep, recovery, and cardiometabolic risk.',
    fields: ['alcoholDrinksPerWeek']
  },
  {
    id: 'history',
    title: 'What runs in your family?',
    subtitle: 'Family medical history shapes your risk profile.',
    fields: ['familyHistoryHeart', 'familyHistoryDiabetes', 'familyHistoryCancer']
  },
  {
    id: 'auth',
    title: 'Create your account to save your twin.',
    subtitle: 'Your answers are ready. Save them so you can return to your profile.',
    fields: []
  }
];
