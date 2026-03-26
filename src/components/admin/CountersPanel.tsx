'use client';

import { useState, useEffect, useCallback } from 'react';

interface Service {
  id: string;
  name: string;
  prefix: string;
}

interface Counter {
  id: string;
  label: string;
  isActive: boolean;
  serviceId: string;
  agentId: string | null;
  currentTicketId: string | null;
  agent: { id: string; name: string } | null;
  currentTicket: { id: string; displayCode: string } | null;
}

export default function CountersPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchCounters = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setCounters([]);
      return;
    }
    const res = await fetch(`/api/admin/counters?serviceId=${serviceId}`);
    if (res.ok) {
      const data = await res.json();
      setCounters(data.counters);
    }
  }, []);

  useEffect(() => {
    fetchCounters(selectedServiceId);
  }, [selectedServiceId, fetchCounters]);

  async function fetchServices() {
    const res = await fetch('/api/services');
    if (res.ok) {
      const data = await res.json();
      setServices(data.services);
      if (data.services.length > 0 && !selectedServiceId) {
        setSelectedServiceId(data.services[0].id);
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedServiceId) return;
    setLoading(true);
    const label = newLabel.trim() || `Guichet ${counters.length + 1}`;
    const res = await fetch('/api/admin/counters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, serviceId: selectedServiceId }),
    });
    if (res.ok) {
      setNewLabel('');
      await fetchCounters(selectedServiceId);
    }
    setLoading(false);
  }

  async function handleRename(id: string) {
    if (!editingLabel.trim()) return;
    const res = await fetch(`/api/admin/counters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editingLabel.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditingLabel('');
      await fetchCounters(selectedServiceId);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/counters/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setDeleteConfirmId(null);
      await fetchCounters(selectedServiceId);
    } else {
      const data = await res.json();
      alert(data.error || 'Impossible de supprimer ce guichet.');
      setDeleteConfirmId(null);
    }
  }

  function startEditing(counter: Counter) {
    setEditingId(counter.id);
    setEditingLabel(counter.label);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingLabel('');
  }

  return (
    <div className="space-y-6">
      {/* Service selector */}
      <div>
        <label htmlFor="service-select" className="block text-sm font-medium text-gray-700 mb-1">
          Service
        </label>
        <select
          id="service-select"
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          {services.length === 0 && (
            <option value="">Aucun service disponible</option>
          )}
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.prefix ? ` (${s.prefix})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {selectedServiceId && (
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={`Guichet ${counters.length + 1}`}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>
      )}

      {/* Counter list */}
      <div className="space-y-2">
        {counters.length === 0 && selectedServiceId && (
          <p className="text-sm text-gray-500">Aucun guichet pour ce service.</p>
        )}
        {counters.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              {editingId === c.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(c.id);
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    autoFocus
                    className="rounded-lg border border-primary-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleRename(c.id)}
                    className="rounded-lg bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600"
                  >
                    OK
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div>
                  <span
                    className="font-medium text-gray-900 cursor-pointer hover:text-primary-600"
                    onClick={() => startEditing(c)}
                    title="Cliquer pour renommer"
                  >
                    {c.label}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.agent ? (
                      <span>
                        Agent : <span className="font-medium text-gray-700">{c.agent.name}</span>
                      </span>
                    ) : (
                      <span className="text-green-500 font-medium">Libre</span>
                    )}
                    {c.currentTicket && (
                      <span className="ml-2">
                        -- Ticket en cours : <span className="font-medium">{c.currentTicket.displayCode}</span>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {editingId !== c.id && (
              <div className="flex items-center gap-2 ml-3">
                <button
                  onClick={() => startEditing(c)}
                  className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Renommer
                </button>
                {deleteConfirmId === c.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(c.id)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
