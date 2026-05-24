import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { TrendingUp, Users, MousePointer2, DollarSign, Target, Activity } from 'lucide-react';

const COLORS_FINTECH = {
  vistas: '#3b82f6',
  ventas: '#10b981',
};

// Data estática de control para el cruce (A la espera de la integración completa de pipelines NoSQL/SQL)
const dataComparativaMock = [
  { name: 'Alimento Perro', vistas: 450, ventas: 120 },
  { name: 'Arena Gato', vistas: 380, ventas: 210 },
  { name: 'Juguete Cordel', vistas: 590, ventas: 85 },
  { name: 'Snacks Premium', vistas: 220, ventas: 190 },
  { name: 'Camas Ortho', vistas: 150, ventas: 30 },
];

export default function AnalyticsDashboard() {
  const [totalPuntos, setTotalPuntos] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [segmentosRfm, setSegmentosRfm] = useState<any[]>([]);
  const [ventasEnTiempoReal, setVentasEnTiempoReal] = useState<any[]>([]);

  // Función única centralizada de recarga analítica segura (Evita bloqueos de RLS)
  const cargarDataDashboard = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/analitica/dashboard');
      const data = await res.json();
      if (data.success) {
        setTotalIngresos(data.totalIngresos);
        setTotalClientes(data.totalClientes);
        setTotalPuntos(data.totalPuntos);
        setSegmentosRfm(data.distribuciónRFM);
        setVentasEnTiempoReal(data.transaccionesRecientes);
      }
    } catch (err) {
      console.error("Error al cargar la API analítica:", err);
    }
  };

  useEffect(() => {
    cargarDataDashboard();

    // CANAL EN TIEMPO REAL: Escucha cambios en ventas e invoca la recarga analítica del servidor
    console.log("⚡ Activando pasarela Realtime de Supabase para el CRM...");
    const canalVentas = supabase
      .channel('cambios-ventas-mascotashop')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ventas' },
        () => {
          console.log("🔥 ¡NUEVA VENTA DETECTADA! Recalculando analíticas desde el origen de datos seguro...");
          cargarDataDashboard(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalVentas);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 p-8 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">LoyalData Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">Inteligencia de Negocio en Tiempo Real</p>
          </div>
          <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Estado del Sistema</span>
            <span className="text-emerald-400 flex items-center gap-2 text-sm font-medium">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Sincronizado con Supabase SQL
            </span>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Ingresos Totales (Live)" 
            value={`$${totalIngresos.toLocaleString('es-CL')}`} 
            icon={<DollarSign size={20} />} 
            trend="Live"
            color="emerald"
          />
          <StatCard 
            title="Interacciones NoSQL" 
            value="8,432" 
            icon={<MousePointer2 size={20} />} 
            trend="Mongo"
            color="blue"
          />
          <StatCard 
            title="Fidelidad (Puntos Real)" 
            value={totalPuntos.toLocaleString()} 
            icon={<Target size={20} />} 
            trend="Actualizado"
            color="orange"
          />
          <StatCard 
            title="Clientes Activos" 
            value={totalClientes.toString()} 
            icon={<Users size={20} />} 
            trend="Total DB"
            color="purple"
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} />
              Interés vs. Conversión (Cruce SQL/NoSQL)
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={dataComparativaMock}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  <Bar dataKey="vistas" fill={COLORS_FINTECH.vistas} radius={[6, 6, 0, 0]} name="Vistas (MongoDB)" barSize={24} />
                  <Bar dataKey="ventas" fill={COLORS_FINTECH.ventas} radius={[6, 6, 0, 0]} name="Ventas (WebPay)" barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución RFM Real</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={segmentosRfm}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {segmentosRfm.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {segmentosRfm.map((seg) => (
                <div key={seg.name} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-600">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: seg.color}} />
                    {seg.name}
                  </span>
                  <span className="font-bold text-slate-800">{seg.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monitor Transaccional */}
        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="text-emerald-500 animate-pulse" size={20} />
            Monitor Transaccional Reciente (Realtime)
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {ventasEnTiempoReal.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Esperando transacciones entrantes...</p>
            ) : (
              ventasEnTiempoReal.map((v) => (
                <div key={v.id_venta} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">ID Venta: {v.id_venta}</span>
                    <p className="text-sm font-medium text-slate-700 mt-1.5">
                      Cliente: <span className="font-mono text-xs text-slate-500">{v.id_cliente ? v.id_cliente.slice(0, 8) : 'Webpay Session'}...</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-500 font-extrabold text-lg block">+ ${Number(v.total_venta).toLocaleString('es-CL')}</span>
                    <span className="text-[10px] text-gray-400">{v.fecha_venta ? new Date(v.fecha_venta).toLocaleTimeString('es-CL') : 'Ahora'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: any) {
  const colors: any = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    orange: "text-orange-600 bg-orange-50 border-orange-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
  };
  return (
    <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${colors[color]}`}>{trend}</span>
      </div>
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}