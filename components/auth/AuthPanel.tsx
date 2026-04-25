'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Lock, LogIn, Mail } from 'lucide-react';
import type { PipelineResponse } from '@/lib/backend/types';
import type { TwinProfile } from '@/lib/fhir';
import { useFutureMeStore } from '@/lib/store';

interface Props {
  mode: 'create' | 'login';
  profile?: TwinProfile;
  pipelineAnalysis?: PipelineResponse | null;
  onSuccess: () => void;
}

export function AuthPanel({ mode, profile, pipelineAnalysis = null, onSuccess }: Props) {
  const registerAccount = useFutureMeStore((state) => state.registerAccount);
  const loginAccount = useFutureMeStore((state) => state.loginAccount);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isCreate = mode === 'create';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const result = isCreate
      ? profile
        ? registerAccount(email, password, profile, pipelineAnalysis)
        : { ok: false as const, error: 'Complete the questionnaire before creating an account.' }
      : loginAccount(email, password);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <label className="block">
        <span className="text-sm text-slate-400">Email</span>
        <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition focus-within:border-twin/50">
          <Mail className="h-4 w-4 text-slate-500" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-700"
            placeholder="you@example.com"
            required
          />
        </span>
      </label>

      <label className="block">
        <span className="text-sm text-slate-400">Password</span>
        <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition focus-within:border-twin/50">
          <Lock className="h-4 w-4 text-slate-500" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isCreate ? 'new-password' : 'current-password'}
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-700"
            placeholder={isCreate ? 'At least 8 characters' : 'Your password'}
            required
          />
        </span>
      </label>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-twin px-6 py-3 text-sm font-semibold text-navy-950 transition hover:bg-twin-dark"
      >
        {isCreate ? 'Create account and continue' : 'Log in'}
        <LogIn className="h-4 w-4" />
      </button>

      <p className="text-center text-sm text-slate-500">
        {isCreate ? (
          <>
            Already registered?{' '}
            <Link href="/login" className="font-medium text-twin transition hover:text-twin-dark">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/onboarding" className="font-medium text-twin transition hover:text-twin-dark">
              Start onboarding
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
