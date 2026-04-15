'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
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
  initialShowPreviousTickets: boolean;
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
  initialShowPreviousTickets,
}: PublicDisplayProps) {
  const [data, setData] = useState<DisplayData>(initialData);
  const [calling, setCalling] = useState(false);
  const [callingCode, setCallingCode] = useState<string | null>(null);
  const [callingCounter, setCallingCounter] = useState<string | null>(null);
  const [lastCalledCode, setLastCalledCode] = useState<string | null>(initialData.currentCode);
  const [lastCalledCounter, setLastCalledCounter] = useState<string | null>(initialData.currentCounter);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[] | null>(null);
  const [tickerMessage, setTickerMessage] = useState<string | null>(initialTickerMessage);
  const [tickerConfig, setTickerConfig] = useState<TickerConfig>(initialTickerConfig);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDuration, setSlideDuration] = useState(15000);
  const [progressKey, setProgressKey] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [showAllCalled, setShowAllCalled] = useState(false);
  const [showPreviousTickets, setShowPreviousTickets] = useState(initialShowPreviousTickets);
  const [feedActiveState, setFeedActiveState] = useState(initialHasFeed);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ticketCardRef = useRef<HTMLDivElement | null>(null);
  const callingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const knownServingRef = useRef<Set<string>>(new Set());
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

  const loadFeedNow = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed?serviceId=${serviceId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.items && json.items.length > 0) {
        setFeedItems(json.items);
        setCurrentSlide(0);
      } else {
        setFeedItems(null);
      }
    } catch {}
  }, [serviceId]);

  useEffect(() => {
    loadFeedNow();
    const interval = setInterval(loadFeedNow, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadFeedNow]);

  // Refresh ticker
  const refreshTicker = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${serviceId}/ticker`);
      if (!res.ok) return;
      const json = await res.json();
      setTickerMessage(json.message ?? null);
      if (json.showPreviousTickets !== undefined) {
        setShowPreviousTickets(json.showPreviousTickets);
      }
      if (json.feedActive !== undefined) {
        setFeedActiveState(json.feedActive);
        if (!json.feedActive) setFeedItems(null);
      }
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

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const triggerCalling = useCallback(() => {
    if (callingTimerRef.current) clearTimeout(callingTimerRef.current);
    setCalling(false);
    requestAnimationFrame(() => {
      setCalling(true);
      playNotificationSound();
      callingTimerRef.current = setTimeout(() => setCalling(false), 10000);
    });
  }, [playNotificationSound]);

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/display/${serviceId}`);
      if (!res.ok) return;
      const newData = await res.json();

      setData((prev) => {
        knownServingRef.current = new Set(
          (newData.servingTickets ?? []).map((t: ServingTicket) => t.displayCode)
        );
        if (newData.currentCode && newData.currentCode !== prev.currentCode) {
          setCallingCode(newData.currentCode);
          setCallingCounter(newData.currentCounter);
          if (newData.currentCode) setLastCalledCode(newData.currentCode);
          if (newData.currentCounter !== undefined) setLastCalledCounter(newData.currentCounter);
          triggerCalling();
        }
        return newData;
      });
    } catch {
      // Silent fail
    }
  }, [serviceId, triggerCalling]);

  useServiceSocket(
    serviceId,
    useCallback((event: string, eventData: any) => {
      if (event === 'ticket:called') {
        const code = eventData?.displayCode ?? null;
        const counter = eventData?.counterLabel ?? null;
        const ticketId = eventData?.ticketId ?? null;
        const isRecall = ticketId ? knownServingRef.current.has(ticketId) : false;
        if (code) setLastCalledCode(code);
        if (counter !== undefined) setLastCalledCounter(counter);
        if (!isRecall) {
          setCallingCode(code);
          setCallingCounter(counter);
          triggerCalling();
        }
      }
      if (event === 'ticker:updated') {
        refreshTicker();
      }
      if (event === 'feed:updated') {
        loadFeedNow();
      }
      lastRefreshRef.current = Date.now();
      refreshData();
    }, [refreshData, triggerCalling, refreshTicker, loadFeedNow])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastRefreshRef.current > 5000) {
        refreshData();
      }
    }, 3000);
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
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
  }

  const hasFeed = feedActiveState || (feedItems && feedItems.length > 0);
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
        {/* Previous tickets column — LEFT side */}
        {showPreviousTickets && data.previousTickets.length > 0 && (
          <aside
            className="flex flex-col bg-white"
            style={{
              width: '220px',
              boxShadow: '5px 0 25px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div
              className="flex items-center justify-center font-bold uppercase tracking-wide"
              style={{
                backgroundColor: '#006e46',
                color: '#ffffff',
                padding: '16px 12px',
                fontSize: '0.85em',
                letterSpacing: '1.5px',
              }}
            >
              Appels precedents
            </div>
            <div className="flex flex-1 flex-col">
              {data.previousTickets.map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center border-b border-gray-100"
                  style={{ padding: '24px 16px' }}
                >
                  <span
                    className="font-black leading-none"
                    style={{ fontSize: '2.8em', color: '#006e46' }}
                  >
                    {t.displayCode}
                  </span>
                  {t.counterLabel && (
                    <span
                      className="mt-2 font-semibold"
                      style={{ fontSize: '0.9em', color: '#888888' }}
                    >
                      {t.counterLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Ticket area */}
        <main className="relative flex flex-1 items-center justify-center p-10">
          <div
            ref={ticketCardRef}
            className={`flex flex-col items-center rounded-[20px] text-center ${
              calling ? 'display-wow-alert border-4 border-primary-700' : 'border-4 border-transparent'
            }`}
            style={{
              padding: '60px 100px',
              boxShadow: calling
                ? '0 0 60px 30px rgba(0, 110, 70, 0.3)'
                : '0 15px 45px rgba(0,0,0,0.05)',
              backgroundColor: calling ? '#006e46' : '#ffffff',
              transition: 'background-color 0.3s, box-shadow 0.3s',
            }}
          >
            {(() => {
              // During animation, use the socket event data; otherwise use API data with fallback to last called
              const displayCode = calling ? (callingCode ?? data.currentCode) : (data.currentCode ?? lastCalledCode);
              const displayCounter = calling ? (callingCounter ?? data.currentCounter) : (data.currentCounter ?? lastCalledCounter);

              if (displayCode) {
                return (
                  <>
                    <h2
                      className={`m-0 text-2xl font-semibold uppercase ${
                        calling ? 'font-black text-white' : 'text-gray-400'
                      }`}
                      style={{ fontSize: '2em' }}
                    >
                      {calling ? 'A votre tour !' : 'Dernier appel'}
                    </h2>
                    <div
                      className={`my-5 font-black leading-none tracking-wider ${
                        calling ? 'text-white' : 'text-gray-900'
                      }`}
                      style={{
                        fontSize: '10em',
                        textShadow: calling ? '0 4px 15px rgba(255, 255, 255, 0.3)' : 'none',
                      }}
                    >
                      {displayCode}
                    </div>
                    {displayCounter && (
                      calling ? (
                        <div className={`m-0 text-center`}>
                          <p
                            className="m-0 font-bold text-accent-400"
                            style={{ fontSize: '2em' }}
                          >
                            Allez au Guichet
                          </p>
                          <p
                            className="m-0 mt-1 font-black text-white"
                            style={{ fontSize: '3em' }}
                          >
                            {displayCounter}
                          </p>
                        </div>
                      ) : (
                        <div className="m-0 text-center">
                          <p
                            className="m-0 font-semibold uppercase text-gray-400"
                            style={{ fontSize: '1em', letterSpacing: '1px' }}
                          >
                            Guichet
                          </p>
                          <p
                            className="m-0 font-bold text-primary-700"
                            style={{ fontSize: '3em' }}
                          >
                            {displayCounter}
                          </p>
                        </div>
                      )
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

          {/* Bottom info: appels en cours + en attente */}
          <div
            className="absolute bottom-8 left-10 right-10 flex flex-col items-center gap-3"
            style={{ marginBottom: hasTicker && tickerConfig.position === 'bottom' ? `${tickerConfig.height}px` : '0' }}
          >
            <div className="flex flex-wrap items-center justify-center gap-4">
              {(() => {
                const currentDisplayCode = data.currentCode ?? lastCalledCode;
                const filtered = data.servingTickets.filter(
                  (t) => !currentDisplayCode || t.displayCode !== currentDisplayCode
                );
                const shown = showAllCalled ? filtered : filtered.slice(0, 2);
                return shown.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm">
                    <span className="text-2xl font-black text-primary-700">
                      {t.displayCode}
                    </span>
                    {t.counterLabel && (
                      <span className="text-sm font-semibold text-gray-500">
                        {t.counterLabel}
                      </span>
                    )}
                  </div>
                ));
              })()}
              {data.waitingCount > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm">
                  <span className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                    En attente
                  </span>
                  <span className="text-2xl font-black text-orange-500">
                    {data.waitingCount}
                  </span>
                </div>
              )}
            </div>
            {(() => {
              const c = data.currentCode ?? lastCalledCode;
              const n = data.servingTickets.filter((t) => !c || t.displayCode !== c).length;
              return n > 2;
            })() && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAllCalled((v) => !v); }}
                className="rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-gray-700"
              >
                {showAllCalled ? 'Voir moins' : `+${(() => {
                  const c = data.currentCode ?? lastCalledCode;
                  return data.servingTickets.filter((t) => !c || t.displayCode !== c).length - 2;
                })()} autres`}
              </button>
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
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content ?? '') }}
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
