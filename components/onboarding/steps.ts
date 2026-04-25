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
    id: 'basics',
    title: "First, let's meet you.",
    subtitle: 'The basics your twin needs to know.',
    fields: ['name', 'age', 'sex']
  },
  {
    id: 'body',
    title: 'Your body right now.',
    subtitle: 'Height and weight set your metabolic baseline.',
    fields: ['heightCm', 'weightKg']
  },
  {
    id: 'sleep',
    title: 'Sleep is where aging happens.',
    subtitle: 'How many hours do you actually sleep each night?',
    fields: ['sleepHours'],
    insight: 'Each hour under 7 pushes the simulation toward faster biological aging.'
  },
  {
    id: 'movement',
    title: 'How much do you move?',
    subtitle: 'Days per week you do intentional exercise.',
    fields: ['exerciseDaysPerWeek'],
    insight: 'Five or more movement days can subtract years from the projected biological age.'
  },
  {
    id: 'diet',
    title: 'What does your plate look like?',
    subtitle: 'Rate your average diet quality.',
    fields: ['dietQuality']
  },
  {
    id: 'stress',
    title: 'Stress ages you from the inside.',
    subtitle: 'Your average stress level over the past three months.',
    fields: ['stressLevel']
  },
  {
    id: 'smoking',
    title: 'The honest question.',
    subtitle: 'Smoking status changes the projection quickly.',
    fields: ['smokingStatus']
  },
  {
    id: 'alcohol',
    title: 'Drinks per week.',
    subtitle: 'Average alcoholic drinks in a normal week.',
    fields: ['alcoholDrinksPerWeek']
  },
  {
    id: 'history',
    title: 'What runs in your family?',
    subtitle: 'Family medical history shapes your risk profile.',
    fields: ['familyHistoryHeart', 'familyHistoryDiabetes', 'familyHistoryCancer']
  },
  {
    id: 'wearable',
    title: 'Enrich your health profile',
    subtitle: 'Use wearable data for lifestyle signals, or Synthea matching to estimate missing clinical biomarkers.',
    fields: ['wearableImport'],
    optional: true
  }
];
