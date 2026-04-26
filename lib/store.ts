'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HealthInputs, TwinProfile } from './fhir';
import type { PipelineResponse } from './backend/types';

type ChatMessage = { role: 'user' | 'assistant'; content: string; inputMode?: 'text' | 'voice' };
type AccountResult = { ok: true } | { ok: false; error: string };

export interface CheckIn {
  date: string;
  completed: boolean;
}

export interface DailyGoal {
  habit: string;
  habitKey: string;
  startDate: string;
  checkIns: CheckIn[];
}

export interface MerorAccount {
  email: string;
  password: string;
  name: string;
  profile: TwinProfile;
  profilePhotoDataUrl: string | null;
  pipelineAnalysis: PipelineResponse | null;
  dailyGoal?: DailyGoal | null;
  updatedAt: string;
}

interface MerorStore {
  profile: TwinProfile | null;
  simulatedInputs: HealthInputs | null;
  chatHistory: ChatMessage[];
  pipelineAnalysis: PipelineResponse | null;
  currentUserEmail: string | null;
  profilePhotoDataUrl: string | null;
  dailyGoal: DailyGoal | null;
  accounts: Record<string, MerorAccount>;
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
  setDailyGoal: (goal: DailyGoal) => void;
  logCheckIn: (completed: boolean) => void;
  getCurrentStreak: () => number;
  getBestStreak: () => number;
  hasCheckedInToday: () => boolean;
  addMessage: (message: ChatMessage) => void;
  replaceLastAssistantMessage: (content: string) => void;
  extractHabitChange: (message: string) => void;
  reset: () => void;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getCheckInMap(goal: DailyGoal | null) {
  return new Map((goal?.checkIns ?? []).map((checkIn) => [checkIn.date, checkIn.completed]));
}

function computeCurrentStreak(goal: DailyGoal | null) {
  const checkIns = getCheckInMap(goal);
  const today = new Date();
  const todayKey = toDateKey(today);
  const todayCompleted = checkIns.get(todayKey);

  if (todayCompleted === false) return 0;

  let cursor = todayCompleted === true ? today : addDays(today, -1);
  let streak = 0;

  while (checkIns.get(toDateKey(cursor)) === true) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function computeBestStreak(goal: DailyGoal | null) {
  const sorted = Array.from(getCheckInMap(goal).entries()).sort(([a], [b]) => a.localeCompare(b));
  let best = 0;
  let current = 0;
  let previousDate: Date | null = null;

  for (const [date, completed] of sorted) {
    const currentDate = new Date(`${date}T00:00:00`);
    const isConsecutive = previousDate ? toDateKey(addDays(previousDate, 1)) === date : false;

    if (completed) {
      current = isConsecutive ? current + 1 : 1;
      best = Math.max(best, current);
      previousDate = currentDate;
    } else {
      current = 0;
      previousDate = currentDate;
    }
  }

  return best;
}

export const useMerorStore = create<MerorStore>()(
  persist(
    (set, get) => ({
      profile: null,
      simulatedInputs: null,
      chatHistory: [],
      pipelineAnalysis: null,
      currentUserEmail: null,
      profilePhotoDataUrl: null,
      dailyGoal: null,
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
                dailyGoal: state.dailyGoal,
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

        const account: MerorAccount = {
          email: normalizedEmail,
          password,
          name: profile.inputs.name,
          profile,
          profilePhotoDataUrl,
          pipelineAnalysis: analysis,
          dailyGoal: null,
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
          pipelineAnalysis: analysis,
          dailyGoal: null
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
          pipelineAnalysis: account.pipelineAnalysis,
          dailyGoal: account.dailyGoal ?? null
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
          pipelineAnalysis: null,
          dailyGoal: null
        }),

      setDailyGoal: (goal) =>
        set((state) => {
          const dailyGoal = {
            ...goal,
            checkIns: goal.checkIns ?? []
          };

          if (!state.currentUserEmail) return { dailyGoal };
          const account = state.accounts[state.currentUserEmail];
          if (!account) return { dailyGoal };

          return {
            dailyGoal,
            accounts: {
              ...state.accounts,
              [state.currentUserEmail]: {
                ...account,
                dailyGoal,
                updatedAt: new Date().toISOString()
              }
            }
          };
        }),

      logCheckIn: (completed) =>
        set((state) => {
          if (!state.dailyGoal) return {};

          const today = toDateKey(new Date());
          const nextGoal = {
            ...state.dailyGoal,
            checkIns: [
              ...state.dailyGoal.checkIns.filter((checkIn) => checkIn.date !== today),
              { date: today, completed }
            ].sort((a, b) => a.date.localeCompare(b.date))
          };

          if (!state.currentUserEmail) return { dailyGoal: nextGoal };
          const account = state.accounts[state.currentUserEmail];
          if (!account) return { dailyGoal: nextGoal };

          return {
            dailyGoal: nextGoal,
            accounts: {
              ...state.accounts,
              [state.currentUserEmail]: {
                ...account,
                dailyGoal: nextGoal,
                updatedAt: new Date().toISOString()
              }
            }
          };
        }),

      getCurrentStreak: () => computeCurrentStreak(get().dailyGoal),

      getBestStreak: () => computeBestStreak(get().dailyGoal),

      hasCheckedInToday: () => {
        const goal = get().dailyGoal;
        if (!goal) return false;
        const today = toDateKey(new Date());
        return goal.checkIns.some((checkIn) => checkIn.date === today);
      },

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
          profilePhotoDataUrl: null,
          dailyGoal: null
        })
    }),
    {
      name: 'meror-store',
      partialize: (state) => ({
        profile: state.profile,
        simulatedInputs: state.simulatedInputs,
        chatHistory: state.chatHistory,
        pipelineAnalysis: state.pipelineAnalysis,
        currentUserEmail: state.currentUserEmail,
        profilePhotoDataUrl: state.profilePhotoDataUrl,
        dailyGoal: state.dailyGoal,
        accounts: state.accounts
      })
    }
  )
);
