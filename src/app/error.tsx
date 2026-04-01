'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-gray-600">
          Une erreur inattendue s&apos;est produite. Veuillez reessayer.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-gray-400">{error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
        >
          Reessayer
        </button>
      </div>
    </main>
  );
}
