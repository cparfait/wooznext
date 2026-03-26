'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceSocket } from '@/hooks/useSocket';

interface ServingTicket {
  displayCode: string;
  counterLabel: string | null;
  calledAt: string | null;
}

interface DisplayData {
  currentCode: string | null;
  currentCounter: string | null;
  nextCode: string | null;
  waitingCount: number;
  servingTickets: ServingTicket[];
}

interface PublicDisplayProps {
  serviceId: string;
  serviceName: string;
  initialData: DisplayData;
}

export default function PublicDisplay({
  serviceId,
  serviceName,
  initialData,
}: PublicDisplayProps) {
  const [data, setData] = useState<DisplayData>(initialData);
  const [flash, setFlash] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/ding.wav');
  }, []);

  // Load logo
  useEffect(() => {
    fetch('/api/logo')
      .then((res) => {
        if (res.ok) setLogoUrl('/api/logo');
      })
      .catch(() => {});
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${serviceId}`);
      if (!res.ok) return;
      const newData = await res.json();

      if (newData.currentCode && newData.currentCode !== data.currentCode) {
        setFlash(true);
        playNotificationSound();
        setTimeout(() => setFlash(false), 2000);
      }

      setData(newData);
    } catch {
      // Silent fail
    }
  }, [serviceId, data.currentCode, playNotificationSound]);

  // Real-time updates
  useServiceSocket(serviceId, useCallback(() => {
    refreshData();
  }, [refreshData]));

  // Fallback polling every 10s
  useEffect(() => {
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Auto fullscreen on click
  function handleFullscreen() {
    document.documentElement.requestFullscreen?.();
  }

  // Clock
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className="flex h-screen cursor-pointer overflow-hidden"
      onClick={handleFullscreen}
    >
      {/* Zone gauche — ticket en cours */}
      <div className="flex flex-[65] flex-col bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-12 w-auto object-contain"
              />
            )}
            <h2 className="text-xl font-bold tracking-wide text-white">
              {serviceName}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-accent-500 animate-pulse-soft" />
              <span className="text-sm font-medium text-primary-200">File active</span>
            </div>
            <span className="font-mono text-lg tabular-nums text-primary-200">
              {time}
            </span>
          </div>
        </header>

        {/* Ticket en cours — zone centrale */}
        <div className="flex flex-1 flex-col items-center justify-center px-8">
          <div
            className={`flex flex-col items-center rounded-3xl px-16 py-12 transition-all duration-500 ${
              flash ? 'bg-accent-500/15 animate-flash-bg' : ''
            }`}
          >
            {data.currentCode ? (
              <>
                <p className="mb-1 text-xl font-semibold uppercase tracking-[0.2em] text-accent-400">
                  Est appele
                </p>
                <p
                  className={`font-black leading-none tracking-wider transition-all duration-500 ${
                    flash
                      ? 'text-[12rem] text-accent-400 scale-105'
                      : 'text-[12rem] text-white scale-100'
                  }`}
                >
                  {data.currentCode}
                </p>
                {data.currentCounter && (
                  <div className="mt-4 rounded-xl bg-white/15 px-8 py-3 backdrop-blur-sm">
                    <p className="text-2xl font-bold text-white">
                      {data.currentCounter}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-primary-300">
                  Aucun ticket en cours
                </p>
                <p className="mt-2 text-[8rem] font-black leading-none text-white/20">
                  ---
                </p>
              </>
            )}
          </div>

          {/* Info en attente — bas de la zone gauche */}
          <div className="mt-auto mb-6 flex items-center gap-6">
            {data.nextCode && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 ring-1 ring-white/10">
                <span className="text-sm uppercase tracking-wider text-primary-300">Suivant</span>
                <span className="text-2xl font-black text-white">{data.nextCode}</span>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 ring-1 ring-white/10">
              <span className="text-sm uppercase tracking-wider text-primary-300">En attente</span>
              <span className="text-2xl font-black text-white">{data.waitingCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau droit — liste des tickets appeles */}
      <div className="flex flex-[35] flex-col bg-gray-50">
        {/* En-tete du bandeau */}
        <div className="border-b border-gray-200 px-6 py-5">
          <h3 className="text-lg font-bold uppercase tracking-wider text-gray-500">
            Tickets appeles
          </h3>
        </div>

        {/* Liste des tickets */}
        <div className="flex-1 overflow-hidden">
          {data.servingTickets.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.servingTickets.map((ticket, index) => (
                <div
                  key={ticket.displayCode}
                  className={`flex items-center justify-between px-6 py-5 ${
                    index === 0 ? 'animate-slide-down bg-primary-50' : ''
                  }`}
                >
                  <span
                    className={`text-5xl font-black tracking-wider ${
                      index === 0 ? 'text-primary-700' : 'text-gray-800'
                    }`}
                  >
                    {ticket.displayCode}
                  </span>
                  {ticket.counterLabel && (
                    <div
                      className={`rounded-lg px-4 py-2 text-right ${
                        index === 0
                          ? 'bg-primary-600 text-white'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                        Guichet
                      </p>
                      <p className="text-xl font-black leading-tight">
                        {ticket.counterLabel}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-lg text-gray-300">Aucun ticket en cours</p>
            </div>
          )}
        </div>

        {/* Compteur en attente — bas du bandeau */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              En attente
            </span>
            <span className="text-3xl font-black text-gray-700">
              {data.waitingCount}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
