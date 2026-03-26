'use client';

import { useState } from 'react';

interface CreatedTicket {
  displayCode: string;
  isExisting: boolean;
}

interface AddTicketModalProps {
  visible: boolean;
  serviceId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddTicketModal({
  visible,
  serviceId,
  onClose,
  onCreated,
}: AddTicketModalProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);

  if (!visible) return null;

  function handleClose() {
    setPhone('');
    setError('');
    setCreatedTicket(null);
    if (createdTicket) {
      onCreated();
    }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) return;

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
        setError(data.error || 'Erreur');
        setLoading(false);
        return;
      }

      setPhone('');
      setLoading(false);
      setCreatedTicket({
        displayCode: data.ticket?.displayCode ?? data.displayCode ?? '---',
        isExisting: !!data.isExisting,
      });
    } catch {
      setError('Erreur de connexion');
      setLoading(false);
    }
  }

  // Success view after ticket creation
  if (createdTicket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-green-50 p-6">
              <span className="text-4xl font-black text-gray-900">
                {createdTicket.displayCode}
              </span>
            </div>

            <p className="text-lg font-semibold text-green-600">
              Ticket cree avec succes
            </p>

            {createdTicket.isExisting && (
              <p className="text-sm text-orange-600">
                Ce numero a deja un ticket actif
              </p>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-600"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Ajouter un visiteur</h3>
        <p className="mt-1 text-sm text-gray-500">
          Creer un ticket manuellement (sans QR code)
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            inputMode="tel"
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-wider text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="06 12 34 56 78"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !phone}
              className="flex-1 rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
