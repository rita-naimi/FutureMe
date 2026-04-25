'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LineChart, MessageCircle, SlidersHorizontal } from 'lucide-react';

const TABS = [
  { href: '/dashboard', icon: Activity, label: 'Dashboard' },
  { href: '/twin', icon: MessageCircle, label: 'Twin' },
  { href: '/simulate', icon: SlidersHorizontal, label: 'Simulate' },
  { href: '/timeline', icon: LineChart, label: 'Timeline' }
];

const HIDDEN_PATHS = new Set(['/', '/onboarding', '/login', '/awakening']);

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy-950/92 px-3 pb-3 pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs transition ${
                active
                  ? 'bg-twin text-navy-950'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
              aria-label={label}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
