'use client';

import { useState, useEffect, useCallback } from 'react';

interface AgentStat {
  id: string;
  name: string;
  completed: number;
  noShow: number;
  avgServiceTimeSeconds: number;
}

interface ChartItem {
  label: string;
  total: number;
  completed: number;
  noShow: number;
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
  chartByHour: ChartItem[];
  chartByDayOfWeek: ChartItem[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  isActive: boolean;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

const DAY_JS: Record<number, string> = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };

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
    case 'custom':
      from = to;
      break;
  }

  return { from, to };
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: '7 jours',
  month: '30 jours',
  year: '12 mois',
  custom: 'Perso.',
};

export default function StatsPanel({ serviceScope }: { serviceScope?: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceScope || '');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  const fetchStats = useCallback(async () => {
    const params = new URLSearchParams();
    const effectiveServiceId = serviceScope || selectedServiceId;
    if (effectiveServiceId) params.set('serviceId', effectiveServiceId);
    if (selectedAgentId) params.set('agentId', selectedAgentId);
    if (period === 'custom' && customFrom && customTo) {
      params.set('from', customFrom);
      params.set('to', customTo);
    } else {
      const { from, to } = getPeriodDates(period);
      params.set('from', from);
      params.set('to', to);
    }
    if (selectedDay) params.set('dayOfWeek', selectedDay);
    const qs = params.toString();
    const res = await fetch(`/api/admin/stats${qs ? `?${qs}` : ''}`);
    if (res.ok) setStats(await res.json());
  }, [selectedServiceId, selectedAgentId, period, customFrom, customTo, selectedDay, serviceScope]);

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
        setAgents((data.agents || []).map((a: { id: string; firstName: string; lastName: string; isActive: boolean }) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`, isActive: a.isActive })));
      }
    }
    loadFilters();
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  function formatTime(seconds: number) {
    if (seconds === 0) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  }

  const isPeriod = period !== 'today';

  async function exportPDF() {
    const params = new URLSearchParams();
    const effectiveServiceId = serviceScope || selectedServiceId;
    if (effectiveServiceId) params.set('serviceId', effectiveServiceId);
    if (selectedAgentId) params.set('agentId', selectedAgentId);
    if (period === 'custom' && customFrom && customTo) {
      params.set('from', customFrom);
      params.set('to', customTo);
    } else {
      const { from, to } = getPeriodDates(period);
      params.set('from', from);
      params.set('to', to);
    }
    params.set('period', period);
    const qs = params.toString();
    const res = await fetch(`/api/admin/stats/export${qs ? `?${qs}` : ''}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-${period}-${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    if (!stats) return;
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();

    function addSheet(name: string, rows: (string | number)[][]) {
      const ws = wb.addWorksheet(name);
      for (const row of rows) {
        const r = ws.addRow(row);
        if (r.number === 1) {
          r.eachCell((cell) => {
            cell.font = { bold: true };
          });
        }
      }
    }

    addSheet('Resume', [
      ['Indicateur', 'Valeur'],
      ['Tickets', stats.totalToday],
      ['Termines', stats.completedToday],
      ['Absents', stats.noShowToday],
      ['En attente', stats.waitingNow],
      ['En service', stats.servingNow],
      ['Temps moyen (s)', stats.avgServiceTimeSeconds],
    ]);

    if (stats.perService.length > 0) {
      addSheet('Par service', [
        ['Service', 'Total', 'Termines', 'En attente'],
        ...stats.perService.map((s) => [s.name, s.total, s.completed, s.waiting]),
      ]);
    }

    if (stats.perAgent.length > 0) {
      addSheet('Par agent', [
        ['Agent', 'Termines', 'Absents', 'Temps moyen (s)'],
        ...stats.perAgent.map((a) => [a.name, a.completed, a.noShow, a.avgServiceTimeSeconds]),
      ]);
    }

    if (stats.chartByHour.length > 0) {
      addSheet('Par heure', [
        ['Horaire', 'Total', 'Termines', 'Absents'],
        ...stats.chartByHour.map((h) => [h.label, h.total, h.completed, h.noShow]),
      ]);
    }

    if (stats.chartByDayOfWeek.length > 0) {
      addSheet('Par jour', [
        ['Jour', 'Total', 'Termines', 'Absents'],
        ...stats.chartByDayOfWeek.map((d) => [d.label, d.total, d.completed, d.noShow]),
      ]);
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-${period}-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!stats) return <p className="py-8 text-center text-gray-400">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); if (p === 'today') setSelectedDay(''); }}
            className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex gap-3">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {!serviceScope && (
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="">Tous les services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="">Tous les agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}{!a.isActive ? ' (archive)' : ''}</option>
          ))}
        </select>
        {isPeriod && (
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="">Tous les jours</option>
            {Object.entries(DAY_JS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={exportPDF}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Exporter PDF
        </button>
        <button
          onClick={exportExcel}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          Exporter Excel
        </button>
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

      {/* Charts */}
      {stats.chartByHour && stats.chartByHour.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            {selectedDay && isPeriod
              ? `Visites par heure — ${DAY_JS[parseInt(selectedDay)] ?? ''}`
              : isPeriod
                ? 'Visites par horaire (toute la periode)'
                : 'Visites par heure'}
          </h3>
          <BarChart data={stats.chartByHour} />
        </div>
      )}

      {stats.chartByDayOfWeek && stats.chartByDayOfWeek.length > 0 && !selectedDay && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Visites par jour de la semaine</h3>
          <BarChart data={stats.chartByDayOfWeek} />
        </div>
      )}

    </div>
  );
}

function BarChart({ data }: { data: ChartItem[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: ChartItem } | null>(null);
  const CHART_H = 160;

  const nonEmpty = data.filter((d) => d.total > 0);
  const hasData = nonEmpty.length > 0;
  const rawMax = hasData ? Math.max(...nonEmpty.map((d) => d.total)) : 1;
  const yMax = rawMax;
  const ySteps = 4;
  const yLines = Array.from({ length: ySteps + 1 }, (_, i) => Math.round((yMax / ySteps) * i));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex">
        <div className="flex flex-col justify-between pr-2 text-right" style={{ height: '160px' }}>
          {yLines.slice().reverse().map((v, i) => (
            <span key={i} className="text-[9px] text-gray-300">{v}</span>
          ))}
        </div>
        <div className="relative flex-1 flex items-end gap-1" style={{ height: '160px' }}>
          {yLines.length > 0 && (
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {Array.from({ length: ySteps + 1 }).map((_, i) => (
                <div key={i} className="border-b border-gray-100" />
              ))}
            </div>
          )}
          {data.map((d) => {
            const barH = d.total > 0 ? Math.max((d.total / yMax) * CHART_H, 4) : 0;
            const completedH = d.total > 0 ? (d.completed / d.total) * barH : 0;
            const noShowH = d.total > 0 ? (d.noShow / d.total) * barH : 0;
            const baseH = barH - completedH - noShowH;
            return (
              <div
                key={d.label}
                className="relative flex flex-1 flex-col items-center justify-end cursor-pointer z-[1]"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parent = e.currentTarget.parentElement?.getBoundingClientRect();
                  setTooltip({
                    x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                    y: rect.top - (parent?.top ?? 0) - 8,
                    item: d,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <span className="text-[10px] font-semibold text-gray-600">{d.total || ''}</span>
                {d.total > 0 ? (
                  <div className="relative w-full rounded-t" style={{ height: `${barH}px`, backgroundColor: '#e6f4ed' }}>
                    <div className="absolute bottom-0 w-full rounded-t" style={{ height: `${completedH}px`, backgroundColor: '#006e46' }} />
                    <div className="absolute top-0 w-full rounded-t" style={{ height: `${noShowH}px`, backgroundColor: '#ef4444' }} />
                  </div>
                ) : (
                  <div className="w-full" style={{ height: '2px' }} />
                )}
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{d.label}</span>
              </div>
            );
          })}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
            >
              <p className="font-semibold mb-1">{tooltip.item.label}</p>
              <p>Tickets : {tooltip.item.total}</p>
              <p className="text-green-400">Termines : {tooltip.item.completed}</p>
              <p className="text-red-400">Absents : {tooltip.item.noShow}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: '#006e46' }} /> Termines</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: '#e6f4ed' }} /> Total</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: '#ef4444' }} /> Absents</span>
      </div>
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
