'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageCircle, Sliders, User } from 'lucide-react';

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/twin', icon: MessageCircle, label: 'Twin' },
  { href: '/simulate', icon: Sliders, label: 'Simulate' },
  { href: '/profile', icon: User, label: 'Profile' }
];

const HIDDEN_PATHS = new Set(['/', '/onboarding', '/login', '/awakening']);

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-ivory/88 px-3 pb-3 pt-2 backdrop-blur-2xl dark:border-white/10 dark:bg-navy-950/92">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 rounded-full border border-black/10 bg-white/75 p-1 shadow-[0_18px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/20">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition sm:flex-row sm:gap-2 sm:px-3 sm:text-xs ${
                active
                  ? 'bg-twin-dark text-white shadow-[0_10px_28px_rgba(0,163,137,0.26)] dark:bg-twin dark:text-navy-950'
                  : 'text-slate-500 hover:bg-black/[0.04] hover:text-slate-800 dark:text-slate-500 dark:hover:bg-white/[0.04] dark:hover:text-slate-200'
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
