'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import StatsPanel from './StatsPanel';
import ServicesPanel from './ServicesPanel';
import AgentsPanel from './AgentsPanel';
import SettingsPanel from './SettingsPanel';

type Tab = 'stats' | 'services' | 'agents' | 'settings';

interface AdminDashboardProps {
  userId: string;
  userRole: string;
  userServiceId: string | null;
}

export default function AdminDashboard({ userId, userRole, userServiceId }: AdminDashboardProps) {
  const router = useRouter();
  const isFullAdmin = userRole === 'ADMIN';

  const tabs: { key: Tab; label: string }[] = isFullAdmin
    ? [
        { key: 'stats', label: 'Statistiques' },
        { key: 'services', label: 'Services' },
        { key: 'agents', label: 'Agents' },
        { key: 'settings', label: 'Parametres' },
      ]
    : [
        { key: 'stats', label: 'Statistiques' },
        { key: 'services', label: 'Mon service' },
      ];

  const [tab, setTab] = useState<Tab>('stats');

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Administration</h1>
          <div className="flex items-center gap-2">
            {!isFullAdmin && (
              <button
                onClick={() => router.push('/agent')}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Retour agent
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/agent/login' })}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl p-4">
        {tab === 'stats' && <StatsPanel serviceScope={isFullAdmin ? null : userServiceId} />}
        {tab === 'services' && <ServicesPanel serviceScope={isFullAdmin ? null : userServiceId} />}
        {isFullAdmin && tab === 'agents' && <AgentsPanel currentUserId={userId} />}
        {isFullAdmin && tab === 'settings' && <SettingsPanel />}
      </div>
    </main>
  );
}
