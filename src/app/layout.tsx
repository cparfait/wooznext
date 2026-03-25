import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="fr">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
