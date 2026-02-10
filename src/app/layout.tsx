import type { Metadata } from 'next';
import { Inter, PT_Sans } from 'next/font/google';
import { Sidebar } from '@/components/layout/sidebar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const ptSans = PT_Sans({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'AsymAudit - Marketing Audit Dashboard',
  description: 'Comprehensive automated marketing audit engine for WordPress, Google Analytics, and SEO tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${ptSans.variable} font-sans`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
