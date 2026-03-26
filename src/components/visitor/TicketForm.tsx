'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!serviceId) {
      setError('Aucun service specifie. Veuillez scanner le QR code du service.');
      return;
    }

    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => {
        const service = data.services?.find((s: { id: string }) => s.id === serviceId);
        if (service) {
          setServiceName(service.name);
          setReady(true);
        } else {
          setError('Service introuvable.');
        }
      })
      .catch(() => setError('Impossible de charger les services'));
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, serviceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue');
        setLoading(false);
        return;
      }

      router.push(`/ticket/${data.ticket.id}`);
    } catch {
      setError('Erreur de connexion au serveur');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-6">
        {serviceName && (
          <div className="rounded-lg bg-primary-50 p-3 text-center text-sm font-medium text-primary-700">
            {serviceName}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {ready && (
          <>
            <div>
              <label htmlFor="phone" className="block text-left text-sm font-medium text-gray-700">
                Votre numero de telephone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                inputMode="tel"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-wider text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="06 12 34 56 78"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full rounded-xl bg-primary-500 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Prendre un ticket'}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
