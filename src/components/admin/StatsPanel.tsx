'use client';

import { useState, useEffect, useCallback } from 'react';

interface AgentStat {
  id: string;
  name: string;
  completed: number;
  noShow: number;
  avgServiceTimeSeconds: number;
}

interface Stats {
  totalToday: number;
  completedToday: number;
  noShowToday: number;
  waitingNow: number;
  servingNow: number;
  avgServiceTimeSeconds: number;
  perService: { id: string; name: string; total: number; completed: number; waiting: number }[];
  perAgent: AgentStat[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
}

type Period = 'today' | 'week' | 'month' | 'year';

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: string;

  switch (period) {
    case 'today':
      from = to;
      break;
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      from = d.toISOString().split('T')[0];
      break;
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      from = d.toISOString().split('T')[0];
      break;
    }
  }

  return { from, to };
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: '7 derniers jours',
  month: '30 derniers jours',
  year: '12 derniers mois',
};

export default function StatsPanel({ serviceScope }: { serviceScope?: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [resetting, setResetting] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceScope || '');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [period, setPeriod] = useState<Period>('today');

  const fetchStats = useCallback(async () => {
    const params = new URLSearchParams();
    const effectiveServiceId = serviceScope || selectedServiceId;
    if (effectiveServiceId) params.set('serviceId', effectiveServiceId);
    if (selectedAgentId) params.set('agentId', selectedAgentId);
    const { from, to } = getPeriodDates(period);
    params.set('from', from);
    params.set('to', to);
    const qs = params.toString();
    const res = await fetch(`/api/admin/stats${qs ? `?${qs}` : ''}`);
    if (res.ok) setStats(await res.json());
  }, [selectedServiceId, selectedAgentId, period]);

  useEffect(() => {
    async function loadFilters() {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/admin/agents'),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setServices(data.services || []);
      }
      if (aRes.ok) {
        const data = await aRes.json();
        setAgents((data.agents || []).map((a: { id: string; firstName: string; lastName: string }) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })));
      }
    }
    loadFilters();
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  async function handleReset() {
    if (!confirm('Reinitialiser toute la file ? Tous les tickets en attente seront annules.')) return;
    setResetting(true);
    await fetch('/api/admin/reset', { method: 'POST' });
    await fetchStats();
    setResetting(false);
  }

  function formatTime(seconds: number) {
    if (seconds === 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  }

  if (!stats) return <p className="py-8 text-center text-gray-400">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Tous les agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card label="Tickets" value={stats.totalToday} />
        <Card label="Termines" value={stats.completedToday} color="text-green-600" />
        <Card label="Absents" value={stats.noShowToday} color="text-red-500" />
        <Card label="En attente" value={stats.waitingNow} color="text-orange-500" />
        <Card label="En service" value={stats.servingNow} color="text-primary-500" />
        <Card label="Temps moyen" value={formatTime(stats.avgServiceTimeSeconds)} />
      </div>

      {/* Per service */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Par service</h3>
        <div className="space-y-2">
          {stats.perService.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className="font-medium text-gray-900">{s.name}</span>
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{s.total} total</span>
                <span className="text-green-600">{s.completed} termines</span>
                <span className="text-orange-500">{s.waiting} en attente</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per agent */}
      {stats.perAgent && stats.perAgent.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Par agent</h3>
          <div className="space-y-2">
            {stats.perAgent.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                <span className="font-medium text-gray-900">{a.name}</span>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span className="text-green-600">{a.completed} termines</span>
                  <span className="text-red-500">{a.noShow} absents</span>
                  <span>{formatTime(a.avgServiceTimeSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={handleReset}
        disabled={resetting}
        className="w-full rounded-xl border border-red-300 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
      >
        {resetting ? 'Reinitialisation...' : 'Reinitialiser la file'}
      </button>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
