'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  serviceId: string | null;
  service: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  prefix: string;
}

export default function AgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT', serviceId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAgents();
    fetchServices();
  }, []);

  async function fetchAgents() {
    const res = await fetch('/api/admin/agents');
    if (res.ok) setAgents((await res.json()).agents);
  }

  async function fetchServices() {
    const res = await fetch('/api/services');
    if (res.ok) setServices((await res.json()).services);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        serviceId: form.serviceId || null,
      }),
    });

    if (res.ok) {
      setForm({ name: '', email: '', password: '', role: 'AGENT', serviceId: '' });
      setShowForm(false);
      await fetchAgents();
    } else {
      const data = await res.json();
      setError(data.error || 'Erreur');
    }
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await fetchAgents();
  }

  return (
    <div className="space-y-6">
      {/* Toggle form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
        >
          Creer un agent
        </button>
      ) : (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nom"
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mot de passe (min 6 car.)"
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Aucun service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); }}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      )}

      {/* Agent list */}
      <div className="space-y-2">
        {agents.map((a) => (
          <div
            key={a.id}
            className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ${
              !a.isActive ? 'opacity-50' : ''
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  a.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {a.role}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {a.email} {a.service ? `- ${a.service.name}` : ''}
              </p>
            </div>
            <button
              onClick={() => toggleActive(a.id, a.isActive)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                a.isActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {a.isActive ? 'Desactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
