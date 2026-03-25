'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function CelebrationPopup({ visible, onClose }: CelebrationPopupProps) {
  useEffect(() => {
    if (!visible) return;

    // Fire confetti
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <h2 className="text-2xl font-bold text-gray-900">
          C&apos;est votre tour !
        </h2>
        <p className="mt-2 text-gray-600">
          Vous avez ete appele. Veuillez vous presenter au guichet.
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary-500 py-3 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600"
        >
          Bien
        </button>
      </div>
    </div>
  );
}
