'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceSocket, onForceDisconnect } from '@/hooks/useSocket';
import BottomSheet from './BottomSheet';
import ConfirmModal from './ConfirmModal';
import AddTicketModal from './AddTicketModal';

interface Ticket {
  id: string;
  displayCode: string;
  status: string;
  visitor: { phone: string };
  createdAt: string;
  returnedToQueue?: boolean;
  returnReason?: string | null;
}

interface QueueStats {
  waitingCount: number;
  currentTicket: Ticket | null;
  waitingTickets: Ticket[];
  returnedTickets: Ticket[];
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
    returnedTickets: [],
    nextTicket: null,
    counterLabel: null,
  });
  const [loading, setLoading] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [returnTicket, setReturnTicket] = useState<Ticket | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReturnedPanel, setShowReturnedPanel] = useState(false);
  const [showCounterSelect, setShowCounterSelect] = useState(false);
  const [availableCounters, setAvailableCounters] = useState<{ id: string; label: string; agentId: string | null }[]>([]);
  const [selectingCounter, setSelectingCounter] = useState<string | null>(null);

  const lastRefreshRef = useRef(0);

  const handleCloseCounter = useCallback(async () => {
    try {
      await fetch('/api/agent/counter', { method: 'DELETE' });
      signOut({ callbackUrl: '/agent/login' });
    } catch {
      // Silent fail
    }
  }, []);

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

  useEffect(() => {
    async function init() {
      const qRes = await fetch('/api/agent/queue');
      if (qRes.ok) {
        const data = await qRes.json();
        setStats(data);
        if (!data.counterLabel) {
          const cRes = await fetch('/api/agent/counters');
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData.counters && cData.counters.length > 0) {
              if (cData.counters.length === 1) {
                handleSelectCounter(cData.counters[0].id);
              } else {
                const freeCounters = cData.counters.filter((c: { agentId: string | null }) => !c.agentId);
                if (freeCounters.length === 1) {
                  handleSelectCounter(freeCounters[0].id);
                } else if (freeCounters.length > 1) {
                  setAvailableCounters(cData.counters);
                  setShowCounterSelect(true);
                }
              }
            }
          }
        }
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force disconnect handler (admin released counter)
  useEffect(() => {
    onForceDisconnect(() => {
      signOut({ callbackUrl: '/agent/login' });
    });
  }, []);

  // Real-time updates (also registers agent for presence tracking)
  useServiceSocket(user.serviceId, useCallback((_event: string, _data: any) => {
    lastRefreshRef.current = Date.now();
    refreshQueue();
  }, [refreshQueue]), user.id);

  // Fallback polling — debounced to skip when socket just refreshed
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastRefreshRef.current > 5000) {
        refreshQueue();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  const callNextFromApi = useCallback(async () => {
    setLoading(true);
    setShowReturnedPanel(false);
    try {
      const res = await fetch('/api/agent/next', { method: 'POST' });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [refreshQueue]);

  const handleNext = useCallback(() => {
    if (stats.returnedTickets && stats.returnedTickets.length > 0) {
      setShowReturnedPanel(true);
    } else {
      callNextFromApi();
    }
  }, [stats.returnedTickets, callNextFromApi]);

  const handleCallReturned = useCallback(async (ticketId: string) => {
    setLoading(true);
    setShowReturnedPanel(false);
    try {
      const res = await fetch(`/api/agent/call/${ticketId}`, { method: 'POST' });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [refreshQueue]);

  const handleCallById = useCallback(async (ticketId: string) => {
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
  }, [refreshQueue]);

  const handleComplete = useCallback(async () => {
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
  }, [stats.currentTicket, refreshQueue]);

  const handleReturn = useCallback(async () => {
    if (!returnTicket) return;
    setLoading(true);
    setReturnTicket(null);
    try {
      const res = await fetch(`/api/agent/return/${returnTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: returnReason.trim() || undefined }),
      });
      if (res.ok) {
        await refreshQueue();
      }
    } catch {
      // Silent fail
    }
    setReturnReason('');
    setLoading(false);
  }, [returnTicket, returnReason, refreshQueue]);

  const handleNoShow = useCallback(async () => {
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
  }, [stats.currentTicket, refreshQueue]);

  const handleRecall = useCallback(async () => {
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
  }, [stats.currentTicket]);

  const handleSelectCounter = useCallback(async (counterId: string) => {
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
  }, [refreshQueue]);

  const currentCode = stats.currentTicket?.displayCode ?? '---';

  return (
    <main className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <div className="p-4">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">
              {user.name}
            </p>
            <p className="text-xs text-gray-600">
              {user.serviceName}
            </p>
            {stats.counterLabel && (
              <p className="text-xs text-gray-500">
                {stats.counterLabel}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => router.push('/admin')}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Admin
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/agent/login' })}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100"
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
            <div className="rounded-2xl bg-yellow-400 p-4 text-center text-gray-900 shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-gray-900"></span>
                <span className="text-3xl font-black">{stats.waitingCount}</span>
                <span className="text-lg font-medium">
                  ticket{stats.waitingCount > 1 ? 's' : ''} en attente
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-100 p-4 text-center">
              <span className="text-sm font-medium text-gray-600">Aucun ticket en attente</span>
            </div>
          )}

          <div className="mx-auto rounded-xl bg-white px-12 py-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-gray-600">
              Actuellement au guichet
            </p>
            <span className="text-8xl font-black tracking-wider text-gray-900">
              {currentCode}
            </span>
            {stats.currentTicket?.returnReason && (
              <p className="mt-1 truncate text-xs text-orange-600" title={stats.currentTicket.returnReason}>
                {stats.currentTicket.returnReason}
              </p>
            )}
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
                className="w-full rounded-xl border border-primary-500 bg-white/50 py-2.5 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-50 disabled:opacity-50"
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
            {loading ? 'Chargement...' : (stats.returnedTickets && stats.returnedTickets.length > 0 ? 'Appeler un ticket' : 'Appeler le ticket suivant')}
          </button>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowBottomSheet(true)}
              disabled={stats.waitingCount === 0}
              className="flex-1 rounded-xl border border-primary-500 bg-white/50 py-3 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-50 disabled:opacity-50"
            >
              Appeler par numero
            </button>
            <button
              onClick={() => setShowAddTicket(true)}
              className="flex-1 rounded-xl border border-primary-500 bg-white/50 py-3 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-50"
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

      {/* Return to queue modal with reason input */}
      {returnTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Retour a la file</h3>
            <p className="mt-2 text-sm text-gray-600">
              Le visiteur avec le numero <span className="font-black">{returnTicket.displayCode}</span> sera renvoye a la file d&apos;attente.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Raison (optionnel)
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Ex: Document manquant"
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setReturnTicket(null); setReturnReason(''); }}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReturn}
                disabled={loading}
                className="flex-1 rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add ticket modal */}
      <AddTicketModal
        visible={showAddTicket}
        serviceId={user.serviceId}
        onClose={() => setShowAddTicket(false)}
        onCreated={refreshQueue}
      />

      {/* Returned tickets selection panel */}
      {showReturnedPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900">
              Tickets remis en file
            </h2>
            <div className="space-y-2">
              {stats.returnedTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleCallReturned(t.id)}
                  disabled={loading}
                  className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-left font-medium text-gray-900 transition-colors hover:border-orange-400 hover:bg-orange-100 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black">{t.displayCode}</span>
                    <span className="text-xs font-semibold text-orange-500">Remis en file</span>
                  </div>
                  {t.returnReason && (
                    <p className="mt-1 truncate text-xs text-orange-700" title={t.returnReason}>
                      {t.returnReason}
                    </p>
                  )}
                </button>
              ))}
              {stats.waitingTickets.length > 0 && (
                <button
                  onClick={callNextFromApi}
                  disabled={loading}
                  className="w-full rounded-xl border-2 border-primary-300 bg-primary-50 px-4 py-3 text-left font-medium text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-100 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Ticket suivant</span>
                    <span className="text-xs">{stats.waitingTickets[0]?.displayCode}</span>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => setShowReturnedPanel(false)}
              className="mt-4 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

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
          </div>
        </div>
      )}
    </main>
  );
}
