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
      className="flex h-screen cursor-pointer overflow-hidden bg-white"
      onClick={handleFullscreen}
    >
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 px-8 py-5">
          <div className="flex items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-12 w-auto object-contain"
              />
            )}
            <h2 className="text-xl font-bold tracking-wide text-gray-900">
              {serviceName}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-primary-500 animate-pulse-soft" />
              <span className="text-sm font-medium text-gray-500">File active</span>
            </div>
            <span className="font-mono text-lg tabular-nums text-gray-400">
              {time}
            </span>
          </div>
        </header>

        {/* Ticket en cours — zone centrale */}
        <div className="flex flex-1 flex-col items-center justify-center px-8">
          <div
            className={`flex flex-col items-center rounded-3xl px-16 py-12 transition-all duration-500 ${
              flash ? 'bg-primary-50 animate-flash-bg' : ''
            }`}
          >
            {data.currentCode ? (
              <>
                <p className="mb-1 text-xl font-semibold uppercase tracking-[0.2em] text-primary-600">
                  Est appele
                </p>
                <p
                  className={`font-black leading-none tracking-wider transition-all duration-500 ${
                    flash
                      ? 'text-[12rem] text-primary-600 scale-105'
                      : 'text-[12rem] text-gray-900 scale-100'
                  }`}
                >
                  {data.currentCode}
                </p>
                {data.currentCounter && (
                  <div className="mt-4 rounded-xl bg-primary-50 px-8 py-3">
                    <p className="text-2xl font-bold text-primary-700">
                      {data.currentCounter}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-gray-400">
                  Aucun ticket en cours
                </p>
                <p className="mt-2 text-[8rem] font-black leading-none text-gray-200">
                  ---
                </p>
              </>
            )}
          </div>

          {/* Info en attente — bas */}
          <div className="mt-auto mb-6 flex items-center gap-6">
            {data.nextCode && (
              <div className="flex items-center gap-3 rounded-2xl bg-gray-100 px-6 py-3">
                <span className="text-sm uppercase tracking-wider text-gray-500">Suivant</span>
                <span className="text-2xl font-black text-gray-900">{data.nextCode}</span>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-2xl bg-gray-100 px-6 py-3">
              <span className="text-sm uppercase tracking-wider text-gray-500">En attente</span>
              <span className="text-2xl font-black text-gray-900">{data.waitingCount}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
