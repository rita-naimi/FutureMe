'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HealthInputs, TwinProfile } from './fhir';
import type { PipelineResponse } from './backend/types';
import type { DemoPersonaId } from './demo-personas';
import { createDemoProfile } from './demo-personas';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface FutureMeStore {
  profile: TwinProfile | null;
  simulatedInputs: HealthInputs | null;
  chatHistory: ChatMessage[];
  demoPersona: DemoPersonaId | null;
  pipelineAnalysis: PipelineResponse | null;
  setProfile: (profile: TwinProfile) => void;
  setSimulatedInputs: (inputs: HealthInputs) => void;
  setPipelineAnalysis: (analysis: PipelineResponse | null) => void;
  addMessage: (message: ChatMessage) => void;
  replaceLastAssistantMessage: (content: string) => void;
  extractHabitChange: (message: string) => void;
  loadDemoPersona: (persona: DemoPersonaId) => void;
  reset: () => void;
}

export const useFutureMeStore = create<FutureMeStore>()(
  persist(
    (set, get) => ({
      profile: null,
      simulatedInputs: null,
      chatHistory: [],
      demoPersona: null,
      pipelineAnalysis: null,

      setProfile: (profile) =>
        set({
          profile,
          simulatedInputs: profile.inputs,
          chatHistory: [],
          demoPersona: null,
          pipelineAnalysis: null
        }),

      setSimulatedInputs: (inputs) => set({ simulatedInputs: inputs }),

      setPipelineAnalysis: (analysis) => set({ pipelineAnalysis: analysis }),

      addMessage: (message) => set((state) => ({ chatHistory: [...state.chatHistory, message] })),

      replaceLastAssistantMessage: (content) =>
        set((state) => {
          const messages = [...state.chatHistory];
          for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'assistant') {
              messages[i] = { role: 'assistant', content };
              break;
            }
          }
          return { chatHistory: messages };
        }),

      extractHabitChange: (message) => {
        const current = get().simulatedInputs;
        if (!current) return;
        const updated = { ...current };
        let changed = false;

        if (/sleep.*(8|eight|nine|9)|bed.*earlier/i.test(message)) {
          updated.sleepHours = Math.max(updated.sleepHours, 8);
          changed = true;
        }
        if (/quit.*smok|stop.*smok|no more cigarettes|former smoker/i.test(message)) {
          updated.smokingStatus = 'former';
          changed = true;
        }
        if (/exercis.*(every day|daily|5|five|four|4)|gym.*(4|four|5|five)/i.test(message)) {
          updated.exerciseDaysPerWeek = Math.max(updated.exerciseDaysPerWeek, 5);
          changed = true;
        }
        if (/cut.*alcohol|stop.*drink|less alcohol|no alcohol/i.test(message)) {
          updated.alcoholDrinksPerWeek = Math.min(updated.alcoholDrinksPerWeek, 2);
          changed = true;
        }
        if (/eat.*better|mediterranean|whole food|less processed/i.test(message)) {
          updated.dietQuality = Math.max(updated.dietQuality, 4);
          changed = true;
        }

        if (changed) set({ simulatedInputs: updated });
      },

      loadDemoPersona: (persona) => {
        const profile = createDemoProfile(persona);
        set({
          profile,
          simulatedInputs: profile.inputs,
          chatHistory: [],
          demoPersona: persona,
          pipelineAnalysis: null
        });
      },

      reset: () =>
        set({
          profile: null,
          simulatedInputs: null,
          chatHistory: [],
          demoPersona: null,
          pipelineAnalysis: null
        })
    }),
    {
      name: 'futureme-store',
      partialize: (state) => ({
        profile: state.profile,
        simulatedInputs: state.simulatedInputs,
        chatHistory: state.chatHistory,
        demoPersona: state.demoPersona,
        pipelineAnalysis: state.pipelineAnalysis
      })
    }
  )
);
