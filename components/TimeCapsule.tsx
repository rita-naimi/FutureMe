'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, Clock, Send, X } from 'lucide-react';

interface TimeCapsuleProps {
  healthScore: number;
  biologicalAge: number;
  realAge: number;
  name: string;
  userEmail?: string;
  onClose?: () => void;
}

export default function TimeCapsule({
  healthScore,
  biologicalAge,
  realAge,
  name,
  userEmail = '',
  onClose
}: TimeCapsuleProps) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [sendMode, setSendMode] = useState<'now' | 'months' | 'date'>('now');
  const [months, setMonths] = useState(6);
  const [customDate, setCustomDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  function getSendDate(): Date {
    if (sendMode === 'now') return new Date();
    if (sendMode === 'months') {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      return d;
    }
    return new Date(customDate);
  }

  function formatSendDate(): string {
    if (sendMode === 'now') return 'today';
    const d = getSendDate();
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatDelayLabel() {
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
    const years = months / 12;
    if (Number.isInteger(years)) return `${years} ${years === 1 ? 'year' : 'years'}`;
    return `${months} months`;
  }

  async function handleSend() {
    if (!message.trim() || !email.trim()) return;
    if (sendMode === 'date' && !customDate) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/time-capsule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          message: message.trim(),
          deliverNow: sendMode === 'now',
          sendAt: sendMode === 'now' ? undefined : getSendDate().toISOString(),
          healthSnapshot: {
            healthScore,
            biologicalAge,
            realAge,
            name,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[1.5rem] border border-black/10 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/80"
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close future message dialog"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-twin-dark/10 dark:bg-twin/10">
            <CheckCircle className="h-8 w-8 text-twin-dark dark:text-twin" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">Message sealed ✦</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Your past self will reach {email} {sendMode === 'now' ? 'now' : 'on'}
            </p>
            {sendMode === 'now' ? null : <p className="mt-1 font-semibold text-twin-dark dark:text-twin">{formatSendDate()}</p>}
          </div>
          <button
            onClick={() => { setStatus('idle'); setMessage(''); }}
            className="mt-2 text-sm text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-200"
          >
            Send another
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-black/10 bg-white/95 p-5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/95 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-twin-dark/20 bg-twin-dark/10 dark:border-twin/20 dark:bg-twin/10">
          <Clock className="h-5 w-5 text-twin-dark dark:text-twin" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Send a message to your future self</h2>
          <p className="text-xs text-slate-500 dark:text-slate-500">Your health snapshot today will be included</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close future message dialog"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Your message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Dear ${name || 'future me'},\n\nI am writing this on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}...`}
            rows={5}
            className="w-full resize-none rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-twin-dark/30 focus:ring-1 focus:ring-twin-dark/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-600 dark:focus:border-twin/30 dark:focus:ring-twin/20"
          />
          <p className="mt-1 text-right text-xs text-slate-400">{message.length} characters</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Deliver to
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-twin-dark/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            When to deliver
          </label>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSendMode('now')}
              className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                sendMode === 'now'
                  ? 'border-twin-dark bg-twin-dark text-white dark:border-twin dark:bg-twin dark:text-navy-950'
                  : 'border-black/10 text-slate-500 hover:border-twin-dark/30 dark:border-white/10 dark:text-slate-500'
              }`}
            >
              <Send className="h-3 w-3" />
              Now
            </button>
            <button
              type="button"
              onClick={() => setSendMode('months')}
              className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                sendMode === 'months'
                  ? 'border-twin-dark bg-twin-dark text-white dark:border-twin dark:bg-twin dark:text-navy-950'
                  : 'border-black/10 text-slate-500 hover:border-twin-dark/30 dark:border-white/10 dark:text-slate-500'
              }`}
            >
              <Clock className="h-3 w-3" />
              In X months
            </button>
            <button
              type="button"
              onClick={() => setSendMode('date')}
              className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                sendMode === 'date'
                  ? 'border-twin-dark bg-twin-dark text-white dark:border-twin dark:bg-twin dark:text-navy-950'
                  : 'border-black/10 text-slate-500 hover:border-twin-dark/30 dark:border-white/10 dark:text-slate-500'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Specific date
            </button>
          </div>

          <AnimatePresence mode="wait">
            {sendMode === 'now' ? (
              <motion.p
                key="now"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-twin-dark/15 bg-twin-dark/5 px-4 py-3 text-xs font-medium text-slate-500 dark:border-twin/20 dark:bg-twin/10 dark:text-slate-300"
              >
                Sends immediately so you can verify the email flow today.
              </motion.p>
            ) : sendMode === 'months' ? (
              <motion.div key="months" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={120}
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    className="lab-slider flex-1"
                    style={{ ['--slider-fill' as string]: `${((months - 1) / 119) * 100}%` }}
                  />
                  <span className="w-20 text-right font-semibold text-twin-dark dark:text-twin">
                    {formatDelayLabel()}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Arrives on {formatSendDate()}
                </p>
              </motion.div>
            ) : (
              <motion.div key="date" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input
                  type="date"
                  min={minDateStr}
                  max={maxDateStr}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-2xl border border-black/8 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/[0.02]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Included snapshot</p>
          <div className="flex gap-4">
            <div>
              <p className="font-display text-2xl font-bold text-twin-dark dark:text-twin">{healthScore}</p>
              <p className="text-xs text-slate-500">Health score</p>
            </div>
            <div className="w-px bg-black/10 dark:bg-white/10" />
            <div>
              <p className="font-display text-2xl font-bold text-slate-950 dark:text-white">{biologicalAge}</p>
              <p className="text-xs text-slate-500">Biological age</p>
            </div>
            <div className="w-px bg-black/10 dark:bg-white/10" />
            <div>
              <p className="font-display text-2xl font-bold text-slate-950 dark:text-white">{realAge}</p>
              <p className="text-xs text-slate-500">Real age</p>
            </div>
          </div>
        </div>

        {status === 'error' && (
          <p className="rounded-xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {errorMsg || 'Something went wrong. Try again.'}
          </p>
        )}

        <button
          onClick={handleSend}
          disabled={!message.trim() || !email.trim() || status === 'sending' || (sendMode === 'date' && !customDate)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-twin-dark py-3 font-semibold text-white transition hover:bg-twin-deeper disabled:opacity-40 dark:bg-twin dark:text-navy-950 dark:hover:bg-twin-dark"
        >
          {status === 'sending' ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Sealing your message...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {sendMode === 'now' ? 'Send now' : `Send to ${sendMode === 'months' ? `${months}m` : 'future'} me`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
