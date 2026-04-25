'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  Moon,
  Salad,
  Sparkles,
  Target,
  Wine,
  X
} from 'lucide-react';
import type { DailyGoal } from '@/lib/store';
import { useFutureMeStore } from '@/lib/store';

type SheetMode = 'goal' | 'checkin' | null;

const GOAL_OPTIONS = [
  { habitKey: 'sleep', habit: 'Sleep 8 hours', Icon: Moon },
  { habitKey: 'exercise', habit: 'Exercise', Icon: Dumbbell },
  { habitKey: 'diet', habit: 'Eat well', Icon: Salad },
  { habitKey: 'stress', habit: 'Reduce stress', Icon: Brain },
  { habitKey: 'alcohol', habit: 'Cut back on alcohol', Icon: Wine },
  { habitKey: 'water', habit: 'Drink more water', Icon: Droplets }
] as const;

const MILESTONES = [7, 14, 30, 60, 90];
const MILESTONE_MESSAGES: Record<number, string> = {
  7: "A week. Habits start forming around here. Don't stop.",
  14: "Two weeks. This is where I gave up the first time. You didn't.",
  30: "A month. Whatever you're doing - this is becoming who you are.",
  60: 'Sixty days. This is no longer a promise. It is evidence.',
  90: 'Ninety days. Your future self is starting to look different.'
};

interface DailyGoalCardProps {
  recommendedHabitKey?: string;
}

export function DailyGoalCard({ recommendedHabitKey }: DailyGoalCardProps) {
  const dailyGoal = useFutureMeStore((state) => state.dailyGoal);
  const setDailyGoal = useFutureMeStore((state) => state.setDailyGoal);
  const logCheckIn = useFutureMeStore((state) => state.logCheckIn);
  const getCurrentStreak = useFutureMeStore((state) => state.getCurrentStreak);
  const getBestStreak = useFutureMeStore((state) => state.getBestStreak);
  const hasCheckedInToday = useFutureMeStore((state) => state.hasCheckedInToday);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [selectedHabitKey, setSelectedHabitKey] = useState(dailyGoal?.habitKey ?? recommendedHabitKey ?? 'sleep');
  const [sheetMessage, setSheetMessage] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [alreadyChecked, setAlreadyChecked] = useState(false);
  const [streakPulse, setStreakPulse] = useState(false);

  const currentStreak = getCurrentStreak();
  const bestStreak = getBestStreak();
  const checkedToday = hasCheckedInToday();
  const selectedOption = GOAL_OPTIONS.find((option) => option.habitKey === selectedHabitKey) ?? GOAL_OPTIONS[0];
  const nextMilestone = getNextMilestone(currentStreak);
  const progress = Math.min(100, Math.round((currentStreak / nextMilestone) * 100));
  const brokenStreak = Boolean(dailyGoal && currentStreak === 0 && bestStreak > 0);

  useEffect(() => {
    if (dailyGoal) setSelectedHabitKey(dailyGoal.habitKey);
    else if (recommendedHabitKey) setSelectedHabitKey(recommendedHabitKey);
  }, [dailyGoal, recommendedHabitKey]);

  useEffect(() => {
    if (!celebration) return undefined;
    const timer = window.setTimeout(() => setCelebration(null), 3000);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    if (!alreadyChecked) return undefined;
    const timer = window.setTimeout(() => setAlreadyChecked(false), 1600);
    return () => window.clearTimeout(timer);
  }, [alreadyChecked]);

  useEffect(() => {
    if (!streakPulse) return undefined;
    const timer = window.setTimeout(() => setStreakPulse(false), 1000);
    return () => window.clearTimeout(timer);
  }, [streakPulse]);

  const saveGoal = () => {
    const goal: DailyGoal = {
      habit: selectedOption.habit,
      habitKey: selectedOption.habitKey,
      startDate: todayKey(),
      checkIns: dailyGoal?.habitKey === selectedOption.habitKey ? dailyGoal.checkIns : []
    };
    setDailyGoal(goal);
    setSheetMode(null);
  };

  const openCheckIn = () => {
    if (!dailyGoal) return;
    if (checkedToday) {
      setAlreadyChecked(true);
      return;
    }
    setSheetMessage(null);
    setSheetMode('checkin');
  };

  const handleCheckIn = (completed: boolean) => {
    logCheckIn(completed);
    const nextStreak = useFutureMeStore.getState().getCurrentStreak();
    const milestoneMessage = completed ? MILESTONE_MESSAGES[nextStreak] : null;
    if (completed) setStreakPulse(true);
    setSheetMessage(completed ? `${nextStreak} days. I remember when that felt impossible.` : 'Tomorrow is still there.');

    window.setTimeout(() => {
      setSheetMode(null);
      setSheetMessage(null);
      if (milestoneMessage) setCelebration(milestoneMessage);
    }, completed ? 2000 : 1400);
  };

  if (!dailyGoal) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetMode('goal')}
          className="w-full rounded-[1.25rem] border border-dashed border-slate-300/90 bg-white/45 p-4 text-center transition hover:-translate-y-0.5 hover:border-twin-dark/45 hover:bg-white/70 dark:border-white/15 dark:bg-white/[0.035] dark:hover:border-twin/40 dark:hover:bg-white/[0.06]"
        >
          <Target className="mx-auto h-4 w-4 text-twin-dark dark:text-twin" />
          <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Set a daily goal</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Pick one habit to track every day. Your twin will follow your progress.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-twin-dark px-3 py-1.5 text-xs font-semibold text-white dark:bg-twin dark:text-navy-950">
            Set my goal
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
        <GoalSheet
          mode={sheetMode}
          setMode={setSheetMode}
          selectedHabitKey={selectedHabitKey}
          setSelectedHabitKey={setSelectedHabitKey}
          recommendedHabitKey={recommendedHabitKey}
          onSave={saveGoal}
        />
      </>
    );
  }

  return (
    <>
      <motion.article
        role="button"
        tabIndex={0}
        onClick={openCheckIn}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') openCheckIn();
        }}
        className={`relative cursor-pointer overflow-hidden rounded-[1.25rem] border p-4 shadow-[0_12px_42px_rgba(15,23,42,0.07)] outline-none transition dark:shadow-black/20 ${
          checkedToday
            ? 'border-black/10 bg-white/80 dark:border-white/10 dark:bg-navy-900/80'
            : 'border-amber-300/50 bg-amber-50/75 dark:border-amber-300/20 dark:bg-amber-300/[0.06]'
        }`}
        animate={checkedToday ? { boxShadow: '0 12px 42px rgba(15,23,42,0.07)' } : { boxShadow: ['0 0 0 rgba(245,158,11,0)', '0 0 18px rgba(245,158,11,0.18)', '0 0 0 rgba(245,158,11,0)'] }}
        transition={checkedToday ? { duration: 0.2 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <AnimatePresence>
          {celebration ? (
            <motion.div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-twin-dark px-6 text-center text-white dark:bg-twin dark:text-navy-950"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <Sparkles className="h-8 w-8" />
              <p className="mt-3 font-display text-3xl font-bold">{currentStreak} days</p>
              <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed opacity-85">&quot;{celebration}&quot;</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Your goal</p>
              <h2 className="mt-1.5 font-display text-xl font-bold text-slate-950 dark:text-white">{dailyGoal.habit}</h2>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSheetMode('goal');
              }}
              className="text-xs font-semibold text-slate-400 transition hover:text-twin-dark dark:text-slate-500 dark:hover:text-twin"
            >
              Edit goal
            </button>
          </div>

          <div className="mt-3 text-center">
            <motion.div
              className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5"
              animate={
                streakPulse
                  ? {
                      scale: [1, 1.06, 1],
                      boxShadow: ['0 0 0 0 rgba(0,163,137,0)', '0 0 0 14px rgba(0,163,137,0.14)', '0 0 0 22px rgba(0,163,137,0)']
                    }
                  : { scale: 1, boxShadow: '0 0 0 0 rgba(0,163,137,0)' }
              }
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              <Flame className="h-6 w-6 text-twin-dark dark:text-twin" />
              <AnimatedStreak value={currentStreak} />
            </motion.div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">day streak</p>
            {!checkedToday && currentStreak > 0 ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Check in for today to keep your streak
              </p>
            ) : null}
            {brokenStreak ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Best streak: {bestStreak} days - <span className="font-semibold text-twin-dark dark:text-twin">Start again today</span>
              </p>
            ) : null}
            {alreadyChecked ? (
              <p className="mt-3 text-xs font-semibold text-twin-dark dark:text-twin">Already checked in today</p>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-twin-dark dark:bg-twin"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[0.68rem] font-medium text-slate-400 dark:text-slate-500">
              <span>{currentStreak}/{nextMilestone} days</span>
              <span>
                Started {formatShortDate(dailyGoal.startDate)} - Best: {bestStreak} days
              </span>
            </div>
          </div>
        </div>
      </motion.article>

      <GoalSheet
        mode={sheetMode}
        setMode={setSheetMode}
        selectedHabitKey={selectedHabitKey}
        setSelectedHabitKey={setSelectedHabitKey}
        recommendedHabitKey={recommendedHabitKey}
        onSave={saveGoal}
      />
      <CheckInSheet
        mode={sheetMode}
        setMode={setSheetMode}
        goal={dailyGoal}
        message={sheetMessage}
        onCheckIn={handleCheckIn}
      />
    </>
  );
}

function AnimatedStreak({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, Math.round);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.7, ease: 'easeOut' });
    return controls.stop;
  }, [motionValue, value]);

  return <motion.span className="font-display text-4xl font-bold leading-none text-twin-dark dark:text-twin">{rounded}</motion.span>;
}

function GoalSheet({
  mode,
  setMode,
  selectedHabitKey,
  setSelectedHabitKey,
  recommendedHabitKey,
  onSave
}: {
  mode: SheetMode;
  setMode: (mode: SheetMode) => void;
  selectedHabitKey: string;
  setSelectedHabitKey: (habitKey: string) => void;
  recommendedHabitKey?: string;
  onSave: () => void;
}) {
  return (
    <BottomSheet open={mode === 'goal'} onClose={() => setMode(null)} label="Pick one habit">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-twin-dark dark:text-twin">Pick one habit</p>
      <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">Just this one thing - every day.</h2>
      <div className="mt-6 space-y-3">
        {GOAL_OPTIONS.map(({ habitKey, habit, Icon }) => {
          const selected = selectedHabitKey === habitKey;
          const recommended = recommendedHabitKey === habitKey;
          return (
            <button
              key={habitKey}
              type="button"
              onClick={() => setSelectedHabitKey(habitKey)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-twin-dark bg-twin-dark/10 text-slate-950 dark:border-twin dark:bg-twin/10 dark:text-white'
                  : 'border-black/10 bg-white/60 text-slate-700 hover:border-twin-dark/30 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:border-twin/35'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-twin-dark/10 text-twin-dark dark:bg-twin/10 dark:text-twin">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-semibold">{habit}</span>
              </span>
              {recommended ? (
                <span className="rounded-full bg-twin-dark/10 px-3 py-1 text-xs font-semibold text-twin-dark dark:bg-twin/10 dark:text-twin">
                  Recommended
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onSave}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-twin-dark px-5 py-3 font-semibold text-white transition hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
      >
        This is my goal
        <ArrowRight className="h-4 w-4" />
      </button>
    </BottomSheet>
  );
}

function CheckInSheet({
  mode,
  setMode,
  goal,
  message,
  onCheckIn
}: {
  mode: SheetMode;
  setMode: (mode: SheetMode) => void;
  goal: DailyGoal;
  message: string | null;
  onCheckIn: (completed: boolean) => void;
}) {
  return (
    <BottomSheet open={mode === 'checkin'} onClose={() => setMode(null)} label="Daily check-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-twin-dark/20 bg-twin-dark/10 text-twin-dark dark:border-twin/25 dark:bg-twin/10 dark:text-twin">
          ∞
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-twin-dark dark:text-twin">Daily check-in</p>
          <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">Your goal today: {goal.habit}</h2>
        </div>
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">Did you do it?</p>
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => onCheckIn(true)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-twin-dark px-5 py-4 font-semibold text-white transition hover:bg-twin-deeper dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
        >
          <Check className="h-5 w-5" />
          Yes, I did it
        </button>
        <button
          type="button"
          onClick={() => onCheckIn(false)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white/55 px-5 py-4 font-semibold text-slate-600 transition hover:border-black/20 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
          Not today
        </button>
      </div>
      <AnimatePresence>
        {message ? (
          <motion.p
            className="mt-5 rounded-2xl border border-twin-dark/15 bg-twin-dark/10 p-4 text-center text-sm italic text-slate-600 dark:border-twin/20 dark:bg-twin/10 dark:text-slate-300"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            &quot;{message}&quot;
          </motion.p>
        ) : null}
      </AnimatePresence>
    </BottomSheet>
  );
}

function BottomSheet({
  open,
  onClose,
  label,
  children
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="mx-auto w-full max-w-xl rounded-t-[2rem] border border-black/10 bg-ivory p-5 shadow-[0_-24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-navy-900 sm:rounded-[2rem] sm:p-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function getNextMilestone(streak: number) {
  return MILESTONES.find((milestone) => streak < milestone) ?? MILESTONES[MILESTONES.length - 1];
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`));
}
