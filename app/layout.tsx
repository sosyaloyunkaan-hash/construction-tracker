import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/ThemeContext';

export const metadata: Metadata = {
  title: 'Site Progress Tracker',
  description: 'Construction site progress tracking system',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-900 transition-colors">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
