import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Script from 'next/script';
import SessionProvider from '@/components/SessionProvider';
import { getNonce } from '@/lib/nonce';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = await getNonce();

  return (
    <html lang="fr" className={montserrat.variable} nonce={nonce}>
      <body className="min-h-screen bg-gray-50 font-sans" suppressHydrationWarning>
        <Script id="csp-nonce" nonce={nonce} strategy="beforeInteractive" />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
