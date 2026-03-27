'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function isServiceOpen(hours: DayHours[]): { open: boolean; hours: DayHours[] } {
  if (!hours || hours.length === 0) return { open: true, hours: [] };

  const now = new Date();
  // JS: 0=Sunday, convert to our format 0=Monday
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const todayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!todayHours || todayHours.isClosed) return { open: false, hours };

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;
  if (currentTime < todayHours.openTime || currentTime >= todayHours.closeTime) {
    return { open: false, hours };
  }

  return { open: true, hours };
}

export default function TicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [openingHours, setOpeningHours] = useState<DayHours[]>([]);

  useEffect(() => {
    fetch('/api/logo').then((res) => {
      if (res.ok) setLogoUrl('/api/logo');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!serviceId) {
      setError('Aucun service specifie. Veuillez scanner le QR code du service.');
      return;
    }

    async function loadService() {
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        const service = data.services?.find((s: { id: string }) => s.id === serviceId);
        if (!service) {
          setError('Service introuvable.');
          return;
        }

        // Check opening hours
        const hoursRes = await fetch(`/api/services/${serviceId}/hours`);
        if (hoursRes.ok) {
          const hoursData = await hoursRes.json();
          if (hoursData.hours && hoursData.hours.length > 0) {
            const result = isServiceOpen(hoursData.hours);
            if (!result.open) {
              setClosed(true);
              setOpeningHours(result.hours);
              return;
            }
          }
        }

        setReady(true);
      } catch {
        setError('Impossible de charger les services');
      }
    }
    loadService();
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
    <div className="space-y-6">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo" className="mx-auto h-14 w-auto object-contain" />
      )}
      <h1 className="text-3xl font-bold text-gray-900">Bienvenue</h1>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="space-y-6">
          {error && (
          <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {closed && (
          <div className="space-y-4">
            <div className="rounded-lg bg-orange-50 p-4 text-center">
              <p className="text-base font-semibold text-orange-800">
                Le service est actuellement ferme
              </p>
              <p className="mt-1 text-sm text-orange-600">
                Veuillez revenir pendant les horaires d&apos;ouverture.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Horaires d&apos;ouverture
              </h3>
              <div className="space-y-1.5">
                {openingHours.map((day) => (
                  <div key={day.dayOfWeek} className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{DAY_NAMES[day.dayOfWeek]}</span>
                    <span className={day.isClosed ? 'text-red-500' : 'text-gray-600'}>
                      {day.isClosed ? 'Ferme' : `${day.openTime} - ${day.closeTime}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {ready && (
          <>
            <div>
              <label htmlFor="phone" className="block text-left text-sm font-medium text-gray-700">
                Saisissez votre numero pour obtenir un ticket
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
    </div>
  );
}
