'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT', serviceId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', role: 'AGENT', serviceId: '', password: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

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
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT', serviceId: '' });
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

  async function handleDelete(id: string) {
    setDeleteError(null);
    const res = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeleteConfirm(null);
      await fetchAgents();
    } else {
      const data = await res.json();
      setDeleteError(data.error || 'Erreur lors de la suppression.');
    }
  }

  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setEditForm({
      firstName: agent.firstName,
      lastName: agent.lastName,
      email: agent.email,
      role: agent.role,
      serviceId: agent.serviceId || '',
      password: '',
    });
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError('');
    setEditLoading(true);

    const payload: Record<string, unknown> = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      role: editForm.role,
      serviceId: editForm.serviceId || null,
    };
    if (editForm.password) {
      payload.password = editForm.password;
    }

    const res = await fetch(`/api/admin/agents/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditingId(null);
      await fetchAgents();
    } else {
      const data = await res.json();
      setEditError(data.error || 'Erreur');
    }
    setEditLoading(false);
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
          <div className="flex gap-3">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Prenom"
              required
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Nom"
              required
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
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
          <div key={a.id}>
            <div
              className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ${
                !a.isActive ? 'opacity-50' : ''
              } ${editingId === a.id ? 'rounded-b-none' : ''}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{a.firstName} {a.lastName}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    a.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {a.role}
                  </span>
                  {a.service && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {a.service.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{a.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => editingId === a.id ? cancelEdit() : startEdit(a)}
                  className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {editingId === a.id ? 'Fermer' : 'Modifier'}
                </button>
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
                {deleteConfirm === a.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setDeleteConfirm(a.id); setDeleteError(null); }}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              {deleteError && deleteConfirm === a.id && (
                <p className="mt-2 text-xs font-medium text-red-600">{deleteError}</p>
              )}
            </div>

            {/* Inline edit form */}
            {editingId === a.id && (
              <form
                onSubmit={handleEdit}
                className="space-y-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-4"
              >
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    placeholder="Prenom"
                    required
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    placeholder="Nom"
                    required
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="Email"
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <div className="flex gap-3">
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="AGENT">Agent</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <select
                    value={editForm.serviceId}
                    onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
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
                    onClick={cancelEdit}
                    className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
