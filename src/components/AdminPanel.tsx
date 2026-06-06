import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package, Plus, Trash2, Layers, BarChart3, ShieldAlert, Lock, LogOut, MailCheck } from 'lucide-react';
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
  
  // 🛠️ ESTADO LOCAL DEL FORMULARIO
  const [newProduct, setNewProduct] = useState({
    nombre_producto: '',
    marca: '',
    stock: 10, // Default según tu esquema
    precio: 0,
    categoria: '',
    descripcion: '', 
  });

  // 🚀 ESTADOS PARA EL DISPARADOR DINÁMICO DE CUPONES
  const [couponForm, setCouponForm] = useState({
    correo_cliente: '',
    nombre_cliente: '',
    telefono_cliente: '', 
    codigo_cupon: 'VIP-MASC-2026',
    descuento: '20% DE DESCUENTO'
  });
  const [sendingCoupon, setSendingCoupon] = useState(false);

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
            puntos_acumulados,
            telefono,
            categoria_rfm
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
    const CONTRASEÑA_MAESTRA = 'BrianAdmin2026';

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

  // --- FUNCIÓN CON LÓGICA DE PUNTOS Y RECONOCIMIENTO DE RIESGO RFM ---
  const procesarPedido = async (id: string, nombreCliente: string, totalVenta: number, idCliente: string, perfilCliente: any) => {
    try {
      const puntosGanados = Math.floor(totalVenta * 0.01);

      const { error: errorVenta } = await supabase
        .from('ventas')
        .update({ estado: 'listo para retiro' })
        .eq('id_venta', id);

      if (errorVenta) throw errorVenta;

      const nuevosPuntos = (perfilCliente?.puntos_acumulados || 0) + puntosGanados;

      const { error: errorPuntos } = await supabase
        .from('perfiles')
        .update({ puntos_acumulados: nuevosPuntos })
        .eq('id', idCliente);

      if (errorPuntos) throw errorPuntos;

      const telefonoDestino = perfilCliente?.telefono || '56912345678';
      const categoria = perfilCliente?.categoria_rfm?.toLowerCase() || '';
      let mensajeRiesgo = '';
      
      if (categoria.includes('riesgo') || categoria.includes('perder') || categoria.includes('hibernando')) {
        mensajeRiesgo = ` ¡Te extrañamos en mascotashop, vuelve! 🐾❤️`;
      }

      const mensaje = `¡Hola ${nombreCliente}! Tu pedido #${id} está listo en Maipú. 🐾 Ganaste ${puntosGanados} puntos. Total acumulado: ${nuevosPuntos}.${mensajeRiesgo}`;
      const whatsappUrl = `https://wa.me/${telefonoDestino}?text=${encodeURIComponent(mensaje)}`;
      
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

  // 🛠️ FUNCIÓN DE INSERCIÓN CORREGIDA CON TU ESQUEMA REAL
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProduct.nombre_producto || !newProduct.marca || newProduct.precio <= 0) {
      alert('Por favor, completa el nombre, la marca y un precio válido.');
      return;
    }

    try {
      // 1. Generamos un ID de texto único para cumplir con el varchar(50) NOT NULL 'id_alimento'
      const idUnicoAlimento = `prod-${crypto.randomUUID().substring(0, 8)}`;

      // 2. Mapeamos las propiedades idénticas a los nombres de tus columnas de PostgreSQL
      const productoPayload = {
        id_alimento: idUnicoAlimento,
        nombre_producto: newProduct.nombre_producto.trim(),
        marca: newProduct.marca.trim(),
        stock: Number(newProduct.stock) ?? 10,
        precio_venta: Number(newProduct.precio), // Mapeado correctamente a tu columna
        categoria: newProduct.categoria.trim() || 'General',
        disponible: true
      };

      const { data, error } = await supabase
        .from('inventario')
        .insert([productoPayload])
        .select();

      if (error) {
        console.error('Error detallado de Supabase:', error);
        alert(`No se pudo agregar el producto: ${error.message}`);
        return;
      }

      alert(`✨ "${productoPayload.nombre_producto}" se ha ingresado con éxito al inventario.`);
      
      // Limpiar formulario y volver a la vista del listado
      setNewProduct({ nombre_producto: '', marca: '', stock: 10, precio: 0, categoria: '', descripcion: '' });
      setActiveTab('inventario');
      fetchData();

    } catch (err) {
      console.error('Error de red/runtime en inserción:', err);
      alert('Ocurrió un fallo crítico al comunicar con la base de datos.');
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

  const handleSendAdminCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.correo_cliente || !couponForm.codigo_cupon) {
      alert('Por favor, indica al menos el correo de destino y el código del cupón.');
      return;
    }

    setSendingCoupon(true);
    try {
      const response = await fetch('/api/admin/enviar-cupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(couponForm)
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        alert(`✨ Cupón enviado con éxito a: ${couponForm.correo_cliente}`);
        setCouponForm({ ...couponForm, correo_cliente: '', nombre_cliente: '', telefono_cliente: '' });
      } else {
        alert(`⚠️ Servidor respondió con error: ${resData.error || 'No se pudo despachar.'}`);
      }
    } catch (err: any) {
      console.error("Error al despachar el beneficio:", err);
      alert("Error de conexión con el backend analítico.");
    } finally {
      setSendingCoupon(false);
    }
  };

  const handleSendCouponWhatsApp = () => {
    if (!couponForm.telefono_cliente) {
      alert('Por favor, introduce el teléfono del cliente para enviar por WhatsApp.');
      return;
    }

    const nombre = couponForm.nombre_cliente || 'Amigo/a';
    const textoWS = `¡Hola ${nombre}! Queremos consentir a tu mascota. 🐾 Te regalamos un cupón exclusivo de *${couponForm.descuento}*. Usa el código: *${couponForm.codigo_cupon}* en tu próxima compra. ¡Te esperamos en MascotaShop!`;
    
    const url = `https://wa.me/${couponForm.telefono_cliente}?text=${encodeURIComponent(textoWS)}`;
    window.open(url, '_blank');
  };

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
              <p className="text-rose-500 text-xs text-center font-semibold bg-rose-50/10 border border-rose-500/20 py-2.5 rounded-xl">
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
              <div className="flex flex-col md:flex-row justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-lg">Motor de Segmentación Analítica</h3>
                  <p className="text-xs text-slate-500 max-w-lg">
                    Recalcula el estado RFM de los clientes de forma masiva o inyecta cupones de fidelidad directamente a sus casillas.
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={correrMotorRFM}
                    className="w-full md:w-auto flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white transition hover:bg-slate-800 shadow-md"
                  >
                    <BarChart3 size={14} /> Ejecutar Motor RFM SQL
                  </button>
                </div>
              </div>

              {/* FORMULARIO INTEGRADO PARA DISPARO DE BENEFICIOS OMNICANAL */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                  <MailCheck className="text-orange-500" size={20} />
                  <h4 className="font-bold text-slate-900">Inyección Omnicanal de Cupones VIP</h4>
                </div>
                
                <form onSubmit={handleSendAdminCoupon} className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Nombre Cliente</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Brian"
                      value={couponForm.nombre_cliente}
                      onChange={e => setCouponForm({...couponForm, nombre_cliente: e.target.value})}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Correo Electrónico</label>
                    <input 
                      type="email" 
                      placeholder="brian@gmail.com"
                      value={couponForm.correo_cliente}
                      onChange={e => setCouponForm({...couponForm, correo_cliente: e.target.value})}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Teléfono (WhatsApp)</label>
                    <input 
                      type="text" 
                      placeholder="569XXXXXXXX"
                      value={couponForm.telefono_cliente}
                      onChange={e => setCouponForm({...couponForm, telefono_cliente: e.target.value})}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Código Cupón</label>
                    <input 
                      type="text" 
                      value={couponForm.codigo_cupon}
                      onChange={e => setCouponForm({...couponForm, codigo_cupon: e.target.value})}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500 font-mono"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Glosa Descuento</label>
                    <input 
                      type="text" 
                      value={couponForm.descuento}
                      onChange={e => setCouponForm({...couponForm, descuento: e.target.value})}
                      className="rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500"
                    />
                  </div>
                  
                  <div className="sm:col-span-2 md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <button
                      type="submit"
                      disabled={sendingCoupon}
                      className="rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      {sendingCoupon ? 'Despachando Correo...' : '✉️ Enviar Cupón por Email (SMTP)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendCouponWhatsApp}
                      className="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
                    >
                      💬 Enviar Cupón por WhatsApp
                    </button>
                  </div>
                </form>
              </div>
              
              <AnalyticsDashboard />
            </div>
          )}

          {/* VISTA DE PEDIDOS */}
          {activeTab === 'pedidos' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Pedidos en preparación</h2>
                  <p className="mt-1 text-sm text-slate-500">Detecta automáticamente el segmento de riesgo y personaliza alertas.</p>
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
                    const categoriaRfm = pedido.perfiles?.categoria_rfm || 'Sin Segmentar';
                    const esRiesgo = categoriaRfm.toLowerCase().includes('riesgo') || categoriaRfm.toLowerCase().includes('perder') || categoriaRfm.toLowerCase().includes('hibernando');

                    return (
                      <article key={pedido.id_venta} className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-slate-50/50 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">Venta #{pedido.id_venta}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {puntosActuales} pts fidelizados
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${esRiesgo ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
                              RFM: {categoriaRfm}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">{nombreC}</h3>
                          <p className="text-sm text-slate-500">Total: ${pedido.total_venta?.toLocaleString()} • <span className="capitalize">{pedido.estado}</span></p>
                        </div>
                        <button
                          onClick={() => procesarPedido(pedido.id_venta, nombreC, pedido.total_venta, pedido.id_cliente, pedido.perfiles)}
                          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition ${esRiesgo ? 'bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-200' : 'bg-slate-900 hover:bg-slate-800'}`}
                        >
                          <MessageSquare className="h-4 w-4" /> 
                          {esRiesgo ? 'Retener Cliente y Notificar' : 'Notificar y Sumar Puntos'}
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
                        {/* Se ajusta también el renderizado de la lista usando prod.precio_venta */}
                        <td className="px-6 py-4 text-slate-500">${(prod.precio_venta ?? prod.precio)?.toLocaleString()}</td>
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

          {/* 🛠️ VISTA DE NUEVO PRODUCTO */}
          {activeTab === 'nuevo' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm animate-in fade-in duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Nuevo Ingreso de Inventario</h2>
                <p className="text-slate-500 text-sm mt-1">Inserta un nuevo artículo o alimento directamente al stock central de Supabase.</p>
              </div>

              <form onSubmit={handleAddProduct} className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Nombre del Producto *</label>
                  <input
                    type="text"
                    placeholder="Ej. Alimento Perro Adulto Razas Pequeñas"
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition"
                    value={newProduct.nombre_producto}
                    onChange={e => setNewProduct({...newProduct, nombre_producto: e.target.value})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Marca *</label>
                  <input
                    type="text"
                    placeholder="Ej. Royal Canin"
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition"
                    value={newProduct.marca}
                    onChange={e => setNewProduct({...newProduct, marca: e.target.value})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Stock Inicial</label>
                  <input
                    type="number"
                    placeholder="Cantidad disponible"
                    min="0"
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition font-mono"
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Precio Unitario ($) *</label>
                  <input
                    type="number"
                    placeholder="Ej. 24990"
                    min="1"
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition font-mono"
                    value={newProduct.precio}
                    onChange={e => setNewProduct({...newProduct, precio: Number(e.target.value)})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej. Alimentos, Juguetes, Farmacia"
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition"
                    value={newProduct.categoria}
                    onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Descripción / Glosa (Opcional - No guardada en DB)</label>
                  <textarea
                    placeholder="Detalles internos que no se guardarán por límites de estructura..."
                    rows={3}
                    className="rounded-2xl border border-slate-200 p-3.5 outline-none focus:border-orange-500 bg-slate-50 text-sm transition resize-none"
                    value={newProduct.descripcion}
                    onChange={e => setNewProduct({...newProduct, descripcion: e.target.value})}
                  />
                </div>

                <button
                  type="submit"
                  className="md:col-span-2 mt-2 rounded-2xl bg-orange-500 py-4 font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition tracking-wide text-sm"
                >
                  Confirmar e Ingresar al Sistema de Sucursal
                </button>
              </form>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}