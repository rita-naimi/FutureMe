'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HealthInputs, TwinProfile } from './fhir';
import type { PipelineResponse } from './backend/types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AccountResult = { ok: true } | { ok: false; error: string };

export interface FutureMeAccount {
  email: string;
  password: string;
  name: string;
  profile: TwinProfile;
  profilePhotoDataUrl: string | null;
  pipelineAnalysis: PipelineResponse | null;
  updatedAt: string;
}

interface FutureMeStore {
  profile: TwinProfile | null;
  simulatedInputs: HealthInputs | null;
  chatHistory: ChatMessage[];
  pipelineAnalysis: PipelineResponse | null;
  currentUserEmail: string | null;
  profilePhotoDataUrl: string | null;
  accounts: Record<string, FutureMeAccount>;
  setProfile: (profile: TwinProfile) => void;
  setSimulatedInputs: (inputs: HealthInputs) => void;
  setPipelineAnalysis: (analysis: PipelineResponse | null) => void;
  registerAccount: (
    email: string,
    password: string,
    profile: TwinProfile,
    analysis?: PipelineResponse | null,
    profilePhotoDataUrl?: string | null
  ) => AccountResult;
  loginAccount: (email: string, password: string) => AccountResult;
  setProfilePhoto: (profilePhotoDataUrl: string | null) => void;
  logout: () => void;
  addMessage: (message: ChatMessage) => void;
  replaceLastAssistantMessage: (content: string) => void;
  extractHabitChange: (message: string) => void;
  reset: () => void;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const useFutureMeStore = create<FutureMeStore>()(
  persist(
    (set, get) => ({
      profile: null,
      simulatedInputs: null,
      chatHistory: [],
      pipelineAnalysis: null,
      currentUserEmail: null,
      profilePhotoDataUrl: null,
      accounts: {},

      setProfile: (profile) =>
        set((state) => {
          const base = {
            profile,
            simulatedInputs: profile.inputs,
            chatHistory: [],
            pipelineAnalysis: null
          };
          if (!state.currentUserEmail) return base;

          const account = state.accounts[state.currentUserEmail];
          if (!account) return base;

          return {
            ...base,
            accounts: {
              ...state.accounts,
              [state.currentUserEmail]: {
                ...account,
                name: profile.inputs.name,
                profile,
                profilePhotoDataUrl: state.profilePhotoDataUrl,
                pipelineAnalysis: null,
                updatedAt: new Date().toISOString()
              }
            }
          };
        }),

      setSimulatedInputs: (inputs) => set({ simulatedInputs: inputs }),

      setPipelineAnalysis: (analysis) =>
        set((state) => {
          if (!state.currentUserEmail) return { pipelineAnalysis: analysis };
          const account = state.accounts[state.currentUserEmail];
          if (!account) return { pipelineAnalysis: analysis };

          return {
            pipelineAnalysis: analysis,
            accounts: {
              ...state.accounts,
              [state.currentUserEmail]: {
                ...account,
                pipelineAnalysis: analysis,
                updatedAt: new Date().toISOString()
              }
            }
          };
        }),

      registerAccount: (email, password, profile, analysis = null, profilePhotoDataUrl = null) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !normalizedEmail.includes('@')) {
          return { ok: false, error: 'Enter a valid email address.' };
        }
        if (password.length < 8) {
          return { ok: false, error: 'Use at least 8 characters for your password.' };
        }
        if (get().accounts[normalizedEmail]) {
          return { ok: false, error: 'An account already exists for this email.' };
        }

        const account: FutureMeAccount = {
          email: normalizedEmail,
          password,
          name: profile.inputs.name,
          profile,
          profilePhotoDataUrl,
          pipelineAnalysis: analysis,
          updatedAt: new Date().toISOString()
        };

        set((state) => ({
          currentUserEmail: normalizedEmail,
          accounts: {
            ...state.accounts,
            [normalizedEmail]: account
          },
          profile,
          profilePhotoDataUrl,
          simulatedInputs: profile.inputs,
          chatHistory: [],
          pipelineAnalysis: analysis
        }));

        return { ok: true };
      },

      loginAccount: (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        const account = get().accounts[normalizedEmail];
        if (!account || account.password !== password) {
          return { ok: false, error: 'Email or password is incorrect.' };
        }

        set({
          currentUserEmail: normalizedEmail,
          profile: account.profile,
          profilePhotoDataUrl: account.profilePhotoDataUrl,
          simulatedInputs: account.profile.inputs,
          chatHistory: [],
          pipelineAnalysis: account.pipelineAnalysis
        });

        return { ok: true };
      },

      setProfilePhoto: (profilePhotoDataUrl) =>
        set((state) => {
          if (!state.currentUserEmail) return { profilePhotoDataUrl };
          const account = state.accounts[state.currentUserEmail];
          if (!account) return { profilePhotoDataUrl };

          return {
            profilePhotoDataUrl,
            accounts: {
              ...state.accounts,
              [state.currentUserEmail]: {
                ...account,
                profilePhotoDataUrl,
                updatedAt: new Date().toISOString()
              }
            }
          };
        }),

      logout: () =>
        set({
          currentUserEmail: null,
          profile: null,
          profilePhotoDataUrl: null,
          simulatedInputs: null,
          chatHistory: [],
          pipelineAnalysis: null
        }),

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

      reset: () =>
        set({
          profile: null,
          simulatedInputs: null,
          chatHistory: [],
          pipelineAnalysis: null,
          currentUserEmail: null,
          profilePhotoDataUrl: null
        })
    }),
    {
      name: 'futureme-store',
      partialize: (state) => ({
        profile: state.profile,
        simulatedInputs: state.simulatedInputs,
        chatHistory: state.chatHistory,
        pipelineAnalysis: state.pipelineAnalysis,
        currentUserEmail: state.currentUserEmail,
        profilePhotoDataUrl: state.profilePhotoDataUrl,
        accounts: state.accounts
      })
    }
  )
);
