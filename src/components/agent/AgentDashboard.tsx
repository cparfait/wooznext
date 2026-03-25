'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useServiceSocket } from '@/hooks/useSocket';
import BottomSheet from './BottomSheet';
import ConfirmModal from './ConfirmModal';
import AddTicketModal from './AddTicketModal';

interface Ticket {
  id: string;
  displayCode: string;
  status: string;
  visitor: { phone: string };
  createdAt: string;
}

interface QueueStats {
  waitingCount: number;
  currentTicket: Ticket | null;
  waitingTickets: Ticket[];
  nextTicket: Ticket | null;
}

interface AgentDashboardProps {
  session: Session;
}

export default function AgentDashboard({ session }: AgentDashboardProps) {
  const { user } = session;
  const [stats, setStats] = useState<QueueStats>({
    waitingCount: 0,
    currentTicket: null,
    waitingTickets: [],
    nextTicket: null,
  });
  const [loading, setLoading] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [returnTicket, setReturnTicket] = useState<Ticket | null>(null);
  const [showAddTicket, setShowAddTicket] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/queue');
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch {
      // Silent fail
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  // Real-time updates
  useServiceSocket(user.serviceId, useCallback(() => {
    refreshQueue();
  }, [refreshQueue]));

  // Call next visitor
  async function handleNext() {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/next', { method: 'POST' });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  // Call a specific visitor
  async function handleCallById(ticketId: string) {
    setLoading(true);
    setShowBottomSheet(false);
    try {
      const res = await fetch(`/api/agent/call/${ticketId}`, { method: 'POST' });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  // Complete current ticket
  async function handleComplete() {
    if (!stats.currentTicket) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agent/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: stats.currentTicket.id }),
      });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  // Return ticket to queue
  async function handleReturn() {
    if (!returnTicket) return;
    setLoading(true);
    setReturnTicket(null);
    try {
      const res = await fetch(`/api/agent/return/${returnTicket.id}`, { method: 'POST' });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  // No-show
  async function handleNoShow() {
    if (!stats.currentTicket) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agent/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: stats.currentTicket.id }),
      });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  const currentCode = stats.currentTicket?.displayCode ?? '---';

  return (
    <main className="flex min-h-screen flex-col bg-gray-400">
      {/* Header */}
      <div className="p-4">
        <div className="mx-auto flex max-w-md items-center justify-between">
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
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Waiting count banner */}
          <p className="text-sm text-gray-600">
            {stats.waitingCount === 0
              ? 'Il n\'y a pas de visiteurs qui attendent'
              : `Il y a ${stats.waitingCount} visiteur${stats.waitingCount > 1 ? 's' : ''} qui attend${stats.waitingCount > 1 ? 'ent' : ''}`}
          </p>

          {/* Current serving */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">
              Actuellement en service
            </h2>
            <div className="mx-auto rounded-xl bg-gray-300/50 px-12 py-6">
              <span className="text-8xl font-black tracking-wider text-gray-900">
                {currentCode}
              </span>
            </div>
          </div>

          {/* Actions when serving someone */}
          {stats.currentTicket && (
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-green-600 disabled:opacity-50"
              >
                Termine
              </button>
              <button
                onClick={() => setReturnTicket(stats.currentTicket)}
                disabled={loading}
                className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                Retour file
              </button>
              <button
                onClick={handleNoShow}
                disabled={loading}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                Absent
              </button>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNext}
            disabled={loading || stats.waitingCount === 0}
            className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? 'Chargement...' : 'Suivant'}
          </button>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowBottomSheet(true)}
              disabled={stats.waitingCount === 0}
              className="flex-1 rounded-xl border border-gray-300 bg-white/50 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-white/80 disabled:opacity-50"
            >
              Appeler par numero
            </button>
            <button
              onClick={() => setShowAddTicket(true)}
              className="flex-1 rounded-xl border border-gray-300 bg-white/50 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-white/80"
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet for selecting a visitor */}
      <BottomSheet
        visible={showBottomSheet}
        tickets={stats.waitingTickets}
        onCall={handleCallById}
        onClose={() => setShowBottomSheet(false)}
      />

      {/* Confirmation modal for return to queue */}
      <ConfirmModal
        visible={!!returnTicket}
        title="Retour a la file"
        message={`Le visiteur avec le numero ${returnTicket?.displayCode ?? ''} sera renvoye a la file d'attente.`}
        confirmLabel="Oui"
        cancelLabel="Annuler"
        onConfirm={handleReturn}
        onCancel={() => setReturnTicket(null)}
      />

      {/* Add ticket modal */}
      <AddTicketModal
        visible={showAddTicket}
        serviceId={user.serviceId}
        onClose={() => setShowAddTicket(false)}
        onCreated={refreshQueue}
      />
    </main>
  );
}
