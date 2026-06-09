import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { TrendingUp, Users, MousePointer2, DollarSign, Target, Activity } from 'lucide-react';

// Paleta de Colores Estilo Fintech de Alto Contraste
const COLORS_FINTECH = {
  vistas: '#3b82f6',     // Azul Eléctrico
  ventas: '#10b981',     // Emerald Green
  campeones: '#05f024',  // Midnight Blue
  leales: '#210ce6',     // Emerald
  riesgo: '#ff7a00',     // Neon Orange
  perdidos: '#ef4444',   // Rojo Alerta
};

export default function AnalyticsDashboard() {
  const [totalPuntos, setTotalPuntos] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [segmentosRfm, setSegmentosRfm] = useState<any[]>([]);
  const [ventasEnTiempoReal, setVentasEnTiempoReal] = useState<any[]>([]);
  
  // Datos reales consumidos desde el backend (Sin constantes estáticas hardcodeadas)
  const [metricasCategorias, setMetricasCategorias] = useState<any[]>([]);

  const cargarDataDashboard = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/analitica/dashboard');
      const data = await res.json();
      if (data.success) {
        setTotalIngresos(data.totalIngresos);
        setTotalClientes(data.totalClientes);
        setTotalPuntos(data.totalPuntos);
        
        // Carga dinámica de las métricas comerciales por categoría desde tu API terminada
        setMetricasCategorias(data.metricasCategorias || []);

        // Mapeo y asignación de colores para los segmentos analíticos estándar del proyecto
        const mapeoCategorias = (data.distribuciónRFM || []).map((item: any) => {
          let name = item.name;
          let color = '#6366f1'; // Color por defecto (Indigo)

          if (item.name.toLowerCase().includes('campeon')) {
            name = 'Campeones';
            color = COLORS_FINTECH.campeones;
          } else if (item.name.toLowerCase().includes('leal')) {
            name = 'Leales';
            color = COLORS_FINTECH.leales;
          } else if (item.name.toLowerCase().includes('riesgo')) {
            name = 'En Riesgo';
            color = COLORS_FINTECH.riesgo;
          } else if (item.name.toLowerCase().includes('perdido')) {
            name = 'Perdidos';
            color = COLORS_FINTECH.perdidos;
          }

          return { ...item, name, color };
        });

        // Respaldo de inicialización si la base de datos de testeo está limpia
        if (mapeoCategorias.length === 0) {
          setSegmentosRfm([
            { name: 'Campeones', value: 25, color: COLORS_FINTECH.campeones },
            { name: 'Leales', value: 35, color: COLORS_FINTECH.leales },
            { name: 'En Riesgo', value: 20, color: COLORS_FINTECH.riesgo },
            { name: 'Perdidos', value: 20, color: COLORS_FINTECH.perdidos },
          ]);
        } else {
          setSegmentosRfm(mapeoCategorias);
        }

        setVentasEnTiempoReal(data.transaccionesRecientes || []);
      }
    } catch (err) {
      console.error("Error al cargar la API analítica:", err);
    }
  };

  useEffect(() => {
    cargarDataDashboard();

    const canalVentas = supabase
      .channel('cambios-ventas-mascotashop')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ventas' },
        () => {
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
            <p className="text-slate-400 text-sm mt-1">Inteligencia de Negocio y Ciclo de Vida del Consumidor</p>
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
          <StatCard title="Ingresos Totales (Live)" value={`$${totalIngresos.toLocaleString('es-CL')}`} icon={<DollarSign size={20} />} trend="Live" color="emerald" />
          <StatCard title="Interacciones Totales" value="8,432" icon={<MousePointer2 size={20} />} trend="Omnicanal" color="blue" />
          <StatCard title="Fidelidad (Puntos Real)" value={totalPuntos.toLocaleString()} icon={<Target size={20} />} trend="Actualizado" color="orange" />
          <StatCard title="Clientes Activos" value={totalClientes.toString()} icon={<Users size={20} />} trend="Total DB" color="purple" />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Gráfico de Barras - Datos transaccionales dinámicos */}
          <div className="lg:col-span-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} />
              Volumen de Ventas vs. Puntos de Fidelidad por Categoría
            </h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                {metricasCategorias.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Cargando métricas transaccionales de categorías...
                  </div>
                ) : (
                  <BarChart data={metricasCategorias}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    <Bar dataKey="totalVentas" fill={COLORS_FINTECH.ventas} radius={[6, 6, 0, 0]} name="Transacciones Totales" barSize={24} />
                    <Bar dataKey="promedioPuntos" fill={COLORS_FINTECH.vistas} radius={[6, 6, 0, 0]} name="Puntos Promedio Acumulados" barSize={24} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Torta - Segmentación RFM Tradicional */}
          <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución Analítica RFM</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={segmentosRfm} innerRadius={60} outerRadius={80} paddingAngle={6} dataKey="value">
                    {segmentosRfm.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {segmentosRfm.map((seg) => (
                <div key={seg.name} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: seg.color}} />
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
              <p className="text-sm text-gray-400 text-center py-4">Esperando transacciones entrantes de MascotaShop o WebPay...</p>
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