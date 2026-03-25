'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  _count: { agents: number; counters: number };
}

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchServices(); }, []);

  async function fetchServices() {
    const res = await fetch('/api/admin/services');
    if (res.ok) {
      const data = await res.json();
      setServices(data.services);
    }
  }

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
            className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ${
              !s.isActive ? 'opacity-50' : ''
            }`}
          >
            <div>
              <span className="font-medium text-gray-900">{s.name}</span>
              {s.prefix && <span className="ml-2 text-xs text-gray-400">({s.prefix})</span>}
              <p className="text-xs text-gray-500">
                {s._count.agents} agent(s) - {s._count.counters} guichet(s)
              </p>
            </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
