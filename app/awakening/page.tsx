'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { TwinAvatar } from '@/components/twin/TwinAvatar';
import { useFutureMeStore } from '@/lib/store';

export default function AwakeningPage() {
  const router = useRouter();
  const profile = useFutureMeStore((state) => state.profile);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.push(profile ? '/dashboard' : '/onboarding');
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [profile, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }}>
        <TwinAvatar size="lg" active />
      </motion.div>
      <motion.div
        className="mt-12 flex items-center gap-2 text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <ScanLine className="h-5 w-5 text-twin" />
        Scanning FHIR health profile
      </motion.div>
      <motion.p
        className="mt-5 text-xl text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.1 }}
      >
        Building your ten-year digital twin
      </motion.p>
      <motion.p
        className="mt-5 text-2xl font-semibold text-twin"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.7 }}
      >
        Your future self is ready.
      </motion.p>
    </main>
  );
}
