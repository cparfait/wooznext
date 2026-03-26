'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceSocket } from '@/hooks/useSocket';

interface DisplayData {
  currentCode: string | null;
  nextCode: string | null;
  waitingCount: number;
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

      // Flash animation + sound when current ticket changes
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
      className="flex min-h-screen cursor-pointer flex-col bg-gradient-to-b from-primary-800 via-primary-700 to-primary-900"
      onClick={handleFullscreen}
    >
      {/* Header bar */}
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-14 w-auto object-contain"
            />
          )}
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-accent-500 animate-pulse-soft" />
            <span className="text-lg font-medium text-primary-200">
              File active
            </span>
          </div>
        </div>
        {serviceName && (
          <h2 className="text-2xl font-bold tracking-wide text-white">
            {serviceName}
          </h2>
        )}
        <span className="font-mono text-lg tabular-nums text-primary-200">
          {time}
        </span>
      </header>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-10 pb-10">
        <div className="grid w-full max-w-6xl grid-cols-3 gap-8">

          {/* Current ticket — main card */}
          <div className="col-span-2 flex flex-col items-center justify-center rounded-3xl bg-white/10 p-12 backdrop-blur-sm ring-1 ring-white/20">
            <p className="mb-2 text-2xl font-semibold uppercase tracking-widest text-primary-200">
              Ticket en cours
            </p>
            <div className="relative">
              <p
                className={`font-black leading-none tracking-wider transition-all duration-500 ${
                  data.currentCode
                    ? flash
                      ? 'text-[14rem] scale-105 text-accent-400'
                      : 'text-[14rem] scale-100 text-white'
                    : 'text-[10rem] text-white/30'
                }`}
              >
                {data.currentCode ?? '---'}
              </p>
              {flash && (
                <div className="absolute inset-0 rounded-3xl bg-accent-500/10 animate-slide-up" />
              )}
            </div>
          </div>

          {/* Right column: next ticket + waiting count */}
          <div className="flex flex-col gap-8">

            {/* Next ticket */}
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
              <p className="mb-2 text-lg font-semibold uppercase tracking-widest text-primary-300">
                Ticket suivant
              </p>
              <p className={`text-8xl font-black tracking-wider ${
                data.nextCode ? 'text-white/80' : 'text-white/20'
              }`}>
                {data.nextCode ?? '---'}
              </p>
            </div>

            {/* Waiting count */}
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
              <p className="mb-2 text-lg font-semibold uppercase tracking-widest text-primary-300">
                En attente
              </p>
              <p className="text-8xl font-black text-white/80">
                {data.waitingCount}
              </p>
              <p className="mt-2 text-lg text-primary-300">
                {data.waitingCount === 0
                  ? 'File vide'
                  : `ticket${data.waitingCount > 1 ? 's' : ''}`}
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
