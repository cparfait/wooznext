'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

interface CounterOption {
  id: string;
  label: string;
  agentId: string | null;
}

function CounterSelectionStep({
  onSelect,
  onSkip,
}: {
  onSelect: (counterId: string) => void;
  onSkip: () => void;
}) {
  const [counters, setCounters] = useState<CounterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCounters() {
      try {
        const res = await fetch('/api/agent/counters');
        if (!res.ok) {
          onSkip();
          return;
        }
        const data = await res.json();
        if (!data.counters || data.counters.length === 0) {
          onSkip();
          return;
        }
        setCounters(data.counters);
      } catch {
        onSkip();
      } finally {
        setLoading(false);
      }
    }
    fetchCounters();
  }, [onSkip]);

  async function handleSelect(counterId: string) {
    setSelecting(counterId);
    setError('');
    try {
      const res = await fetch('/api/agent/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la selection du guichet');
        setSelecting(null);
        return;
      }

      onSelect(counterId);
    } catch {
      setError('Erreur de connexion au serveur');
      setSelecting(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center text-gray-400">
        Chargement des guichets...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-center text-lg font-semibold text-gray-900">
        Choisissez votre guichet
      </h2>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {counters.map((counter) => {
          const isMine = counter.agentId !== null;
          return (
            <button
              key={counter.id}
              onClick={() => handleSelect(counter.id)}
              disabled={selecting !== null}
              className={`w-full rounded-xl border-2 px-4 py-4 text-left font-medium transition-colors disabled:opacity-50 ${
                isMine
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-primary-300 hover:bg-primary-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{counter.label}</span>
                {selecting === counter.id && (
                  <span className="text-sm text-gray-400">Selection...</span>
                )}
                {isMine && selecting !== counter.id && (
                  <span className="text-sm text-primary-500">Votre guichet actuel</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSkip}
        disabled={selecting !== null}
        className="w-full rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        Passer
      </button>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'counter'>('login');

  const callbackUrl = searchParams.get('callbackUrl') || '/agent';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep('counter');
  }

  function handleCounterDone() {
    router.push(callbackUrl);
  }

  if (step === 'counter') {
    return (
      <CounterSelectionStep
        onSelect={handleCounterDone}
        onSkip={handleCounterDone}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="agent@mairie.fr"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Votre mot de passe"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Espace Agent
          </h1>
          <p className="mt-2 text-gray-600">
            Connectez-vous pour acceder a la file d&apos;attente
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="text-center text-gray-400">Chargement...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
