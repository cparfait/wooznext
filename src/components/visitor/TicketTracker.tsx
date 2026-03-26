'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTicketSocket } from '@/hooks/useSocket';
import ProgressCircle from './ProgressCircle';
import CelebrationPopup from './CelebrationPopup';

interface TicketData {
  id: string;
  displayCode: string;
  status: string;
  service: { name: string };
}

interface TicketTrackerProps {
  ticketId: string;
  initialTicket: TicketData;
  initialPosition: number;
}

export default function TicketTracker({
  ticketId,
  initialTicket,
  initialPosition,
}: TicketTrackerProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [position, setPosition] = useState(initialPosition);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isCurrent = ticket.status === 'SERVING';
  const isFinished = ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'NO_SHOW';

  // Refresh ticket data from API
  const refreshTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTicket(data.ticket);
      setPosition(data.position);
    } catch {
      // Silently fail, will retry on next event
    }
  }, [ticketId]);

  // Socket.IO events
  useTicketSocket(ticketId, useCallback((event: string) => {
    if (event === 'ticket:called') {
      setShowCelebration(true);
      refreshTicket();
    } else if (event === 'ticket:completed' || event === 'ticket:no-show') {
      refreshTicket();
    } else if (event === 'ticket:returned') {
      setShowCelebration(false);
      refreshTicket();
    }
  }, [refreshTicket]));

  // Also listen for queue updates to refresh position
  useEffect(() => {
    if (ticket.status !== 'WAITING') return;
    const interval = setInterval(refreshTicket, 15000);
    return () => clearInterval(interval);
  }, [ticket.status, refreshTicket]);

  // Show celebration on mount if already being served
  useEffect(() => {
    if (isCurrent) setShowCelebration(true);
  }, [isCurrent]);

  async function handleLeave() {
    try {
      await fetch(`/api/tickets/${ticketId}/cancel`, { method: 'POST' });
      await refreshTicket();
    } catch {
      // ignore
    }
    setShowLeaveConfirm(false);
  }

  if (isFinished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Visite terminee
          </h1>
          <p className="text-gray-500">
            Votre ticket <strong className="text-gray-900">#{ticket.displayCode}</strong> est cloture.
          </p>
          <p className="text-sm text-gray-400">
            Merci de votre visite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header with service name */}
      <div className="px-6 pt-6">
        <p className="text-sm font-medium text-gray-900">
          <span className="mr-1.5 inline-block text-primary-500">&#9679;</span>
          {ticket.service.name}
        </p>
      </div>

      {/* Main circle area - centered */}
      <div className="flex flex-1 items-center justify-center px-4">
        <ProgressCircle
          position={position}
          total={position}
          isCurrent={isCurrent}
          displayCode={ticket.displayCode}
        />
      </div>

      {/* Bottom buttons */}
      <div className="space-y-3 px-6 pb-8">
        {ticket.status === 'WAITING' && !showLeaveConfirm && (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full rounded-xl bg-gray-100 py-4 text-center text-base font-medium text-gray-500 transition-colors hover:bg-gray-200"
          >
            Quitter la file d&apos;attente
          </button>
        )}

        {showLeaveConfirm && (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              Etes-vous sur de vouloir quitter la file ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLeave}
                className="flex-1 rounded-xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-red-600"
              >
                Oui, quitter
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <CelebrationPopup
        visible={showCelebration && isCurrent}
        onClose={() => setShowCelebration(false)}
      />
    </div>
  );
}
