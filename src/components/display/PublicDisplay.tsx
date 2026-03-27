'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceSocket } from '@/hooks/useSocket';

function parseFrenchDate(dateStr: string): string {
  // Handle "DD/MM/YYYY HH:MM" format from ville-chatillon.fr
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const d = new Date(`${match[3]}-${match[2]}-${match[1]}`);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  // Fallback for ISO dates
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

interface ServingTicket {
  displayCode: string;
  counterLabel: string | null;
  calledAt: string | null;
}

interface DisplayData {
  currentCode: string | null;
  currentCounter: string | null;
  lastCalledCode: string | null;
  waitingCount: number;
  servingTickets: ServingTicket[];
}

interface FeedItem {
  title: string;
  date: string | null;
  image: string | null;
  url: string | null;
}

interface PublicDisplayProps {
  serviceId: string;
  serviceName: string;
  initialData: DisplayData;
}

export default function PublicDisplay({
  serviceId,
  initialData,
}: PublicDisplayProps) {
  const [data, setData] = useState<DisplayData>(initialData);
  const [flash, setFlash] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[] | null>(null);
  const [tickerMessage, setTickerMessage] = useState<string | null>(null);
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

  // Load ticker message
  useEffect(() => {
    async function loadTicker() {
      try {
        const res = await fetch('/api/admin/ticker');
        if (!res.ok) return;
        const json = await res.json();
        setTickerMessage(json.message ?? null);
      } catch {
        // ignore
      }
    }
    loadTicker();
    const interval = setInterval(loadTicker, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load feed
  useEffect(() => {
    async function loadFeed() {
      try {
        const res = await fetch('/api/feed');
        if (!res.ok) return;
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          setFeedItems(json.items);
        }
      } catch {
        // No feed
      }
    }
    loadFeed();
    // Refresh feed every 5 minutes
    const interval = setInterval(loadFeed, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

  const hasFeed = feedItems && feedItems.length > 0;

  return (
    <main
      className="relative flex h-screen cursor-pointer overflow-hidden bg-white"
      onClick={handleFullscreen}
    >
      {/* Zone principale */}
      <div className={`flex flex-col ${hasFeed ? 'flex-[65]' : 'flex-1'}`}>
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
            {data.lastCalledCode && (
              <div className="flex items-center gap-3 rounded-2xl bg-gray-100 px-6 py-3">
                <span className="text-sm uppercase tracking-wider text-gray-500">Dernier appel</span>
                <span className="text-2xl font-black text-gray-900">{data.lastCalledCode}</span>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-2xl bg-gray-100 px-6 py-3">
              <span className="text-sm uppercase tracking-wider text-gray-500">En attente</span>
              <span className="text-2xl font-black text-gray-900">{data.waitingCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau droit — flux d'actualites (uniquement si configure) */}
      {hasFeed && (
        <div className="flex flex-[35] flex-col border-l border-gray-200 bg-gray-50">
          <div className="border-b border-gray-200 px-6 py-5">
            <h3 className="text-lg font-bold uppercase tracking-wider text-gray-500">
              Actualites
            </h3>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {feedItems.map((item, index) => (
                <div key={index} className="px-6 py-5">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="mb-3 h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <p className="text-base font-semibold leading-snug text-gray-800">
                    {item.title}
                  </p>
                  {item.date && (
                    <p className="mt-1 text-xs text-gray-400">
                      {parseFrenchDate(item.date)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Bandeau defilant — message urgent */}
      {tickerMessage && (
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden bg-red-600 py-3">
          <p
            className="whitespace-nowrap text-lg font-bold text-white animate-ticker"
          >
            {tickerMessage}
          </p>
        </div>
      )}
    </main>
  );
}
