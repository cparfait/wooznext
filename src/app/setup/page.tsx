'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    serviceName: '',
    servicePrefix: '',
  });

  useEffect(() => {
    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        setNeedsSetup(data.needsSetup);
        setLoading(false);
        if (!data.needsSetup) {
          router.replace('/agent/login');
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Impossible de verifier le statut');
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          serviceName: form.serviceName,
          servicePrefix: form.servicePrefix || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.replace('/agent/login');
      } else {
        setError(data.error || 'Erreur');
      }
    } catch {
      setError('Erreur de connexion');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!needsSetup) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Installation de Wooznext</h1>
          <p className="mt-2 text-sm text-gray-600">
            Creez votre compte administrateur et votre premier service.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2 mb-3">
              Premier service
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={form.serviceName}
                onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                placeholder="Nom du service (ex: Accueil)"
                required
                className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
              <input
                type="text"
                value={form.servicePrefix}
                onChange={(e) => setForm({ ...form, servicePrefix: e.target.value })}
                placeholder="Prefixe"
                maxLength={5}
                className="h-10 w-20 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2 mb-3">
              Compte administrateur
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Prenom"
                  required
                  className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Nom"
                  required
                  className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                required
                className="h-10 block w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mot de passe (min 12 car., 1 majuscule, 1 chiffre, 1 special)"
                required
                className="h-10 block w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Confirmer le mot de passe"
                required
                className="h-10 block w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-primary-500 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? 'Creation...' : 'Installer'}
          </button>
        </form>
      </div>
    </div>
  );
}
