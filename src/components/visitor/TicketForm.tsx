'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  openTimePm: string | null;
  closeTimePm: string | null;
  isClosed: boolean;
  isClosedPm: boolean;
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function isServiceOpen(hours: DayHours[]): { open: boolean; hours: DayHours[] } {
  if (!hours || hours.length === 0) return { open: true, hours: [] };

  const now = new Date();
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const todayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!todayHours || todayHours.isClosed) return { open: false, hours };

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;

  const inMorning = currentTime >= todayHours.openTime && currentTime < todayHours.closeTime;
  if (inMorning) return { open: true, hours };

  if (todayHours.openTimePm && todayHours.closeTimePm && !todayHours.isClosedPm) {
    const inAfternoon = currentTime >= todayHours.openTimePm && currentTime < todayHours.closeTimePm;
    if (inAfternoon) return { open: true, hours };
  }

  return { open: false, hours };
}

export default function TicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceValid, setServiceValid] = useState(false);
  const [serviceChecked, setServiceChecked] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [openingHours, setOpeningHours] = useState<DayHours[]>([]);

  useEffect(() => {
    fetch('/api/logo').then((res) => {
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        setLogoUrl('/api/logo');
      }
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

        setServiceValid(true);
        setServiceChecked(true);
      } catch {
        setError('Impossible de charger les services');
        setServiceChecked(true);
      }
    }
    loadService();
  }, [serviceId]);

  function validatePhone(p: string): string | null {
    if (p.length === 0) return null;
    if (p.length < 10) return 'Le numero doit contenir 10 chiffres';
    if (!/^0[67]/.test(p)) return 'Le numero doit commencer par 06 ou 07';
    if (!/^0[67][0-9]{8}$/.test(p)) return 'Numero de telephone invalide';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validatePhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!phone) return;

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

  const canShowForm = !!serviceId && !closed;
  const isReady = closed || (serviceChecked && serviceValid);

  if (!isReady && !error) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="mx-auto h-14 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}

      {closed ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Bienvenue</h1>
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
                        {day.isClosed ? 'Ferme' : (
                          <>
                            {day.openTime}-{day.closeTime}
                            {day.openTimePm && day.closeTimePm && !day.isClosedPm && (
                              <> / {day.openTimePm}-{day.closeTimePm}</>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Bienvenue</h1>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                {error}
              </div>
            )}

            {canShowForm && (
              <>
                <div>
                  <label htmlFor="phone" className="block text-left text-sm font-medium text-gray-700">
                    Saisissez votre numero pour obtenir un ticket
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                      setPhone(raw);
                      if (error) setError('');
                    }}
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-wider text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0612345678"
                  />
                  <p className="mt-2 text-xs italic text-gray-400">
                    Votre numero de telephone n&apos;est pas conserve apres votre visite.
                  </p>
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
      )}
    </div>
  );
}
