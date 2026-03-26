'use client';

import { useState, useEffect, useCallback } from 'react';

interface Service {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  _count: { agents: number; counters: number };
}

interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    openTime: '08:30',
    closeTime: '17:00',
    isClosed: i >= 5, // Samedi et Dimanche fermes par defaut
  }));
}

function OpeningHoursEditor({ serviceId }: { serviceId: string }) {
  const [hours, setHours] = useState<DayHours[]>(defaultHours());
  const [saving, setSaving] = useState(false);
  const [loadingHours, setLoadingHours] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadHours() {
      setLoadingHours(true);
      try {
        const res = await fetch(`/api/admin/services/${serviceId}/hours`);
        if (res.ok) {
          const data = await res.json();
          if (data.hours && data.hours.length === 7) {
            setHours(data.hours);
          }
        }
      } catch {
        // Use defaults on error
      }
      setLoadingHours(false);
    }
    loadHours();
  }, [serviceId]);

  function updateDay(dayOfWeek: number, field: keyof DayHours, value: string | boolean) {
    setHours((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Horaires enregistres.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la sauvegarde.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur reseau.' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  if (loadingHours) {
    return <p className="py-3 text-center text-xs text-gray-400">Chargement des horaires...</p>;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      {hours.map((day) => (
        <div key={day.dayOfWeek} className="flex items-center gap-3 text-sm">
          <span className="w-20 font-medium text-gray-700">{DAY_NAMES[day.dayOfWeek]}</span>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={day.isClosed}
              onChange={(e) => updateDay(day.dayOfWeek, 'isClosed', e.target.checked)}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            Ferme
          </label>
          {!day.isClosed && (
            <>
              <input
                type="time"
                value={day.openTime}
                onChange={(e) => updateDay(day.dayOfWeek, 'openTime', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              />
              <span className="text-xs text-gray-400">-</span>
              <input
                type="time"
                value={day.closeTime}
                onChange={(e) => updateDay(day.dayOfWeek, 'closeTime', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              />
            </>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les horaires'}
        </button>
        {message && (
          <span
            className={`text-xs font-medium ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedHours, setExpandedHours] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/admin/services');
    if (res.ok) {
      const data = await res.json();
      setServices(data.services);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prefix }),
    });
    if (res.ok) {
      setName('');
      setPrefix('');
      await fetchServices();
    }
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await fetchServices();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setDeleteConfirm(null);
      await fetchServices();
    } else {
      const data = await res.json();
      setDeleteError(data.error || 'Erreur lors de la suppression.');
    }
  }

  function toggleHours(id: string) {
    setExpandedHours((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du service"
          required
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Prefixe"
          maxLength={5}
          className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {services.map((s) => (
          <div
            key={s.id}
            className={`rounded-xl bg-white p-4 shadow-sm ${!s.isActive ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">{s.name}</span>
                {s.prefix && <span className="ml-2 text-xs text-gray-400">({s.prefix})</span>}
                <p className="text-xs text-gray-500">
                  {s._count.agents} agent(s) - {s._count.counters} guichet(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleHours(s.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    expandedHours === s.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Horaires
                </button>
                <button
                  onClick={() => toggleActive(s.id, s.isActive)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    s.isActive
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {s.isActive ? 'Desactiver' : 'Activer'}
                </button>
                {deleteConfirm === s.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirm(null);
                        setDeleteError(null);
                      }}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setDeleteConfirm(s.id);
                      setDeleteError(null);
                    }}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>

            {/* Delete error message */}
            {deleteError && deleteConfirm === s.id && (
              <p className="mt-2 text-xs font-medium text-red-600">{deleteError}</p>
            )}

            {/* Opening hours editor */}
            {expandedHours === s.id && <OpeningHoursEditor serviceId={s.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
