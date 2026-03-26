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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/ding.wav');
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

  return (
    <main
      className="flex min-h-screen cursor-pointer flex-col items-center justify-center bg-white p-8"
      onClick={handleFullscreen}
    >
      {/* Service name */}
      {serviceName && (
        <p className="mb-4 text-2xl font-medium text-gray-400">
          {serviceName}
        </p>
      )}

      {/* Current ticket */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-black text-gray-900">
          Ticket en cours
        </h1>
        <p
          className={`text-[12rem] font-black leading-none tracking-wider transition-all duration-500 ${
            flash
              ? 'scale-110 text-primary-500'
              : 'scale-100 text-gray-900'
          }`}
        >
          {data.currentCode ?? '---'}
        </p>
      </div>

      {/* Next ticket */}
      <div className="mt-12 space-y-2 text-center">
        <p className="text-3xl font-bold text-gray-900">
          Ticket suivant :
        </p>
        <p className="text-7xl font-black tracking-wider text-gray-500">
          {data.nextCode ?? '---'}
        </p>
      </div>

      {/* Waiting count */}
      <p className="mt-12 text-2xl text-gray-700">
        {data.waitingCount === 0
          ? 'Aucun ticket en attente'
          : `${data.waitingCount} ticket${data.waitingCount > 1 ? 's' : ''} en attente`}
      </p>
    </main>
  );
}
