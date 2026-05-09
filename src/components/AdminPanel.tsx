import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package, Plus, Trash2, Layers } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'inventario' | 'nuevo'>('pedidos');
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
      const { data: ventas, error: ventasError } = await supabase
        .from('ventas')
        .select(`id_venta, total_venta, fecha_venta, estado, id_cliente, perfiles!ventas_id_cliente_fkey(id, full_name)`)
        .neq('estado', 'completado')
        .order('fecha_venta', { ascending: false });

      if (ventasError) {
        console.error('Error al traer ventas:', ventasError);
      } else {
        console.log('Ventas obtenidas:', ventas);
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

  const procesarPedido = async (id: string, nombreCliente: string) => {
    const { error } = await supabase
      .from('ventas')
      .update({ estado: 'listo para retiro' })
      .eq('id_venta', id);

    if (!error) {
      const numeroTienda = '56912345678';
      const mensaje = `¡Hola ${nombreCliente}! Tu pedido #${id} ya está listo y apartado en nuestra tienda de Maipú. Puedes venir a retirarlo cuando gustes.`;
      const whatsappUrl = `https://wa.me/${numeroTienda}?text=${encodeURIComponent(mensaje)}`;
      window.open(whatsappUrl, '_blank');
      fetchData();
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

  if (loading) return <div className="p-10 text-center">Cargando datos de sucursal Maipú...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.26em] text-orange-500">Panel administrativo</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">Gestión de Pedidos e Inventario</h1>
              <p className="mt-2 text-sm text-slate-500">Aquí puedes revisar pedidos pendientes, actualizar stock, agregar productos y eliminar inventario.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`rounded-3xl px-5 py-3 text-sm font-semibold transition ${activeTab === 'pedidos' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setActiveTab('inventario')}
                className={`rounded-3xl px-5 py-3 text-sm font-semibold transition ${activeTab === 'inventario' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Inventario
              </button>
              <button
                onClick={() => setActiveTab('nuevo')}
                className={`rounded-3xl px-5 py-3 text-sm font-semibold transition ${activeTab === 'nuevo' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Nuevo producto
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            {activeTab === 'pedidos' && (
              <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Pedidos en preparación</h2>
                    <p className="mt-1 text-sm text-slate-500">Actualiza el estado y notifica al cliente cuando su pedido esté listo.</p>
                  </div>
                  <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Clock className="h-4 w-4" />
                    Recargar
                  </button>
                </div>

                {pedidos.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <PackageCheck className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-slate-500">No hay pedidos en preparación.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pedidos.map((pedido) => (
                      <article key={pedido.id_venta} className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-3">
                          <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">ID {pedido.id_venta}</span>
                          <h3 className="text-lg font-semibold text-slate-900">{pedido.perfiles?.full_name || 'Cliente desconocido'}</h3>
                          <p className="text-sm text-slate-500">Total: ${pedido.total_venta?.toLocaleString()} • Estado: {pedido.estado}</p>
                        </div>
                        <button
                          onClick={() => procesarPedido(pedido.id_venta, pedido.perfiles?.full_name)}
                          className="inline-flex items-center justify-center gap-2 rounded-3xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Marcar listo
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'inventario' && (
              <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Inventario y stock</h2>
                    <p className="mt-1 text-sm text-slate-500">Edita cantidades, elimina productos o revisa el stock actual.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      Productos: <span className="font-semibold text-slate-900">{productos.length}</span>
                    </div>
                    <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      Bajo stock: <span className="font-semibold text-orange-600">{productos.filter((prod) => prod.stock <= 5).length}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[28px] border border-slate-200">
                  <table className="min-w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-100 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Marca</th>
                        <th className="px-6 py-4">Stock</th>
                        <th className="px-6 py-4">Precio</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {productos.map((prod) => (
                        <tr key={prod.id_alimento} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{prod.nombre_producto}</div>
                            <div className="text-xs text-slate-500">{prod.categoria || 'Sin categoría'}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{prod.marca || 'N/A'}</td>
                          <td className="px-6 py-4">
                            {editingId === prod.id_alimento ? (
                              <input
                                type="number"
                                value={tempStock}
                                min={0}
                                onChange={(e) => setTempStock(Number(e.target.value))}
                                className="w-20 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none"
                              />
                            ) : (
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${prod.stock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                {prod.stock} unidades
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">${prod.precio?.toLocaleString() || '0'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {editingId === prod.id_alimento ? (
                                <button
                                  onClick={() => handleUpdateStock(prod.id_alimento)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingId(prod.id_alimento);
                                    setTempStock(prod.stock);
                                  }}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteProduct(prod.id_alimento)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'nuevo' && (
              <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-4">
                  <Layers className="h-6 w-6 text-orange-500" />
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Agregar nuevo producto</h2>
                    <p className="mt-1 text-sm text-slate-500">Completa los datos para registrar un producto en el inventario.</p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Nombre del producto
                    <input
                      value={newProduct.nombre_producto}
                      onChange={(e) => setNewProduct({ ...newProduct, nombre_producto: e.target.value })}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      placeholder="Ej. Alimento premium para perros"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Marca
                    <input
                      value={newProduct.marca}
                      onChange={(e) => setNewProduct({ ...newProduct, marca: e.target.value })}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      placeholder="Ej. Royal Canin"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Stock inicial
                    <input
                      type="number"
                      min={0}
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Precio
                    <input
                      type="number"
                      min={0}
                      value={newProduct.precio}
                      onChange={(e) => setNewProduct({ ...newProduct, precio: Number(e.target.value) })}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Categoría
                    <input
                      value={newProduct.categoria}
                      onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      placeholder="Ej. perros"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2">
                    Descripción
                    <textarea
                      value={newProduct.descripcion}
                      onChange={(e) => setNewProduct({ ...newProduct, descripcion: e.target.value })}
                      className="min-h-[120px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
                      placeholder="Descripción corta para el producto"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-500">Verifica los datos antes de guardar el producto en el inventario.</div>
                  <button
                    onClick={handleAddProduct}
                    className="inline-flex items-center gap-2 rounded-3xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.26em] text-orange-500">Resumen rápido</p>
              <div className="mt-6 space-y-4 text-slate-700">
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-4">
                  <span className="text-sm font-medium">Total pedidos</span>
                  <strong className="text-lg text-slate-900">{pedidos.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-slate-50 px-4 py-4">
                  <span className="text-sm font-medium">Productos registrados</span>
                  <strong className="text-lg text-slate-900">{productos.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-3xl bg-orange-50 px-4 py-4 text-orange-700">
                  <span className="text-sm font-medium">Artículos bajo stock</span>
                  <strong className="text-lg">{productos.filter((prod) => prod.stock <= 5).length}</strong>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.26em] text-orange-500">Acciones rápidas</p>
              <div className="mt-6 grid gap-3">
                <button
                  onClick={() => setActiveTab('inventario')}
                  className="inline-flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  <Edit3 className="h-4 w-4" />
                  Revisar inventario
                </button>
                <button
                  onClick={() => setActiveTab('nuevo')}
                  className="inline-flex items-center gap-2 rounded-3xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4" />
                  Agregar producto nuevo
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}