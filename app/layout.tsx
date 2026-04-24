import type { Metadata } from 'next';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'FutureMe',
  description: 'Talk to the person your habits are building.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-navy-950 text-white antialiased">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
