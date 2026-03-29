'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceSocket } from '@/hooks/useSocket';

function formatFrenchDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return 'Publie le ' + match[1] + '/' + match[2] + '/' + match[3];
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return 'Publie le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return '';
}

interface ServingTicket {
  displayCode: string;
  counterLabel: string | null;
  calledAt: string | null;
}

interface PreviousTicket {
  displayCode: string;
  counterLabel: string | null;
}

interface DisplayData {
  currentCode: string | null;
  currentCounter: string | null;
  previousTickets: PreviousTicket[];
  waitingCount: number;
  servingTickets: ServingTicket[];
}

interface FeedItem {
  title: string;
  date: string | null;
  image: string | null;
  url: string | null;
  content: string | null;
  category: string | null;
}

interface TickerConfig {
  position: 'top' | 'middle' | 'bottom';
  height: number;
  bgColor: string;
  textColor: string;
  fontSize: number;
}

interface PublicDisplayProps {
  serviceId: string;
  initialData: DisplayData;
  initialTickerMessage: string | null;
  initialTickerConfig: TickerConfig;
  initialHasFeed: boolean;
}

const WAIT_START = 8000;
const WAIT_END = 5000;
const SCROLL_SPEED = 30; // px per second

export default function PublicDisplay({
  serviceId,
  initialData,
  initialTickerMessage,
  initialTickerConfig,
  initialHasFeed,
}: PublicDisplayProps) {
  const [data, setData] = useState<DisplayData>(initialData);
  const [calling, setCalling] = useState(false);
  const [callingCode, setCallingCode] = useState<string | null>(null);
  const [callingCounter, setCallingCounter] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[] | null>(null);
  const [tickerMessage, setTickerMessage] = useState<string | null>(initialTickerMessage);
  const [tickerConfig, setTickerConfig] = useState<TickerConfig>(initialTickerConfig);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDuration, setSlideDuration] = useState(15000);
  const [progressKey, setProgressKey] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Clock
  const [clockTime, setClockTime] = useState('');
  const [clockDate, setClockDate] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      );
      let dateStr = now.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      setClockDate(dateStr);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/ding.wav');
  }, []);

  // Load logo
  useEffect(() => {
    fetch('/api/logo')
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
          setLogoUrl('/api/logo');
        }
      })
      .catch(() => {});
  }, []);

  // Load feed
  useEffect(() => {
    async function loadFeed() {
      try {
        const res = await fetch(`/api/feed?serviceId=${serviceId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          setFeedItems(json.items);
        } else {
          setFeedItems(null);
        }
      } catch {
        // No feed
      }
    }
    loadFeed();
    const interval = setInterval(loadFeed, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [serviceId]);

  // Refresh ticker
  const refreshTicker = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${serviceId}/ticker`);
      if (!res.ok) return;
      const json = await res.json();
      setTickerMessage(json.message ?? null);
      if (json.position || json.height || json.bgColor || json.textColor || json.fontSize) {
        setTickerConfig({
          position: json.position ?? 'bottom',
          height: json.height ?? 48,
          bgColor: json.bgColor ?? '#dc2626',
          textColor: json.textColor ?? '#ffffff',
          fontSize: json.fontSize ?? 18,
        });
      }
    } catch {
      // ignore
    }
  }, [serviceId]);

  useEffect(() => {
    const interval = setInterval(refreshTicker, 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshTicker]);

  // Sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  // Data refresh
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${serviceId}`);
      if (!res.ok) return;
      const newData = await res.json();
      setData(newData);
    } catch {
      // Silent fail
    }
  }, [serviceId]);

  useServiceSocket(
    serviceId,
    useCallback((event: string, eventData: any) => {
      if (event === 'ticket:called') {
        // Capture the called ticket info for the animation
        setCallingCode(eventData?.displayCode ?? null);
        setCallingCounter(eventData?.counterLabel ?? null);
        setCalling(true);
        playNotificationSound();
        setTimeout(() => setCalling(false), 30000);
      }
      refreshData();
    }, [refreshData, playNotificationSound])
  );

  useEffect(() => {
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Carousel logic
  useEffect(() => {
    if (!feedItems || feedItems.length === 0) return;

    const textEl = textRefs.current[currentSlide];
    const wrapperEl = wrapperRefs.current[currentSlide];

    let scrollDistance = 0;
    let scrollDuration = 0;

    if (textEl && wrapperEl) {
      // Reset position first
      textEl.style.transition = 'none';
      textEl.style.transform = 'translateY(0)';
      // Force reflow
      void textEl.offsetHeight;

      scrollDistance = Math.max(0, textEl.scrollHeight - wrapperEl.clientHeight);
      scrollDuration = scrollDistance > 0 ? (scrollDistance / SCROLL_SPEED) * 1000 : 0;
    }

    const totalDuration = WAIT_START + scrollDuration + WAIT_END;
    setSlideDuration(totalDuration);
    setProgressKey((prev) => prev + 1);

    // Start scrolling after WAIT_START
    if (scrollDistance > 0 && textEl) {
      scrollTimerRef.current = setTimeout(() => {
        textEl.style.transition = `transform ${scrollDuration}ms linear`;
        textEl.style.transform = `translateY(-${scrollDistance}px)`;
      }, WAIT_START);
    }

    // Move to next slide
    slideTimerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % feedItems.length);
    }, totalDuration);

    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
    };
  }, [currentSlide, feedItems]);

  // Auto-reload page every hour
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), 3600000);
    return () => clearTimeout(timer);
  }, []);

  function handleFullscreen() {
    document.documentElement.requestFullscreen?.();
  }

  const hasFeed = initialHasFeed || (feedItems && feedItems.length > 0);
  const hasTicker = !!tickerMessage;

  return (
    <div
      className="flex h-screen cursor-pointer flex-col overflow-hidden"
      style={{ backgroundColor: '#f0f2f5', fontFamily: "'Montserrat', sans-serif" }}
      onClick={handleFullscreen}
    >
      {/* Header */}
      <header
        className="flex shrink-0 items-center justify-between bg-white px-10 shadow-sm"
        style={{ height: '100px', borderBottom: '4px solid #006e46' }}
      >
        <div className="flex items-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="block h-[70px] w-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
        <div className="flex flex-col items-end">
          <span
            className="font-black leading-none tracking-wide"
            style={{ fontSize: '2.2em', color: '#006e46' }}
          >
            {clockTime}
          </span>
          <span
            className="mt-1 font-semibold uppercase tracking-wide"
            style={{ fontSize: '1em', color: '#888888', letterSpacing: '0.5px' }}
          >
            {clockDate}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex min-h-0 flex-1">
        {/* Ticket area */}
        <main className="relative flex flex-1 items-center justify-center p-10">
          <div
            className={`flex flex-col items-center rounded-[20px] bg-white text-center transition-all duration-400 ${
              calling
                ? 'animate-wow-alert border-4 border-primary-700'
                : 'border-4 border-transparent'
            }`}
            style={{
              padding: '60px 100px',
              boxShadow: '0 15px 45px rgba(0,0,0,0.05)',
              backgroundColor: calling ? '#f0fdf4' : '#ffffff',
            }}
          >
            {(() => {
              // During animation, use the socket event data; otherwise use API data
              const displayCode = calling ? (callingCode ?? data.currentCode) : data.currentCode;
              const displayCounter = calling ? (callingCounter ?? data.currentCounter) : data.currentCounter;

              if (displayCode) {
                return (
                  <>
                    <h2
                      className={`m-0 text-2xl font-semibold uppercase ${
                        calling ? 'font-black text-primary-700' : 'text-gray-400'
                      }`}
                      style={{ fontSize: '2em' }}
                    >
                      {calling ? 'A votre tour !' : 'Dernier appel'}
                    </h2>
                    <div
                      className={`my-5 font-black leading-none tracking-wider ${
                        calling ? 'text-primary-700' : 'text-gray-900'
                      }`}
                      style={{
                        fontSize: '10em',
                        textShadow: calling ? '0 4px 15px rgba(0, 110, 70, 0.3)' : 'none',
                      }}
                    >
                      {displayCode}
                    </div>
                    {displayCounter && (
                      <p
                        className={`m-0 font-bold ${
                          calling ? 'text-gray-900' : 'text-primary-700'
                        }`}
                        style={{ fontSize: '3em' }}
                      >
                        {calling
                          ? `Allez au ${displayCounter}`
                          : displayCounter}
                      </p>
                    )}
                  </>
                );
              }

              return (
                <>
                  <h2
                    className="m-0 font-semibold uppercase text-gray-400"
                    style={{ fontSize: '2em' }}
                  >
                    Dernier appel
                  </h2>
                  <div
                    className="my-5 font-black leading-none text-gray-200"
                    style={{ fontSize: '10em' }}
                  >
                    ---
                  </div>
                </>
              );
            })()}
          </div>

          {/* Bottom info */}
          <div
            className="absolute bottom-8 left-10 right-10 flex items-center justify-center gap-6"
            style={{ marginBottom: hasTicker && tickerConfig.position === 'bottom' ? `${tickerConfig.height}px` : '0' }}
          >
            {data.previousTickets.slice(0, 1).map((ticket, index) => (
              <div key={index} className="flex items-center gap-3 rounded-2xl bg-white px-6 py-3 shadow-sm">
                <span className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Precedent
                </span>
                <span className="text-2xl font-black text-gray-900">
                  {ticket.displayCode}
                </span>
                {ticket.counterLabel && (
                  <span className="text-sm font-semibold text-primary-700">
                    {ticket.counterLabel}
                  </span>
                )}
              </div>
            ))}
            {data.waitingCount > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-3 shadow-sm">
                <span className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  En attente
                </span>
                <span className="text-2xl font-black text-gray-900">
                  {data.waitingCount}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* News sidebar */}
        {hasFeed && (
          <aside
            className="relative flex flex-col bg-white"
            style={{
              width: '35%',
              minWidth: '400px',
              maxWidth: '600px',
              boxShadow: '-5px 0 25px rgba(0, 0, 0, 0.08)',
            }}
          >
            {feedItems && feedItems.length > 0 ? (
              <div className="relative flex-1 overflow-hidden">
                {feedItems.map((item, index) => (
                  <div
                    key={index}
                    className="absolute inset-0 flex flex-col transition-opacity duration-1000"
                    style={{
                      opacity: currentSlide === index ? 1 : 0,
                      visibility: currentSlide === index ? 'visible' : 'hidden',
                      zIndex: currentSlide === index ? 10 : 0,
                    }}
                  >
                    {/* Slide image */}
                    {item.image && !failedImages.has(index) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        className="w-full shrink-0 object-cover"
                        style={{ height: '30%', backgroundColor: '#f8f9fa' }}
                        onError={() => setFailedImages(prev => { const s = new Set(prev); s.add(index); return s; })}
                      />
                    ) : (
                      <div
                        className="flex w-full shrink-0 items-center justify-center text-2xl font-extrabold text-white"
                        style={{ height: '30%', backgroundColor: '#006e46' }}
                      >
                        Actualites
                      </div>
                    )}

                    {/* Slide content */}
                    <div
                      className="flex flex-1 flex-col"
                      style={{ padding: '30px 40px' }}
                    >
                      <div
                        className="font-bold uppercase"
                        style={{
                          color: '#006e46',
                          fontSize: '1em',
                          letterSpacing: '1.5px',
                          marginBottom: '10px',
                        }}
                      >
                        {item.category || 'En direct'}
                      </div>
                      <h1
                        className="font-black leading-tight"
                        style={{
                          color: '#111111',
                          fontSize: '1.8em',
                          margin: '0 0 10px 0',
                          letterSpacing: '-0.5px',
                        }}
                      >
                        {item.title || 'Actualite'}
                      </h1>
                      {item.date && (
                        <div
                          className="font-semibold uppercase"
                          style={{
                            fontSize: '0.9em',
                            color: '#888888',
                            marginBottom: '20px',
                          }}
                        >
                          {formatFrenchDate(item.date)}
                        </div>
                      )}

                      {/* Scrolling text */}
                      {item.content && (
                        <div
                          ref={(el) => {
                            wrapperRefs.current[index] = el;
                          }}
                          className="relative min-h-0 flex-1 overflow-hidden"
                          style={{
                            maskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                            WebkitMaskImage:
                              'linear-gradient(to bottom, black 80%, transparent 100%)',
                          }}
                        >
                          <div
                            ref={(el) => {
                              textRefs.current[index] = el;
                            }}
                            className="absolute left-0 top-0 w-full"
                            style={{
                              fontSize: '1.1em',
                              lineHeight: '1.6',
                              color: '#333333',
                              paddingBottom: '60px',
                            }}
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Progress bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 z-20"
                  style={{ height: '8px', backgroundColor: '#e2e8f0' }}
                >
                  <div
                    key={progressKey}
                    style={{
                      height: '100%',
                      backgroundColor: '#006e46',
                      animation: `progress ${slideDuration}ms linear`,
                      width: '0%',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-center text-lg font-semibold text-primary-700">
                  Chargement...
                </p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Ticker */}
      {hasTicker && (
        <div
          className="fixed left-0 right-0 z-50 flex items-center overflow-hidden"
          style={{
            ...(tickerConfig.position === 'top' ? { top: 0 } : {}),
            ...(tickerConfig.position === 'middle' ? { top: '50%', transform: 'translateY(-50%)' } : {}),
            ...(tickerConfig.position === 'bottom' ? { bottom: 0 } : {}),
            height: `${tickerConfig.height}px`,
            backgroundColor: tickerConfig.bgColor,
          }}
        >
          <p
            className="animate-ticker whitespace-nowrap font-bold"
            style={{
              color: tickerConfig.textColor,
              fontSize: `${tickerConfig.fontSize}px`,
              lineHeight: `${tickerConfig.height}px`,
            }}
          >
            {tickerMessage}
          </p>
        </div>
      )}
    </div>
  );
}
