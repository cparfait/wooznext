'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default React.memo(function CelebrationPopup({ visible, onClose }: CelebrationPopupProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stopAll = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    stopAll();

    const colors = ['#006e46', '#aec80c', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    const end = Date.now() + 2000;

    intervalRef.current = setInterval(() => {
      if (Date.now() > end) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
      });
    }, 50);

    const burstTimer = setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        startVelocity: 45,
        colors,
      });
    }, 500);
    timerRef.current = burstTimer;

    const autoCloseTimer = setTimeout(() => {
      onCloseRef.current();
    }, 3000);

    return () => {
      clearTimeout(autoCloseTimer);
      clearTimeout(burstTimer);
      stopAll();
    };
  }, [visible, stopAll]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center px-6">
        <div className="popper-icon mb-4">
          <svg viewBox="0 0 100 100" className="h-24 w-24 sm:h-32 sm:w-32">
            <path d="M62 42 L44 88 Q43 92 47 92 L53 92 Q57 92 56 88 L38 42 Z" fill="#F7C948" stroke="#E8A317" strokeWidth="2" />
            <path d="M44 88 Q43 92 47 92 L53 92 Q57 92 56 88 Z" fill="#E8A317" />
            <path d="M38 42 L62 42 L58 54 L42 54 Z" fill="#F0B429" opacity="0.6" />
            <path d="M36 36 Q32 18 22 8" fill="none" stroke="#FF6B6B" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M40 34 Q38 14 42 4" fill="none" stroke="#4ECDC4" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M48 33 Q52 12 60 6" fill="none" stroke="#45B7D1" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M56 34 Q62 16 72 10" fill="none" stroke="#96E6A1" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M60 36 Q68 22 80 20" fill="none" stroke="#DDA0DD" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M34 32 Q26 22 16 20" fill="none" stroke="#FFD93D" strokeWidth="3" strokeLinecap="round" />
            <path d="M52 32 Q54 10 48 2" fill="none" stroke="#FF8A5C" strokeWidth="3" strokeLinecap="round" />
            <circle cx="18" cy="12" r="4" fill="#FF6B6B" />
            <circle cx="40" cy="4" r="3.5" fill="#4ECDC4" />
            <circle cx="65" cy="8" r="4.5" fill="#45B7D1" />
            <circle cx="78" cy="18" r="3.5" fill="#DDA0DD" />
            <circle cx="14" cy="22" r="3" fill="#FFD93D" />
            <circle cx="82" cy="28" r="3" fill="#96E6A1" />
            <rect x="30" y="14" width="5" height="5" rx="1" fill="#FF6B6B" transform="rotate(30 32 16)" />
            <rect x="58" y="10" width="4.5" height="4.5" rx="1" fill="#FFD93D" transform="rotate(-20 60 12)" />
            <rect x="72" y="24" width="4" height="4" rx="1" fill="#4ECDC4" transform="rotate(15 74 26)" />
            <rect x="24" y="6" width="3.5" height="3.5" rx="1" fill="#45B7D1" transform="rotate(-35 26 8)" />
            <rect x="48" y="0" width="3" height="3" rx="0.8" fill="#DDA0DD" transform="rotate(10 50 2)" />
          </svg>
        </div>

        <h2 className="text-3xl font-black text-white sm:text-4xl">
          C&apos;est votre tour !
        </h2>
      </div>
    </div>
  );
});
