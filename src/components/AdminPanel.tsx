import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package, Plus, Trash2, Layers, BarChart3, ShieldAlert, Lock, LogOut } from 'lucide-react';
// Importamos el nuevo Dashboard
import AnalyticsDashboard from './AnalyticsDashboard';

export default function AdminPanel() {
  // 1. COMPROBAR EL ENTORNO: Lee si ejecutaste "npm run dev:admin"
  const isCustomAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true';

  const [activeTab, setActiveTab] = useState<'analytics' | 'pedidos' | 'inventario' | 'nuevo'>('analytics');
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ESTADOS DE SEGURIDAD INTERNA
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<number>(0);
  const [newProduct, setNewProduct] = useState({
    nombre_producto: '',
    marca: '',
    stock: 0,
    precio: 0,
    categoria: '',
    descripcion: '',
  });

  // Verificar si ya existía una sesión administrativa activa en este navegador
  useEffect(() => {
    if (isCustomAdminMode) {
      const sesionGuardada = localStorage.getItem('admin_console_unlocked');
      if (sesionGuardada === 'true') {
        setIsUnlocked(true);
        fetchData();
        return;
      }
    }
    setLoading(false);
  }, [isCustomAdminMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Consulta de ventas y perfiles corregida
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select(`
          id_venta, 
          total_venta, 
          fecha_venta, 
          estado, 
          id_cliente, 
          perfiles:id_cliente (
            id, 
            nombres, 
            apellidos,
            puntos_acumulados
          )
        `)
        .neq('estado', 'completado')
        .order('fecha_venta', { ascending: false });

      if (ventasError) {
        console.error('Error al traer ventas:', ventasError);
      } else if (ventas) {
        setPedidos(ventas);
      }

      const { data: inventario, error: inventarioError } = await supabase
        .from('inventario')
        .select('*')
        .order('nombre_producto', { ascending: true });

      if (inventarioError) {
        console.error('Error al traer inventario:', inventarioError);
      } else if (inventario) {
        setProductos(inventario);
      }
    } catch (error) {
      console.error('Error en fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manejador del Login con contraseña
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const CONTRASEÑA_MAESTRA = 'BrianAdmin2026'; // 👈 Puedes cambiar tu contraseña aquí

    if (password === CONTRASEÑA_MAESTRA) {
      localStorage.setItem('admin_console_unlocked', 'true');
      setIsUnlocked(true);
      setAuthError('');
      fetchData();
    } else {
      setAuthError('Contraseña administrativa incorrecta.');
    }
  };

  // Manejador para cerrar sesión de la consola
  const handleLogoutConsole = () => {
    localStorage.removeItem('admin_console_unlocked');
    setIsUnlocked(false);
    setPassword('');
  };

  // --- FUNCIÓN CON LÓGICA DE PUNTOS ---
  const procesarPedido = async (id: string, nombreCliente: string, totalVenta: number, idCliente: string) => {
    try {
      const puntosGanados = Math.floor(totalVenta * 0.01);

      const { error: errorVenta } = await supabase
        .from('ventas')
        .update({ estado: 'listo para retiro' })
        .eq('id_venta', id);

      if (errorVenta) throw errorVenta;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('puntos_acumulados')
        .eq('id', idCliente)
        .single();

      const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

      const { error: errorPuntos } = await supabase
        .from('perfiles')
        .update({ puntos_acumulados: nuevosPuntos })
        .eq('id', idCliente);

      if (errorPuntos) throw errorPuntos;

      const numeroTienda = '56912345678';
      const mensaje = `¡Hola ${nombreCliente}! Tu pedido #${id} está listo en Maipú. 🐾 Ganaste ${puntosGanados} puntos. Total acumulado: ${nuevosPuntos}.`;
      const whatsappUrl = `https://wa.me/${numeroTienda}?text=${encodeURIComponent(mensaje)}`;
      
      window.open(whatsappUrl, '_blank');
      fetchData();

    } catch (error) {
      console.error("Error en el proceso:", error);
      alert("No se pudo procesar los puntos");
    }
  };

  const handleUpdateStock = async (id_alimento: string) => {
    const { error } = await supabase
      .from('inventario')
      .update({ stock: tempStock })
      .eq('id_alimento', id_alimento);

    if (error) {
      alert('Error al actualizar stock');
    } else {
      alert('Stock actualizado correctamente');
      setEditingId(null);
      fetchData();
    }
  };

  const handleDeleteProduct = async (id_alimento: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto del inventario?')) return;

    const { error } = await supabase
      .from('inventario')
      .delete()
      .eq('id_alimento', id_alimento);

    if (error) {
      alert('Error al eliminar el producto');
    } else {
      alert('Producto eliminado correctamente');
      fetchData();
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.nombre_producto || !newProduct.marca || newProduct.stock < 0) {
      alert('Completa los campos obligatorios correctamente.');
      return;
    }

    const { error } = await supabase
      .from('inventario')
      .insert([newProduct]);

    if (error) {
      alert('Error al agregar producto');
    } else {
      alert('Producto agregado al inventario');
      setNewProduct({ nombre_producto: '', marca: '', stock: 0, precio: 0, categoria: '', descripcion: '' });
      setActiveTab('inventario');
      fetchData();
    }
  };

  const correrMotorRFM = async () => {
    try {
      const { error } = await supabase.rpc('calcular_segmentacion_rfm');
      if (error) throw error;
      
      alert('¡Segmentación RFM actualizada con éxito en tiempo real!');
      fetchData();
    } catch (error) {
      console.error('Error al correr el motor analítico:', error);
      alert('No se pudo procesar la segmentación.');
    }
  };

  // BLOQUEO FILTRADO A: Si entraste usando el comando normal 'npm run dev'
  if (!isCustomAdminMode) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white p-6 text-center font-sans">
        <ShieldAlert className="text-rose-500 h-16 w-16 mb-4 animate-pulse" />
        <h1 className="text-2xl font-black uppercase tracking-wider">Entorno de Servidor Restringido</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-md">
          Este puerto local no tiene activo el módulo analítico. Ejecuta el comando exclusivo en tu terminal para habilitar el portal.
        </p>
      </div>
    );
  }

  // BLOQUEO FILTRADO B: Si estás en 'npm run dev:admin' pero no te has logueado con contraseña
  if (!isUnlocked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white font-sans px-4">
        <div className="w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900 p-8 shadow-2xl relative">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="bg-orange-500/10 p-3 rounded-xl mb-3 border border-orange-500/20">
              <Lock className="text-orange-500 h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Consola Administrativa</h2>
            <p className="text-slate-400 text-xs mt-1">El servidor se encuentra en modo dev:admin</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Introduce la clave maestra"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 outline-none focus:border-orange-500 text-sm text-center tracking-widest text-white placeholder-slate-700 transition"
              required
            />
            {authError && (
              <p className="text-rose-500 text-xs text-center font-semibold bg-rose-500/10 border border-rose-500/20 py-2.5 rounded-xl">
                ⚠️ {authError}
              </p>
            )}
            <button type="submit" className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-bold hover:bg-orange-600 transition shadow-lg shadow-orange-500/10 text-white">
              Desbloquear Módulos
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-10 text-center font-sans text-slate-500">Cargando datos de sucursal Maipú...</div>;

  // ACCESO PERMITIDO COMPLETO (Comando Correcto + Contraseña Correcta)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* BANNER INDICATIVO DE ENTORNOS */}
        <div className="bg-slate-900 text-slate-300 text-xs font-mono font-bold flex items-center justify-between px-6 py-2 rounded-2xl shadow-inner border border-slate-800">
          <span>⚙️ MODO DESARROLLADOR ADMINISTRATIVO ACTIVO (PORT: MAIPÚ)</span>
          <span className="text-emerald-400 animate-pulse">● ONLINE</span>
        </div>

        {/* HEADER DEL PANEL */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-sm uppercase tracking-[0.26em] text-orange-500 font-bold">MascotaShop Admin</p>
                <button 
                  onClick={handleLogoutConsole}
                  className="flex items-center gap-1.5 text-xs text-rose-500 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-xl transition font-bold"
                >
                  <LogOut size={12} /> Cerrar Sesión
                </button>
              </div>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">Gestión Integral</h1>
              <p className="mt-2 text-sm text-slate-500">Control de analítica, pedidos e inventario en tiempo real.</p>
            </div>
            
            {/* NAVEGACIÓN POR TABS */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === 'analytics' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <BarChart3 size={18} /> Analítica
              </button>
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === 'pedidos' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setActiveTab('inventario')}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === 'inventario' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Inventario
              </button>
              <button
                onClick={() => setActiveTab('nuevo')}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${activeTab === 'nuevo' ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                + Nuevo
              </button>
            </div>
          </div>
        </div>

        {/* CONTENIDO DINÁMICO SEGÚN TAB */}
        <div className="grid gap-6">
          
          {/* VISTA DE ANALÍTICA */}
          {activeTab === 'analytics' && (
            <div className="animate-in fade-in duration-500 space-y-6">
              <div className="flex justify-between items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <h3 className="font-bold text-slate-900">Motor de Segmentación</h3>
                  <p className="text-xs text-slate-500">Recalcula el estado RFM de los clientes basándose en sus compras completadas.</p>
                </div>
                <button
                  onClick={correrMotorRFM}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-md"
                >
                  <BarChart3 size={14} /> Ejecutar Motor RFM
                </button>
              </div>
              
              <AnalyticsDashboard />
            </div>
          )}

          {/* VISTA DE PEDIDOS ACTUALIZADA WITH PUNTOS */}
          {activeTab === 'pedidos' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Pedidos en preparación</h2>
                  <p className="mt-1 text-sm text-slate-500">Actualiza el estado y suma puntos automáticamente.</p>
                </div>
                <button onClick={fetchData} className="p-2 rounded-full hover:bg-slate-100 transition">
                  <Clock className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {pedidos.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
                   <PackageCheck className="mx-auto h-12 w-12 opacity-20" />
                   <p className="mt-4">Sin pedidos pendientes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pedidos.map((pedido) => {
                    const nombreC = pedido.perfiles ? `${pedido.perfiles.nombres} ${pedido.perfiles.apellidos}` : 'Cliente desconocido';
                    const puntosActuales = pedido.perfiles?.puntos_acumulados || 0;
                    
                    return (
                      <article key={pedido.id_venta} className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-slate-50/50 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">Venta #{pedido.id_venta}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {puntosActuales} pts fidelizados
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">{nombreC}</h3>
                          <p className="text-sm text-slate-500">Total: ${pedido.total_venta?.toLocaleString()} • <span className="capitalize">{pedido.estado}</span></p>
                        </div>
                        <button
                          onClick={() => procesarPedido(pedido.id_venta, nombreC, pedido.total_venta, pedido.id_cliente)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          <MessageSquare className="h-4 w-4" /> Notificar y Sumar Puntos
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* VISTA DE INVENTARIO */}
          {activeTab === 'inventario' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Control de Stock</h2>
                <div className="flex gap-2">
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Total: {productos.length}</span>
                  <span className="rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-600">Crítico: {productos.filter(p => p.stock <= 5).length}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4">Stock</th>
                      <th className="px-6 py-4">Precio</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productos.map((prod) => (
                      <tr key={prod.id_alimento} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {prod.nombre_producto}
                          <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{prod.marca}</div>
                        </td>
                        <td className="px-6 py-4">
                          {editingId === prod.id_alimento ? (
                            <input
                              type="number"
                              value={tempStock}
                              onChange={(e) => setTempStock(Number(e.target.value))}
                              className="w-16 rounded-lg border border-orange-300 p-1 text-center"
                            />
                          ) : (
                            <span className={`font-bold ${prod.stock <= 5 ? 'text-orange-600' : 'text-slate-600'}`}>{prod.stock}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">${prod.precio?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {editingId === prod.id_alimento ? (
                            <button onClick={() => handleUpdateStock(prod.id_alimento)} className="text-emerald-600 hover:scale-110 transition"><Save size={18}/></button>
                          ) : (
                            <button onClick={() => { setEditingId(prod.id_alimento); setTempStock(prod.stock); }} className="text-slate-400 hover:text-slate-900"><Edit3 size={18}/></button>
                          )}
                          <button onClick={() => handleDeleteProduct(prod.id_alimento)} className="text-rose-400 hover:text-rose-600"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* VISTA DE NUEVO PRODUCTO */}
          {activeTab === 'nuevo' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Nuevo Ingreso</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  placeholder="Nombre Producto"
                  className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-orange-500"
                  value={newProduct.nombre_producto}
                  onChange={e => setNewProduct({...newProduct, nombre_producto: e.target.value})}
                />
                <input
                  placeholder="Marca"
                  className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-orange-500"
                  value={newProduct.marca}
                  onChange={e => setNewProduct({...newProduct, marca: e.target.value})}
                />
                <input
                  type="number"
                  placeholder="Stock"
                  className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-orange-500"
                  value={newProduct.stock}
                  onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                />
                <input
                  type="number"
                  placeholder="Precio"
                  className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-orange-500"
                  value={newProduct.precio}
                  onChange={e => setNewProduct({...newProduct, precio: Number(e.target.value)})}
                />
                <button
                  onClick={handleAddProduct}
                  className="md:col-span-2 mt-4 rounded-2xl bg-orange-500 py-4 font-bold text-white shadow-lg hover:bg-orange-600 transition"
                >
                  Confirmar e Ingresar al Sistema
                </button>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}