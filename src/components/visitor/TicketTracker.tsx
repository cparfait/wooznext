'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTicketSocket } from '@/hooks/useSocket';
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

  const refreshTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) return;
      const data = await res.json();
      setTicket(data.ticket);
      setPosition(data.position);
    } catch {
      // Silently fail
    }
  }, [ticketId]);

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

  useEffect(() => {
    if (ticket.status !== 'WAITING') return;
    const interval = setInterval(refreshTicket, 15000);
    return () => clearInterval(interval);
  }, [ticket.status, refreshTicket]);

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

  function getPositionMessage(): string {
    if (position === 1) return 'Vous etes le prochain !';
    if (position <= 3) return 'Plus que quelques instants...';
    return `${position - 1} personne${position > 2 ? 's' : ''} avant vous`;
  }

  // --- Visite terminee ---
  if (isFinished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
            <svg className="h-10 w-10 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Visite terminee</h1>
          <p className="text-gray-500">
            Votre ticket <strong className="text-gray-900">#{ticket.displayCode}</strong> est cloture.
          </p>
          <p className="text-sm text-gray-400">Merci de votre visite.</p>
        </div>
      </div>
    );
  }

  // --- En cours d'appel ---
  if (isCurrent) {
    return (
      <div className="flex min-h-screen flex-col bg-primary-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <p className="text-sm font-medium text-primary-200">
            {ticket.service.name}
          </p>
        </div>

        {/* Contenu principal */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="text-lg font-semibold uppercase tracking-widest text-accent-400">
            C&apos;est votre tour
          </p>
          <p className="mt-4 text-8xl font-black tracking-wider text-white sm:text-9xl">
            #{ticket.displayCode}
          </p>
          <p className="mt-6 text-lg text-primary-200">
            Veuillez vous presenter au guichet
          </p>
        </div>

        <CelebrationPopup
          visible={showCelebration}
          onClose={() => setShowCelebration(false)}
        />
      </div>
    );
  }

  // --- En attente ---
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 pt-6">
        <p className="text-sm font-medium text-gray-500">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary-500" />
          {ticket.service.name}
        </p>
      </div>

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Numero du ticket */}
        <div className="w-full max-w-xs rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-sm font-medium uppercase tracking-wider text-gray-400">
            Votre ticket
          </p>
          <p className="mt-2 text-6xl font-black tracking-wider text-gray-900 sm:text-7xl">
            #{ticket.displayCode}
          </p>
        </div>

        {/* Position dans la file */}
        <div className="mt-8 text-center">
          <p className="text-7xl font-black text-primary-700 sm:text-8xl">
            {position}<span className="text-4xl align-top sm:text-5xl">e</span>
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-700">
            dans la file
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {getPositionMessage()}
          </p>
        </div>

        {/* Barre de progression */}
        <div className="mt-8 w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-out"
              style={{ width: position === 1 ? '90%' : position <= 3 ? '60%' : position <= 5 ? '30%' : '10%' }}
            />
          </div>
        </div>
      </div>

      {/* Bouton quitter */}
      <div className="px-6 pb-8">
        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full rounded-2xl bg-white py-4 text-center text-sm font-medium text-gray-400 shadow-sm ring-1 ring-gray-100 transition-colors hover:bg-gray-50"
          >
            Quitter la file d&apos;attente
          </button>
        ) : (
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
