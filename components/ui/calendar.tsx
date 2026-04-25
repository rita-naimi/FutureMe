'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarProps = {
  selected?: Date;
  onSelect: (date: Date) => void;
  fromDate?: Date;
  toDate?: Date;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function Calendar({ selected, onSelect, fromDate, toDate }: CalendarProps) {
  const today = startOfDay(new Date());
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(selected ?? fromDate ?? today));
  const monthStart = startOfMonth(displayMonth);
  const days = buildCalendarDays(monthStart);

  const canGoPrevious = !fromDate || new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1) >= startOfMonth(fromDate);
  const canGoNext = !toDate || new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) <= startOfMonth(toDate);

  useEffect(() => {
    if (selected) setDisplayMonth(startOfMonth(selected));
  }, [selected]);

  function moveMonth(amount: number) {
    const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + amount, 1);
    setDisplayMonth(startOfMonth(clampDate(next, fromDate, toDate)));
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          disabled={!canGoPrevious}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">
          {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          disabled={!canGoNext}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const outside = date.getMonth() !== monthStart.getMonth();
          const disabled = Boolean((fromDate && date < startOfDay(fromDate)) || (toDate && date > startOfDay(toDate)));
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => {
                setDisplayMonth(startOfMonth(date));
                onSelect(date);
              }}
              className={`flex h-9 items-center justify-center rounded-full text-sm transition ${
                isSelected
                  ? 'bg-twin-dark font-semibold text-white dark:bg-twin dark:text-navy-950'
                  : isToday
                    ? 'border border-twin-dark/30 text-twin-dark dark:border-twin/30 dark:text-twin'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
              } ${outside ? 'opacity-35' : ''} ${disabled ? 'cursor-not-allowed opacity-25 hover:bg-transparent dark:hover:bg-transparent' : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildCalendarDays(monthStart: Date) {
  const first = new Date(monthStart);
  first.setDate(1 - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clampDate(date: Date, fromDate?: Date, toDate?: Date) {
  const value = startOfDay(date);
  if (fromDate && value < startOfDay(fromDate)) return startOfDay(fromDate);
  if (toDate && value > startOfDay(toDate)) return startOfDay(toDate);
  return value;
}
