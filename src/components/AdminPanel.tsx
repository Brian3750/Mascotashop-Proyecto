import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package, Plus, Trash2, Layers, BarChart3 } from 'lucide-react';
// Importamos el nuevo Dashboard
import AnalyticsDashboard from './AnalyticsDashboard';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'pedidos' | 'inventario' | 'nuevo'>('analytics');
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = async () => {
    setLoading(true);

    try {
      // CORRECCIÓN DE CONSULTA: Usando nombres y apellidos de tu tabla perfiles
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
      } else {
        if (ventas) setPedidos(ventas);
      }

      const { data: inventario, error: inventarioError } = await supabase
        .from('inventario')
        .select('*')
        .order('nombre_producto', { ascending: true });

      if (inventarioError) {
        console.error('Error al traer inventario:', inventarioError);
      } else {
        if (inventario) setProductos(inventario);
      }
    } catch (error) {
      console.error('Error en fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- FUNCIÓN ACTUALIZADA CON LÓGICA DE PUNTOS ---
  const procesarPedido = async (id: string, nombreCliente: string, totalVenta: number, idCliente: string) => {
    try {
      // 1. Calculamos los puntos (1% de la venta)
      const puntosGanados = Math.floor(totalVenta * 0.01);

      // 2. Actualizamos el estado de la venta
      const { error: errorVenta } = await supabase
        .from('ventas')
        .update({ estado: 'listo para retiro' })
        .eq('id_venta', id);

      if (errorVenta) throw errorVenta;

      // 3. Obtenemos puntos actuales para sumar
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('puntos_acumulados')
        .eq('id', idCliente)
        .single();

      const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

      // 4. Guardamos los nuevos puntos
      const { error: errorPuntos } = await supabase
        .from('perfiles')
        .update({ puntos_acumulados: nuevosPuntos })
        .eq('id', idCliente);

      if (errorPuntos) throw errorPuntos;

      // 5. Notificación por WhatsApp
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

  if (loading) return <div className="p-10 text-center font-sans">Cargando datos de sucursal Maipú...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* HEADER DEL PANEL */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.26em] text-orange-500 font-bold">MascotaShop Admin</p>
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
            <div className="animate-in fade-in duration-500">
              <AnalyticsDashboard />
            </div>
          )}

          {/* VISTA DE PEDIDOS ACTUALIZADA CON PUNTOS */}
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