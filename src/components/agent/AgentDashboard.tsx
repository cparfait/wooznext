'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';

interface AgentDashboardProps {
  session: Session;
}

export default function AgentDashboard({ session }: AgentDashboardProps) {
  const { user } = session;

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gray-400 p-4">
      {/* Header */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">{user.name}</p>
            <p className="text-xs text-gray-600">{user.serviceName}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/agent/login' })}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-300"
          >
            Deconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-sm text-gray-600">
          Il n&apos;y a pas de visiteurs qui attendent
        </p>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">
            Actuellement en service
          </h2>
          <div className="mx-auto rounded-xl bg-gray-300/50 px-12 py-6">
            <span className="text-8xl font-black tracking-wider text-gray-900">
              000
            </span>
          </div>
        </div>

        <button
          className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600"
          disabled
        >
          Suivant
        </button>
      </div>

      {/* Spacer */}
      <div />
    </main>
  );
}
