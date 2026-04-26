import type { Metadata } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Meror',
  description: 'Talk to the person your habits are building.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
  (function() {
    const theme = localStorage.getItem('meror-theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  })();
`
          }}
        />
      </head>
      <body className="min-h-screen bg-ivory text-slate-900 antialiased dark:bg-navy-950 dark:text-white">
        <ThemeToggle />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
