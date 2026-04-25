'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { TwinAvatar } from '@/components/twin/TwinAvatar';

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-navy-950 px-5">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-8"
        >
          <TwinAvatar size="lg" active />
        </motion.div>

        <motion.section
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <p className="mb-4 font-mono text-sm text-twin/70">Returning user</p>
          <h1 className="text-balance text-4xl font-bold leading-tight text-white">Log in to your account.</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Restore the health profile saved on this device.
          </p>
          <div className="mt-8">
            <AuthPanel mode="login" onSuccess={() => router.push('/dashboard')} />
          </div>
        </motion.section>
      </div>
    </main>
  );
}
