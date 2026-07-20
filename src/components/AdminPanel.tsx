import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package, Plus, Trash2, Layers, BarChart3, ShieldAlert, Lock, LogOut, MailCheck, CheckCircle2 } from 'lucide-react';
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
    stock: 10,
    precio: 0,
    categoria: '',
    descripcion: '', 
  });

  // 🚀 ESTADOS PARA EL DISPARADOR DINÁMICO DE CUPONES
  const generarCodigoCupon = () => {
    const prefijos = ['VIP', 'MASC', 'LOYAL', 'PET', 'FIEL'];
    const prefijo = prefijos[Math.floor(Math.random() * prefijos.length)];
    const timestamp = Date.now().toString(36).toUpperCase();
    const aleatorio = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefijo}-${timestamp}-${aleatorio}`;
  };

  const [couponForm, setCouponForm] = useState({
    correo_cliente: '',
    nombre_cliente: '',
    telefono_cliente: '', 
    codigo_cupon: generarCodigoCupon(),
    descuento: '20% DE DESCUENTO'
  });
  const [sendingCoupon, setSendingCoupon] = useState(false);
  const [modalNotif, setModalNotif] = useState<{ pedido: any; telefono: string } | null>(null);

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
        .in('estado', ['pendiente', 'Pendiente', 'apartado', 'Apartado', 'en preparación'])
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

  const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const cambiarEstadoPedido = async (id_venta: string, estado: string) => {
    try {
      const res = await fetch(`${API}/api/admin/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'estado', id_venta, estado })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchData();
    } catch (error: any) {
      console.error('Error al cambiar estado:', error.message);
      alert('No se pudo cambiar el estado del pedido.');
    }
  };

  const notificarPedidoListo = async (pedido: any) => {
    const nombreC = pedido.perfiles ? `${pedido.perfiles.nombres} ${pedido.perfiles.apellidos}` : 'Cliente';
    try {
      const res = await fetch(`${API}/api/admin/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'listo',
          id_venta: pedido.id_venta,
          id_cliente: pedido.id_cliente,
          nombre_cliente: nombreC,
          correo_cliente: pedido.perfiles?.email || '',
          telefono_cliente: pedido.perfiles?.telefono || '',
          total_venta: pedido.total_venta,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.whatsappEnviado) {
        alert(`✅ Pedido #${pedido.id_venta} marcado como listo.\n📧 Correo enviado.\n📲 WhatsApp enviado por Twilio.`);
      } else {
        alert(`✅ Pedido #${pedido.id_venta} marcado como listo. Correo enviado.\n⚠️ WhatsApp no enviado — revisa que el número esté dentro de la ventana de 24h del sandbox.`);
      }
      fetchData();
    } catch (error: any) {
      console.error('Error al notificar pedido:', error.message);
      alert('No se pudo completar la notificación: ' + error.message);
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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nombre_producto || !newProduct.marca || newProduct.precio <= 0) {
      alert('Por favor, completa el nombre, la marca y un precio válido.');
      return;
    }

    try {
      const idUnicoAlimento = `prod-${crypto.randomUUID().substring(0, 8)}`;
      const productoPayload = {
        id_alimento: idUnicoAlimento,
        nombre_producto: newProduct.nombre_producto.trim(),
        marca: newProduct.marca.trim(),
        stock: Number(newProduct.stock) ?? 10,
        precio_venta: Number(newProduct.precio),
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
        body: JSON.stringify({ ...couponForm, canal: 'email' })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        alert(`✨ Cupón enviado con éxito a: ${couponForm.correo_cliente}`);
        setCouponForm({ ...couponForm, correo_cliente: '', nombre_cliente: '', telefono_cliente: '', codigo_cupon: generarCodigoCupon() });
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

  const handleSendCouponWhatsApp = async () => {
    if (!couponForm.telefono_cliente) {
      alert('Por favor, introduce el teléfono del cliente para enviar por WhatsApp.');
      return;
    }

    setSendingCoupon(true);
    try {
      const res = await fetch(`${API}/api/admin/enviar-cupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal: 'whatsapp',
          telefono_cliente: couponForm.telefono_cliente,
          nombre_cliente: couponForm.nombre_cliente,
          codigo_cupon: couponForm.codigo_cupon,
          descuento: couponForm.descuento,
          correo_cliente: couponForm.correo_cliente || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`✅ Cupón ${couponForm.codigo_cupon} guardado en BD y enviado por WhatsApp a ${couponForm.telefono_cliente}`);
      setCouponForm({ ...couponForm, correo_cliente: '', nombre_cliente: '', telefono_cliente: '', codigo_cupon: generarCodigoCupon() });
    } catch (error: any) {
      alert(`⚠️ Error: ${error.message}`);
    } finally {
      setSendingCoupon(false);
    }
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
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={couponForm.codigo_cupon}
                        onChange={e => setCouponForm({...couponForm, codigo_cupon: e.target.value})}
                        className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 outline-none focus:border-orange-500 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setCouponForm({...couponForm, codigo_cupon: generarCodigoCupon()})}
                        title="Generar nuevo código"
                        className="px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-400 text-slate-500 hover:text-orange-600 transition text-sm"
                      >
                        🔄
                      </button>
                    </div>
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

          {/* 📦 VISTA DE PEDIDOS TOTALMENTE OPERATIVA */}
          {activeTab === 'pedidos' && (
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Control de Pedidos Online</h2>
                  <p className="mt-1 text-sm text-slate-500">Gestiona el flujo de preparación y notifica al cliente cuando su pedido esté listo.</p>
                </div>
                <button onClick={fetchData} className="p-2 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-600">
                  <Clock className="h-5 w-5" />
                </button>
              </div>

              {/* Leyenda de estados */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { estado: 'pendiente',       color: 'bg-blue-100 text-blue-800',   label: '🕐 Pendiente — recién llegó' },
                  { estado: 'en preparación',  color: 'bg-amber-100 text-amber-800', label: '📦 En preparación' },
                  { estado: 'listo para retiro', color: 'bg-emerald-100 text-emerald-800', label: '✅ Listo para retiro' },
                ].map(s => (
                  <span key={s.estado} className={`text-[10px] font-bold px-3 py-1 rounded-full ${s.color}`}>{s.label}</span>
                ))}
              </div>

              {pedidos.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
                  <PackageCheck className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-4 font-medium">Sin pedidos por gestionar.</p>
                  <p className="text-xs mt-1">Cuando un cliente pague online y el pedido esté en estado "pendiente", aparecerá aquí.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pedidos.map((pedido) => {
                    const nombreC = pedido.perfiles ? `${pedido.perfiles.nombres} ${pedido.perfiles.apellidos}` : 'Cliente desconocido';
                    const puntosActuales = pedido.perfiles?.puntos_acumulados || 0;
                    const categoriaRfm = pedido.perfiles?.categoria_rfm || 'Sin Segmentar';
                    const esRiesgo = categoriaRfm.toLowerCase().includes('riesgo') || categoriaRfm.toLowerCase().includes('perder');
                    const estado = pedido.estado?.toLowerCase() || 'pendiente';
                    const esPendiente = estado === 'pendiente';
                    const esEnPrep = estado === 'en preparación';
                    const esListo = estado === 'listo para retiro';
                    const tieneTelefono = !!pedido.perfiles?.telefono;

                    const estadoBadge = esPendiente
                      ? 'bg-blue-100 text-blue-800'
                      : esEnPrep
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800';

                    return (
                      <article key={pedido.id_venta} className={`rounded-[28px] border p-6 transition ${esRiesgo ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          
                          {/* Info del pedido */}
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                                Pedido #{pedido.id_venta}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${estadoBadge}`}>
                                {pedido.estado}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {puntosActuales} pts
                              </span>
                              {esRiesgo && (
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                                  ⚠️ Cliente en riesgo
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-900">{nombreC}</h3>

                            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                              <span>💰 ${Number(pedido.total_venta).toLocaleString('es-CL')}</span>
                              <span>📅 {new Date(pedido.fecha_venta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              {tieneTelefono
                                ? <span className="text-emerald-600">📱 {pedido.perfiles.telefono}</span>
                                : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Teléfono (WhatsApp)</span>
                                    <input
                                      type="tel"
                                      placeholder="569XXXXXXXX"
                                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-orange-500 transition font-mono tracking-widest placeholder-slate-300 w-40"
                                      onChange={e => {
                                        setModalNotif(prev => prev && prev.pedido.id_venta === pedido.id_venta
                                          ? { ...prev, telefono: e.target.value }
                                          : { pedido, telefono: e.target.value }
                                        );
                                        pedido._telefonoManual = e.target.value;
                                      }}
                                    />
                                  </div>
                                )
                              }
                            </div>
                          </div>

                          {/* Botones de acción según estado */}
                          <div className="flex flex-wrap gap-2 md:flex-col md:items-end">

                            {/* Pendiente → En preparación */}
                            {esPendiente && (
                              <button
                                onClick={() => cambiarEstadoPedido(pedido.id_venta, 'en preparación')}
                                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-bold text-white transition shadow-sm"
                              >
                                <Package className="h-4 w-4" />
                                Iniciar preparación
                              </button>
                            )}

                            {/* En preparación → Listo para retiro + notificación */}
                            {esEnPrep && (
                              <button
                                onClick={() => setModalNotif({ pedido, telefono: pedido.perfiles?.telefono || pedido._telefonoManual || '' })}
                                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition shadow-sm ${esRiesgo ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-700'}`}
                              >
                                <MessageSquare className="h-4 w-4" />
                                Listo — Notificar cliente
                              </button>
                            )}

                            {/* Listo para retiro — solo info */}
                            {esListo && (
                              <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 text-emerald-800 px-5 py-2.5 text-sm font-bold">
                                <PackageCheck className="h-4 w-4" />
                                Cliente notificado ✅
                              </span>
                            )}

                          </div>
                        </div>
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

          {/* VISTA DE NUEVO PRODUCTO */}
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

      {/* ── Modal: confirmar teléfono antes de notificar ── */}
      {modalNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl p-8 w-full max-w-md mx-4 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                <MessageSquare className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Notificar cliente</h3>
                <p className="text-xs text-slate-400 mt-0.5">Se enviará correo + WhatsApp con el mensaje de retiro</p>
              </div>
            </div>

            {/* Resumen del pedido */}
            <div className="bg-slate-50 rounded-2xl px-4 py-3 space-y-1 border border-slate-100">
              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Pedido:</span> #{modalNotif.pedido.id_venta}</p>
              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Cliente:</span> {modalNotif.pedido.perfiles ? `${modalNotif.pedido.perfiles.nombres} ${modalNotif.pedido.perfiles.apellidos}` : '—'}</p>
              <p className="text-xs text-slate-500"><span className="font-bold text-slate-700">Total:</span> ${Number(modalNotif.pedido.total_venta).toLocaleString('es-CL')}</p>
            </div>

            {/* Input teléfono — mismo estilo que cupones */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Teléfono (WhatsApp)
              </label>
              <input
                type="tel"
                placeholder="569XXXXXXXX"
                value={modalNotif.telefono}
                onChange={e => setModalNotif({ ...modalNotif, telefono: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-orange-500 transition font-mono tracking-widest placeholder-slate-300"
              />
              <p className="text-[11px] text-slate-400">Formato: 569XXXXXXXX · sin + ni espacios</p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalNotif(null)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const pedidoConTelefono = {
                    ...modalNotif.pedido,
                    perfiles: { ...modalNotif.pedido.perfiles, telefono: modalNotif.telefono }
                  };
                  setModalNotif(null);
                  await notificarPedidoListo(pedidoConTelefono);
                }}
                className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white transition flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar notificación
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}