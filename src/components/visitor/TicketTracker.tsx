'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTicketSocket } from '@/hooks/useSocket';
import CelebrationPopup from './CelebrationPopup';

interface TicketData {
  id: string;
  displayCode: string;
  status: string;
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
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [counterLabel, setCounterLabel] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastRefreshRef = useRef(0);

  const isCurrent = ticket.status === 'SERVING';
  const isFinished = ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' || ticket.status === 'NO_SHOW';

  useEffect(() => {
    const audio = new Audio('/sounds/ding.wav');
    audio.volume = 1;
    audio.preload = 'auto';
    audioRef.current = audio;
    fetch('/api/logo').then((res) => {
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        setLogoUrl('/api/logo');
      }
    }).catch(() => {});
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 1;
    audio.play().catch(() => {
      const fresh = new Audio('/sounds/ding.wav');
      fresh.volume = 1;
      fresh.play().catch(() => {});
      audioRef.current = fresh;
    });
  }, []);

  function enableSound() {
    const fresh = new Audio('/sounds/ding.wav');
    fresh.volume = 1;
    fresh.play()
      .then(() => {
        fresh.pause();
        fresh.currentTime = 0;
        audioRef.current = fresh;
        setSoundEnabled(true);
      })
      .catch(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.volume = 1;
          audio.play()
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              setSoundEnabled(true);
            })
            .catch(() => {});
        }
      });
  }

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

  useTicketSocket(ticketId, useCallback((event: string, data: any) => {
    if (event === 'ticket:called') {
      if (data?.counterLabel) setCounterLabel(data.counterLabel);
      playSound();
      setShowCelebration(true);
      lastRefreshRef.current = Date.now();
      refreshTicket();
    } else if (event === 'ticket:completed' || event === 'ticket:no-show') {
      lastRefreshRef.current = Date.now();
      refreshTicket();
    } else if (event === 'ticket:returned') {
      setShowCelebration(false);
      setCounterLabel(null);
      lastRefreshRef.current = Date.now();
      refreshTicket();
    }
  }, [refreshTicket, playSound]));

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastRefreshRef.current > 5000) {
        refreshTicket();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshTicket]);

  useEffect(() => {
    if (isCurrent) {
      setShowCelebration(true);
    }
  }, [isCurrent]);

  const handleCloseCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

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
      <div className="relative flex min-h-svh flex-col bg-primary-700">
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <p className="text-base font-semibold uppercase tracking-widest text-accent-400 sm:text-lg">
            C&apos;est votre tour
          </p>
          <p className="mt-3 text-7xl font-black tracking-wider text-white sm:text-9xl">
            #{ticket.displayCode}
          </p>
          <p className="mt-5 text-base text-primary-200 sm:text-lg">
            {counterLabel
              ? `Veuillez vous presenter au ${counterLabel}`
              : 'Veuillez vous presenter au guichet'}
          </p>
        </div>

        <CelebrationPopup
          visible={showCelebration}
          onClose={handleCloseCelebration}
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
          <img src={logoUrl} alt="" className="mb-6 h-14 w-auto object-contain sm:h-16" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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

      {/* Sound + Bouton quitter */}
      <div className="flex flex-col items-center gap-3 px-5 pb-6">
        {!soundEnabled && (
          <button
            onClick={enableSound}
            className="flex items-center gap-2 rounded-xl bg-primary-50 px-5 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            Activer les notifications sonores
          </button>
        )}
        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-primary-700 bg-transparent px-5 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
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
        onClose={handleCloseCelebration}
      />
    </div>
  );
}
