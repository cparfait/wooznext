import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import SessionProvider from '@/components/SessionProvider';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'File d\'attente - Mairie',
  description: 'Système de gestion de file d\'attente pour collectivités',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body className="min-h-screen bg-gray-50 font-sans" suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
