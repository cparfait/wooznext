'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isCurrent = ticket.status === 'SERVING';
  const isFinished = ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'NO_SHOW';

  useEffect(() => {
    audioRef.current = new Audio('/sounds/ding.wav');
    fetch('/api/logo').then((res) => {
      if (res.ok) setLogoUrl('/api/logo');
    }).catch(() => {});
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

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
      playSound();
      setShowCelebration(true);
      refreshTicket();
    } else if (event === 'ticket:completed' || event === 'ticket:no-show') {
      refreshTicket();
    } else if (event === 'ticket:returned') {
      setShowCelebration(false);
      refreshTicket();
    }
  }, [refreshTicket, playSound]));

  useEffect(() => {
    if (ticket.status !== 'WAITING') return;
    const interval = setInterval(refreshTicket, 15000);
    return () => clearInterval(interval);
  }, [ticket.status, refreshTicket]);

  useEffect(() => {
    if (isCurrent) {
      setShowCelebration(true);
    }
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
      <div className="flex min-h-svh flex-col items-center justify-center bg-gray-50 px-6">
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
      <div className="flex min-h-svh flex-col bg-primary-700">
        <div className="px-5 pt-5">
          <p className="text-sm font-medium text-primary-200">
            {ticket.service.name}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <p className="text-base font-semibold uppercase tracking-widest text-accent-400 sm:text-lg">
            C&apos;est votre tour
          </p>
          <p className="mt-3 text-7xl font-black tracking-wider text-white sm:text-9xl">
            #{ticket.displayCode}
          </p>
          <p className="mt-5 text-base text-primary-200 sm:text-lg">
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
    <div className="flex min-h-svh flex-col bg-gray-50">
      {/* Contenu principal */}
      <div className="flex flex-1 flex-col items-center justify-center px-5">
        {/* Logo */}
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="mb-6 h-14 w-auto object-contain sm:h-16" />
        )}

        {/* Numero du ticket */}
        <div className="w-full max-w-[280px] rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100 sm:max-w-xs sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 sm:text-sm">
            Votre ticket
          </p>
          <p className="mt-2 text-5xl font-black tracking-wider text-gray-900 sm:text-7xl">
            #{ticket.displayCode}
          </p>
        </div>

        {/* Position dans la file */}
        <div className="mt-6 text-center sm:mt-8">
          <p className="text-6xl font-black text-primary-700 sm:text-8xl">
            {position}<span className="text-3xl align-top sm:text-5xl">e</span>
          </p>
          <p className="mt-1 text-base font-semibold text-gray-700 sm:text-lg">
            dans la file
          </p>
          <p className="mt-1.5 text-sm text-gray-400">
            {getPositionMessage()}
          </p>
        </div>

        {/* Barre de progression */}
        <div className="mt-6 w-full max-w-[280px] sm:mt-8 sm:max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-out"
              style={{ width: position === 1 ? '90%' : position <= 3 ? '60%' : position <= 5 ? '30%' : '10%' }}
            />
          </div>
        </div>
      </div>

      {/* Bouton quitter */}
      <div className="flex flex-col items-center px-5 pb-6">
        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="rounded-2xl px-8 py-3 text-sm font-medium text-gray-400 transition-colors hover:text-gray-500"
          >
            Quitter la file d&apos;attente
          </button>
        ) : (
          <div className="w-full max-w-[280px] space-y-3 sm:max-w-xs">
            <p className="text-center text-sm text-gray-600">
              Etes-vous sur de vouloir quitter la file ?
            </p>
            <button
              onClick={handleLeave}
              className="w-full rounded-xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-red-600"
            >
              Oui, quitter
            </button>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              className="w-full rounded-xl bg-gray-100 py-3 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              Annuler
            </button>
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
