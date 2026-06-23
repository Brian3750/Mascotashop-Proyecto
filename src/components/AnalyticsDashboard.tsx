import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const RFM_COLORS: Record<string, string> = {
  'Campeones':    '#22c55e',
  'Leales':       '#3b82f6',
  'En Riesgo':    '#f97316',
  'Perdidos':     '#ef4444',
  'Nuevo Cliente':'#8b5cf6',
  'Sin Segmentar':'#94a3b8',
};

function clp(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function segmentBadge(seg?: string) {
  if (!seg) return null;
  const s = seg.toLowerCase();
  if (s.includes('campeon')) return { label: 'Campeón',  cls: 'bg-emerald-100 text-emerald-800' };
  if (s.includes('leal'))    return { label: 'Leal',     cls: 'bg-blue-100 text-blue-800' };
  if (s.includes('riesgo'))  return { label: 'En riesgo',cls: 'bg-orange-100 text-orange-800' };
  if (s.includes('perdido')) return { label: 'Perdido',  cls: 'bg-red-100 text-red-800' };
  if (s.includes('nuevo'))   return { label: 'Nuevo',    cls: 'bg-purple-100 text-purple-800' };
  return { label: seg, cls: 'bg-gray-100 text-gray-500' };
}

type Filters = { segmento: string; animal: string; clienteId: string };

const PILL_SEGMENTOS = [
  { label: 'Todos',      val: 'Todos' },
  { label: 'Campeones',  val: 'Campeones' },
  { label: 'Leales',     val: 'Leales' },
  { label: 'En riesgo',  val: 'Riesgo' },
  { label: 'Perdidos',   val: 'Perdidos' },
];

const PILL_ANIMALES = [
  { label: 'Todos',          val: 'Todos' },
  { label: 'Perros',         val: 'Perro' },
  { label: 'Gatos',          val: 'Gato' },
  { label: 'Aves & exóticos',val: 'Exotico' },
  { label: 'Farmacia vet.',  val: 'Farmacia' },
];

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState<Filters>({ segmento: 'Todos', animal: 'Todos', clienteId: 'Todos' });
  const [loading, setLoading] = useState(false);
  const [listaClientes, setListaClientes] = useState<{ id: string; nombre: string }[]>([]);

  const [kpis, setKpis] = useState({ ingresos: 0, clientes: 0, vip: '—', animal: '—', txCount: 0 });
  const [rfmData, setRfmData] = useState<{ name: string; count: number }[]>([]);
  const [catData, setCatData] = useState<{ name: string; totalVentas: number; promedioPuntos: number }[]>([]);
  const [txData, setTxData] = useState<any[]>([]);

  const barRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);
  const barChart = useRef<Chart | null>(null);
  const pieChart = useRef<Chart | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        clienteId: filters.clienteId,
        animal: filters.animal,
        segmento: filters.segmento,
      });
      const res = await fetch(`${API}/api/analitica/dashboard?${params}`);
      const data = await res.json();
      if (!data.success) return;

      setKpis({
        ingresos: data.totalIngresos || 0,
        clientes: data.totalClientes || 0,
        vip: data.topCliente || '—',
        animal: data.topAnimalEspecie || '—',
        txCount: (data.transaccionesRecientes || []).length,
      });
      if (data.listaClientes) setListaClientes(data.listaClientes);
      setRfmData(data.distribuciónRFM || []);
      setCatData(data.metricasCategorias || []);
      setTxData(data.transaccionesRecientes || []);
    } catch (e) {
      console.error('Error al cargar datos del dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const canal = supabase
      .channel('crm-ventas-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [fetchData]);

  useEffect(() => {
    if (!barRef.current) return;
    const ctx = barRef.current.getContext('2d');
    if (!ctx) return;

    if (barChart.current) { barChart.current.destroy(); barChart.current = null; }

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';

    barChart.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: catData.map(c => c.name),
        datasets: [
          { label: 'Transacciones', data: catData.map(c => c.totalVentas), backgroundColor: '#f97316', borderRadius: 5, barPercentage: .55 },
          { label: 'Puntos promedio', data: catData.map(c => c.promedioPuntos), backgroundColor: '#3b82f6', borderRadius: 5, barPercentage: .55 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 11 }, autoSkip: false, maxRotation: 35 }, grid: { display: false } },
          y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
        },
      },
    } as any);
  }, [catData]);

  useEffect(() => {
    if (!pieRef.current) return;
    const ctx = pieRef.current.getContext('2d');
    if (!ctx) return;

    if (pieChart.current) { pieChart.current.destroy(); pieChart.current = null; }

    const labels = rfmData.map(r => r.name);
    const values = rfmData.map(r => r.count);
    const colors = labels.map(l => RFM_COLORS[l] || '#94a3b8');

    pieChart.current = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
    } as any);
  }, [rfmData]);

  useEffect(() => {
    return () => { barChart.current?.destroy(); pieChart.current?.destroy(); };
  }, []);

  const setFilter = (key: keyof Filters, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  const rfmTotal = rfmData.reduce((a, b) => a + b.count, 0);

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden font-sans">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-medium text-gray-900">LoyalData CRM</p>
          <p className="text-xs text-gray-400 mt-0.5">MascotaShop — panel analítico</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          {loading ? 'actualizando...' : 'en vivo'}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Filtros ─────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">Filtros del panel</p>

          <div className="flex flex-wrap gap-6">
            {/* Segmento RFM */}
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Segmento RFM</p>
              <div className="flex flex-wrap gap-1.5">
                {PILL_SEGMENTOS.map(p => (
                  <button
                    key={p.val}
                    onClick={() => setFilter('segmento', p.val)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      filters.segmento === p.val
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Especie */}
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Especie animal</p>
              <div className="flex flex-wrap gap-1.5">
                {PILL_ANIMALES.map(p => (
                  <button
                    key={p.val}
                    onClick={() => setFilter('animal', p.val)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      filters.animal === p.val
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cliente */}
            <div className="space-y-2 min-w-[180px]">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide">Cliente</p>
              <select
                value={filters.clienteId}
                onChange={e => setFilter('clienteId', e.target.value)}
                className="text-xs w-full px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-none focus:border-orange-400"
              >
                <option value="Todos">Todos los clientes</option>
                {listaClientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* ── KPIs ────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Ingresos', value: clp(kpis.ingresos), sub: `${kpis.txCount} transacciones` },
            { label: 'Clientes', value: kpis.clientes.toString(), sub: 'en segmento' },
            { label: 'Cliente VIP', value: kpis.vip, sub: 'mayor puntaje', mono: false },
            { label: 'Animal top', value: kpis.animal, sub: 'mayor volumen', mono: false },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`font-medium text-gray-900 leading-tight truncate ${k.mono === false ? 'text-base' : 'text-xl font-mono'}`}>
                {loading ? <span className="inline-block h-5 w-20 bg-gray-200 rounded animate-pulse" /> : k.value}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Gráficos ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Barras */}
          <div className="md:col-span-2 bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">Ventas por categoría</p>
              <div className="flex gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-orange-500" />Transacciones</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-blue-500" />Puntos prom.</span>
              </div>
            </div>
            <div className="relative h-52">
              <canvas ref={barRef} role="img" aria-label="Barras: ventas y puntos por categoría" />
            </div>
          </div>

          {/* Dona RFM */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Distribución RFM</p>
            <div className="relative h-36">
              <canvas ref={pieRef} role="img" aria-label="Dona con distribución de segmentos RFM" />
            </div>
            <div className="mt-3 space-y-1.5">
              {rfmData.map(r => (
                <div key={r.name} className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: RFM_COLORS[r.name] || '#94a3b8' }} />
                    {r.name}
                  </span>
                  <span className="font-mono text-gray-700">
                    {r.count} <span className="text-gray-400">({rfmTotal > 0 ? Math.round(r.count / rfmTotal * 100) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Transacciones recientes ──────────────────── */}
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium mb-2">Transacciones recientes</p>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['ID', 'Cliente', 'Fecha', 'Segmento', 'Monto'].map(h => (
                    <th key={h} className="text-[11px] text-gray-400 uppercase tracking-wide font-normal text-left px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i}><td colSpan={5} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                    </td></tr>
                  ))
                ) : txData.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 text-gray-400">Sin transacciones en el filtro seleccionado</td></tr>
                ) : txData.slice(0, 8).map((v: any) => {
                  const badge = segmentBadge(v.segmento_rfm);
                  const fecha = v.fecha_venta ? new Date(v.fecha_venta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <tr key={v.id_venta} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-gray-400">#{v.id_venta}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-500">{v.id_cliente ? v.id_cliente.slice(0,8) + '…' : 'invitado'}</td>
                      <td className="px-3 py-2.5 text-gray-500">{fecha}</td>
                      <td className="px-3 py-2.5">
                        {badge ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span> : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-emerald-600 font-medium text-right">{clp(v.total_venta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}