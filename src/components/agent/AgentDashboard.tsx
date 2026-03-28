'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useServiceSocket, onForceDisconnect } from '@/hooks/useSocket';
import BottomSheet from './BottomSheet';
import ConfirmModal from './ConfirmModal';
import AddTicketModal from './AddTicketModal';
import PasswordChangeModal from './PasswordChangeModal';

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
  counterLabel: string | null;
}

interface AgentDashboardProps {
  session: Session;
}

export default function AgentDashboard({ session }: AgentDashboardProps) {
  const { user } = session;
  const router = useRouter();
  const [stats, setStats] = useState<QueueStats>({
    waitingCount: 0,
    currentTicket: null,
    waitingTickets: [],
    nextTicket: null,
    counterLabel: null,
  });
  const [loading, setLoading] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [returnTicket, setReturnTicket] = useState<Ticket | null>(null);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCounterSelect, setShowCounterSelect] = useState(false);
  const [availableCounters, setAvailableCounters] = useState<{ id: string; label: string; agentId: string | null }[]>([]);
  const [selectingCounter, setSelectingCounter] = useState<string | null>(null);

  async function handleCloseCounter() {
    try {
      await fetch('/api/agent/counter', { method: 'DELETE' });
      signOut({ callbackUrl: '/agent/login' });
    } catch {
      // Silent fail
    }
  }

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

  // Initial load + check counter assignment
  useEffect(() => {
    async function init() {
      await refreshQueue();
      // Check if agent has a counter; if not, load available counters
      const qRes = await fetch('/api/agent/queue');
      if (qRes.ok) {
        const data = await qRes.json();
        if (!data.counterLabel) {
          const cRes = await fetch('/api/agent/counters');
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.counters && cData.counters.length > 0) {
              setAvailableCounters(cData.counters);
              setShowCounterSelect(true);
            }
          }
        }
      }
    }
    init();
  }, [refreshQueue]);

  // Force disconnect handler (admin released counter)
  useEffect(() => {
    onForceDisconnect(() => {
      signOut({ callbackUrl: '/agent/login' });
    });
  }, []);

  // Real-time updates (also registers agent for presence tracking)
  useServiceSocket(user.serviceId, useCallback(() => {
    refreshQueue();
  }, [refreshQueue]), user.id);

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

  // Recall ticket (re-notify visitor + display)
  async function handleRecall() {
    if (!stats.currentTicket) return;
    setLoading(true);
    try {
      await fetch('/api/agent/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: stats.currentTicket.id }),
      });
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  async function handleSelectCounter(counterId: string) {
    setSelectingCounter(counterId);
    try {
      const res = await fetch('/api/agent/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      });
      if (res.ok) {
        setShowCounterSelect(false);
        await refreshQueue();
      }
    } catch {
      // silent
    }
    setSelectingCounter(null);
  }

  const currentCode = stats.currentTicket?.displayCode ?? '---';

  return (
    <main className="flex min-h-screen flex-col bg-gray-400">
      {/* Header */}
      <div className="p-4">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">
              {user.name}
            </p>
            <p className="text-xs text-gray-600">
              {user.serviceName}
              {stats.counterLabel && (
                <span className="ml-1 rounded bg-white/50 px-1.5 py-0.5 text-xs font-normal text-gray-600">
                  {stats.counterLabel}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => router.push('/admin')}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Admin
            </button>
            <button
              onClick={() => setShowPasswordChange(true)}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-300"
            >
              Mot de passe
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/agent/login' })}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-300"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Waiting count banner */}
          {stats.waitingCount > 0 ? (
            <div className="rounded-2xl bg-orange-500 p-4 text-center text-white shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-white"></span>
                <span className="text-3xl font-black">{stats.waitingCount}</span>
                <span className="text-lg font-medium">
                  ticket{stats.waitingCount > 1 ? 's' : ''} en attente
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-300/50 p-4 text-center">
              <span className="text-sm font-medium text-gray-600">Aucun ticket en attente</span>
            </div>
          )}

          {/* Current serving */}
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">
              Actuellement au guichet
            </h2>
            <div className="mx-auto rounded-xl bg-gray-300/50 px-12 py-6">
              <span className="text-8xl font-black tracking-wider text-gray-900">
                {currentCode}
              </span>
            </div>
          </div>

          {/* Actions when serving someone */}
          {stats.currentTicket && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleNoShow}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  Absent
                </button>
                <button
                  onClick={() => setReturnTicket(stats.currentTicket)}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  Retour file
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-green-600 disabled:opacity-50"
                >
                  Termine
                </button>
              </div>
              <button
                onClick={handleRecall}
                disabled={loading}
                className="w-full rounded-xl border border-blue-300 bg-blue-50/50 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100/50 disabled:opacity-50"
              >
                Rappeler le visiteur
              </button>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNext}
            disabled={loading || stats.waitingCount === 0}
            className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? 'Chargement...' : 'Appeler le ticket suivant'}
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
              Ticket manuel
            </button>
          </div>

          {/* Close counter */}
          <button
            onClick={() => setShowCloseConfirm(true)}
            disabled={!!stats.currentTicket}
            className="w-full rounded-xl border border-red-300 bg-red-50/50 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100/50 disabled:opacity-50"
          >
            Cloturer le guichet
          </button>
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

      {/* Close counter confirmation */}
      <ConfirmModal
        visible={showCloseConfirm}
        title="Cloturer le guichet"
        message="Vous allez cloturer votre guichet et etre deconnecte. Confirmer ?"
        confirmLabel="Cloturer"
        cancelLabel="Annuler"
        onConfirm={handleCloseCounter}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* Password change modal */}
      <PasswordChangeModal
        visible={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
      />

      {/* Counter selection overlay (shown when agent has no counter) */}
      {showCounterSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900">
              Choisissez votre guichet
            </h2>
            <div className="space-y-2">
              {availableCounters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCounter(c.id)}
                  disabled={selectingCounter !== null}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left font-medium transition-colors disabled:opacity-50 ${
                    c.agentId
                      ? 'border-gray-200 bg-gray-50 text-gray-400'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{c.label}</span>
                    {selectingCounter === c.id && <span className="text-sm text-gray-400">Selection...</span>}
                    {c.agentId && selectingCounter !== c.id && <span className="text-xs text-gray-400">Occupe</span>}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCounterSelect(false)}
              className="mt-4 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Passer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
