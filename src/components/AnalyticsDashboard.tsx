import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Colores para segmentos RFM (usados en gráficos y badges)
const RFM_COLORS: Record<string, string> = {
  'Campeones': '#22c55e',
  'Leales': '#22d3ee',
  'En Riesgo': '#f97316',
  'Perdidos': '#ef4444',
  'Nuevo Cliente': '#a78bfa',
  'Sin Segmentar': '#475569',
};

const SEGMENT_COLORS: Record<string, string> = {
  'Campeones': '#22c55e',
  'Leales': '#22d3ee',
  'Riesgo': '#f97316',
  'Perdidos': '#ef4444',
  'Todos': '#f97316',
};

const ANIMALES = [
  { label: '🐶 Perro', val: 'Perro' },
  { label: '🐱 Gato', val: 'Gato' },
  { label: '🐹 Hamster', val: 'Hamster' },
  { label: '🐰 Conejo', val: 'Conejo' },
  { label: '🐟 Peces', val: 'Pez' },
  { label: '🦜 Ave', val: 'Ave' },
];

const SEGMENTOS = [
  { label: 'Campeones', val: 'Campeones' },
  { label: 'Leales', val: 'Leales' },
  { label: 'En riesgo', val: 'Riesgo' },
  { label: 'Perdidos', val: 'Perdidos' },
];

type Filters = { segmento: string; animal: string; clienteId: string };

function clp(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function segmentBadge(seg?: string) {
  if (!seg) return null;
  const s = seg.toLowerCase();
  if (s.includes('campeon')) return { label: 'Campeón', bg: '#052e16', color: '#22c55e' };
  if (s.includes('leal')) return { label: 'Leal', bg: '#083344', color: '#22d3ee' };
  if (s.includes('riesgo')) return { label: 'En riesgo', bg: '#431407', color: '#f97316' };
  if (s.includes('perdido')) return { label: 'Perdido', bg: '#3f0d0d', color: '#ef4444' };
  if (s.includes('nuevo')) return { label: 'Nuevo', bg: '#2e1065', color: '#a78bfa' };
  return { label: seg, bg: '#1e293b', color: '#94a3b8' };
}

function getFilterLabel(filters: Filters, listaClientes: { id: string; nombre: string }[]) {
  const parts: string[] = [];
  if (filters.segmento !== 'Todos') parts.push(filters.segmento);
  if (filters.animal !== 'Todos')
    parts.push(ANIMALES.find((a) => a.val === filters.animal)?.label || filters.animal);
  if (filters.clienteId !== 'Todos') {
    const c = listaClientes.find((c) => c.id === filters.clienteId);
    if (c) parts.push(c.nombre);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Todos los datos';
}

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState<Filters>({
    segmento: 'Todos',
    animal: 'Todos',
    clienteId: 'Todos',
  });
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

  // Obtener datos del backend según filtros
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
      console.error('Error dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Suscripción en tiempo real a nuevos inserts en ventas
  useEffect(() => {
    const canal = supabase
      .channel('crm-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, fetchData)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [fetchData]);

  // Gráfico de barras (Ventas por categoría)
  useEffect(() => {
    if (!barRef.current) return;
    const ctx = barRef.current.getContext('2d');
    if (!ctx) return;
    if (barChart.current) {
      barChart.current.destroy();
      barChart.current = null;
    }
    barChart.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: catData.map((c) => c.name),
        datasets: [
          {
            label: 'Transacciones',
            data: catData.map((c) => c.totalVentas),
            backgroundColor: '#f97316',
            borderRadius: 6,
            barPercentage: 0.5,
          },
          {
            label: 'Puntos prom.',
            data: catData.map((c) => c.promedioPuntos),
            backgroundColor: '#22d3ee',
            borderRadius: 6,
            barPercentage: 0.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1f2e',
            borderColor: '#ffffff15',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
            padding: 10,
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#475569',
              font: { size: 11, weight: 500 }, // ✅ Corregido: weight como número
              autoSkip: false,
              maxRotation: 30,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: {
              color: '#475569',
              font: { size: 11, weight: 500 },
            },
            grid: { color: '#ffffff08' },
            border: { display: false },
          },
        },
      },
    } as any);
  }, [catData]);

  // Gráfico de dona (Distribución RFM)
  useEffect(() => {
    if (!pieRef.current) return;
    const ctx = pieRef.current.getContext('2d');
    if (!ctx) return;
    if (pieChart.current) {
      pieChart.current.destroy();
      pieChart.current = null;
    }
    const labels = rfmData.map((r) => r.name);
    const values = rfmData.map((r) => r.count);
    const colors = labels.map((l) => RFM_COLORS[l] || '#475569');
    pieChart.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1f2e',
            borderColor: '#ffffff15',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
          },
        },
      },
    } as any);
  }, [rfmData]);

  useEffect(() => {
    return () => {
      barChart.current?.destroy();
      pieChart.current?.destroy();
    };
  }, []);

  const setFilter = (key: keyof Filters, val: string) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const resetFilters = () =>
    setFilters({ segmento: 'Todos', animal: 'Todos', clienteId: 'Todos' });

  const hasActiveFilters =
    filters.segmento !== 'Todos' || filters.animal !== 'Todos' || filters.clienteId !== 'Todos';

  const rfmTotal = rfmData.reduce((a, b) => a + b.count, 0);

  return (
    <div
      className="w-full rounded-2xl overflow-hidden font-sans"
      style={{ background: '#0f1117', border: '1px solid #ffffff10' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid #ffffff08' }}
      >
        <div>
          <p className="text-sm font-semibold text-white tracking-wide">
            LoyalData <span style={{ color: '#f97316' }}>CRM</span>
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
            MascotaShop · panel analítico
          </p>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span className="text-[11px]" style={{ color: '#475569' }}>
              {loading ? 'actualizando...' : 'en vivo'}
            </span>
          </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Consola de Filtros ── */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#1a1f2e', border: '1px solid #ffffff08' }}
        >
          {/* Título de la sección */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: '#334155' }}>
              Consola de Filtros
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all"
                style={{ background: '#f9731615', color: '#f97316', border: '1px solid #f9731630' }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {/* Grid de 3 selects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {/* Segmento RFM */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
                🎯 Segmento RFM
              </label>
              <div className="relative">
                <select
                  value={filters.segmento}
                  onChange={e => setFilter('segmento', e.target.value)}
                  className="w-full appearance-none text-xs font-medium rounded-xl px-3 py-2.5 pr-8 outline-none transition-all cursor-pointer"
                  style={{
                    background: filters.segmento !== 'Todos' ? '#f9731612' : '#0f1117',
                    border: filters.segmento !== 'Todos' ? '1px solid #f9731640' : '1px solid #ffffff10',
                    color: filters.segmento !== 'Todos' ? '#f97316' : '#64748b',
                  }}
                >
                  <option value="Todos" style={{ background: '#0f1117', color: '#94a3b8' }}>Todos los segmentos</option>
                  <option value="Campeones" style={{ background: '#0f1117', color: '#22c55e' }}>⭐ Campeones</option>
                  <option value="Leales" style={{ background: '#0f1117', color: '#22d3ee' }}>💎 Leales</option>
                  <option value="Riesgo" style={{ background: '#0f1117', color: '#f97316' }}>⚠️ En Riesgo</option>
                  <option value="Perdidos" style={{ background: '#0f1117', color: '#ef4444' }}>🔴 Perdidos</option>
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: '#334155' }}>▾</span>
              </div>
            </div>

            {/* Especie animal */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
                🐾 Especie Animal
              </label>
              <div className="relative">
                <select
                  value={filters.animal}
                  onChange={e => setFilter('animal', e.target.value)}
                  className="w-full appearance-none text-xs font-medium rounded-xl px-3 py-2.5 pr-8 outline-none transition-all cursor-pointer"
                  style={{
                    background: filters.animal !== 'Todos' ? '#f9731612' : '#0f1117',
                    border: filters.animal !== 'Todos' ? '1px solid #f9731640' : '1px solid #ffffff10',
                    color: filters.animal !== 'Todos' ? '#f97316' : '#64748b',
                  }}
                >
                  <option value="Todos" style={{ background: '#0f1117', color: '#94a3b8' }}>Todas las especies</option>
                  {ANIMALES.map(a => (
                    <option key={a.val} value={a.val} style={{ background: '#0f1117', color: '#e2e8f0' }}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: '#334155' }}>▾</span>
              </div>
            </div>

            {/* Cliente específico */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
                👤 Cliente
              </label>
              <div className="relative">
                <select
                  value={filters.clienteId}
                  onChange={e => setFilter('clienteId', e.target.value)}
                  className="w-full appearance-none text-xs font-medium rounded-xl px-3 py-2.5 pr-8 outline-none transition-all cursor-pointer"
                  style={{
                    background: filters.clienteId !== 'Todos' ? '#f9731612' : '#0f1117',
                    border: filters.clienteId !== 'Todos' ? '1px solid #f9731640' : '1px solid #ffffff10',
                    color: filters.clienteId !== 'Todos' ? '#f97316' : '#64748b',
                  }}
                >
                  <option value="Todos" style={{ background: '#0f1117', color: '#94a3b8' }}>👥 Todos los clientes</option>
                  {listaClientes.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#0f1117', color: '#e2e8f0' }}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: '#334155' }}>▾</span>
              </div>
            </div>
          </div>

          {/* Indicador de filtro activo */}
          {hasActiveFilters && (
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #ffffff06' }}>
              <span className="text-[10px]" style={{ color: '#334155' }}>Mostrando:</span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                style={{ background: '#f9731615', color: '#f97316', border: '1px solid #f9731625' }}
              >
                {getFilterLabel(filters, listaClientes)}
              </span>
              {loading && (
                <span className="text-[10px] flex items-center gap-1 ml-auto" style={{ color: '#334155' }}>
                  <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse inline-block" />
                  actualizando...
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Ingresos totales',
              value: clp(kpis.ingresos),
              sub: `${kpis.txCount} ventas`,
              accent: '#f97316',
              icon: '💰',
            },
            {
              label: 'Clientes',
              value: kpis.clientes.toString(),
              sub: 'en filtro actual',
              accent: '#22d3ee',
              icon: '👥',
            },
            {
              label: 'Cliente VIP',
              value: kpis.vip,
              sub: 'mayor puntaje',
              accent: '#a78bfa',
              small: true,
              icon: '⭐',
            },
            {
              label: 'Animal top',
              value: kpis.animal,
              sub: 'mayor volumen',
              accent: '#22c55e',
              small: true,
              icon: '🏆',
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl p-4"
              style={{ background: '#1a1f2e', border: '1px solid #ffffff08' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-1 h-4 rounded-full" style={{ background: k.accent }} />
                <span className="text-sm">{k.icon}</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
                {k.label}
              </p>
              {loading ? (
                <div className="h-6 rounded animate-pulse w-3/4" style={{ background: '#ffffff08' }} />
              ) : (
                <p
                  className={`font-mono font-semibold leading-tight ${k.small ? 'text-sm' : 'text-xl'}`}
                  style={{ color: '#e2e8f0' }}
                >
                  {k.value}
                </p>
              )}
              <p className="text-[10px] mt-1" style={{ color: '#334155' }}>
                {k.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ── Gráficos ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Barras */}
          <div
            className="md:col-span-2 rounded-xl p-4"
            style={{ background: '#1a1f2e', border: '1px solid #ffffff08' }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                Ventas por categoría de producto
              </p>
              <div className="flex gap-4 text-[10px]" style={{ color: '#475569' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#f97316' }} />
                  Transacciones
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#22d3ee' }} />
                  Puntos prom.
                </span>
              </div>
            </div>
            {loading ? (
              <div className="h-52 rounded-lg animate-pulse" style={{ background: '#ffffff06' }} />
            ) : (
              <div className="relative h-52">
                <canvas ref={barRef} />
              </div>
            )}
          </div>

          {/* Dona RFM */}
          <div
            className="rounded-xl p-4"
            style={{ background: '#1a1f2e', border: '1px solid #ffffff08' }}
          >
            <p className="text-xs font-medium mb-4" style={{ color: '#94a3b8' }}>
              Distribución RFM
            </p>
            {loading ? (
              <div className="h-32 rounded-full animate-pulse mx-auto w-32" style={{ background: '#ffffff06' }} />
            ) : (
              <div className="relative h-32">
                <canvas ref={pieRef} />
              </div>
            )}
            <div className="mt-4 space-y-2">
              {rfmData.map((r) => (
                <div key={r.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[11px]" style={{ color: '#64748b' }}>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: RFM_COLORS[r.name] || '#475569' }}
                    />
                    {r.name}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: '#94a3b8' }}>
                    {r.count}
                    <span className="ml-1" style={{ color: '#334155' }}>
                      ({rfmTotal > 0 ? Math.round((r.count / rfmTotal) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabla de transacciones ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#1a1f2e', border: '1px solid #ffffff08' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #ffffff06' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[.15em]" style={{ color: '#475569' }}>
              Monitor transaccional · últimas ventas
            </p>
            {hasActiveFilters && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-mono"
                style={{ background: '#f9731615', color: '#f97316' }}
              >
                filtrado
              </span>
            )}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid #ffffff06' }}>
                {['ID', 'Cliente', 'Fecha', 'Segmento', 'Monto'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 font-normal text-[10px] uppercase tracking-widest"
                    style={{ color: '#334155' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-3 rounded animate-pulse w-full" style={{ background: '#ffffff06' }} />
                    </td>
                  </tr>
                ))
              ) : txData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[11px]" style={{ color: '#334155' }}>
                    Sin transacciones en el filtro seleccionado
                  </td>
                </tr>
              ) : (
                txData.slice(0, 8).map((v: any) => {
                  const badge = segmentBadge(v.segmento_rfm);
                  const fecha = v.fecha_venta
                    ? new Date(v.fecha_venta).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';
                  return (
                    <tr
                      key={v.id_venta}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid #ffffff04' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff04')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3 font-mono" style={{ color: '#334155' }}>
                        #{v.id_venta}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: '#475569' }}>
                        {v.id_cliente ? v.id_cliente.slice(0, 8) + '…' : 'invitado'}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>
                        {fecha}
                      </td>
                      <td className="px-4 py-3">
                        {badge ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        ) : (
                          <span style={{ color: '#334155' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-right" style={{ color: '#22c55e' }}>
                        {clp(v.total_venta)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}