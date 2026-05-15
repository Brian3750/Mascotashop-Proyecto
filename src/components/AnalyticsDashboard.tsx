import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { TrendingUp, Users, MousePointer2, DollarSign, Target } from 'lucide-react';

// --- CONFIGURACIÓN DE COLORES FINTECH ---
const COLORS_FINTECH = {
  vistas: '#3b82f6',    // Azul Brillante
  ventas: '#10b981',    // Esmeralda
  accent: '#f97316',    // Naranja Neón
  text: '#64748b'
};

const SEGMENTOS_RFM = [
  { name: 'Campeones', value: 45, color: '#10b981' },
  { name: 'Leales', value: 25, color: '#3b82f6' },
  { name: 'En Riesgo', value: 20, color: '#f97316' },
  { name: 'Perdidos', value: 10, color: '#ef4444' },
];

const dataComparativa = [
  { name: 'Alimento Perro', vistas: 450, ventas: 120 },
  { name: 'Arena Gato', vistas: 380, ventas: 210 },
  { name: 'Juguete Cordel', vistas: 590, ventas: 85 },
  { name: 'Snacks Premium', vistas: 220, ventas: 190 },
  { name: 'Camas Ortho', vistas: 150, ventas: 30 },
];

export default function AnalyticsDashboard() {
  const [totalPuntos, setTotalPuntos] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);

  // --- OBTENER DATOS REALES DE SUPABASE ---
  const fetchRealTimeStats = async () => {
    try {
      const { data: perfiles } = await supabase.from('perfiles').select('puntos_acumulados');
      if (perfiles) {
        const sumaPuntos = perfiles.reduce((acc, curr) => acc + (curr.puntos_acumulados || 0), 0);
        setTotalPuntos(sumaPuntos);
        setTotalClientes(perfiles.length);
      }
    } catch (error) {
      console.error("Error cargando estadísticas reales:", error);
    }
  };

  useEffect(() => {
    fetchRealTimeStats();
  }, []);

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden font-sans">
      {/* Header del Dashboard */}
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
        {/* --- TARJETAS DE KPIs --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Ingresos Totales" 
            value="$1.240.500" 
            icon={<DollarSign size={20} />} 
            trend="+12.5%"
            color="emerald"
          />
          <StatCard 
            title="Interacciones NoSQL" 
            value="8,432" 
            icon={<MousePointer2 size={20} />} 
            trend="Live"
            color="blue"
          />
          {/* KPI DE PUNTOS REALES */}
          <StatCard 
            title="Fidelidad (Puntos)" 
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} />
              Interés vs. Conversión (Cruce SQL/NoSQL)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataComparativa}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 12}}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  <Bar 
                    dataKey="vistas" 
                    fill={COLORS_FINTECH.vistas} 
                    radius={[6, 6, 0, 0]} 
                    name="Vistas (MongoDB)" 
                    barSize={24}
                  />
                  <Bar 
                    dataKey="ventas" 
                    fill={COLORS_FINTECH.ventas} 
                    radius={[6, 6, 0, 0]} 
                    name="Ventas (WebPay)" 
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución RFM</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SEGMENTOS_RFM}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {SEGMENTOS_RFM.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {SEGMENTOS_RFM.map((seg) => (
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
    <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-center mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${colors[color]}`}>
          {trend}
        </span>
      </div>
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}