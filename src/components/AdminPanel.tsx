import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PackageCheck, MessageSquare, Clock, Edit3, Save, Package } from 'lucide-react';

export default function AdminPanel() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]); // Estado para inventario
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // Para el modo edición
  const [tempStock, setTempStock] = useState<number>(0);

  // 1. Cargar pedidos y productos
  const fetchData = async () => {
    setLoading(true);
    
    // Traer Pedidos
    const { data: ventas } = await supabase
      .from('ventas')
      .select(`id_venta, total_venta, fecha_venta, perfiles ( full_name )`)
      .eq('estado', 'En Preparación')
      .order('fecha_venta', { ascending: true });

    // Traer Inventario
    const { data: inventario } = await supabase
      .from('inventario')
      .select('*')
      .order('nombre_producto', { ascending: true });

    if (ventas) setPedidos(ventas);
    if (inventario) setProductos(inventario);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Lógica de Picking y Notificación
  const procesarPedido = async (id: string, nombreCliente: string) => {
    const { error } = await supabase
      .from('ventas')
      .update({ estado: 'Listo para Retiro' })
      .eq('id_venta', id);

    if (!error) {
      const numeroTienda = "56912345678";
      const mensaje = `¡Hola ${nombreCliente}! Tu pedido #${id.slice(0, 8)} ya está listo y apartado en nuestra tienda de Maipú. Puedes venir a retirarlo cuando gustes.`;
      const whatsappUrl = `https://wa.me/${numeroTienda}?text=${encodeURIComponent(mensaje)}`;
      window.open(whatsappUrl, '_blank');
      fetchData();
    }
  };

  // 3. ACTUALIZACIÓN DE STOCK (Lo que solicitaste)
  const handleUpdateStock = async (id_alimento: string) => {
    const { error } = await supabase
      .from('inventario')
      .update({ stock: tempStock })
      .eq('id_alimento', id_alimento);

    if (error) {
      alert("Error al actualizar stock");
    } else {
      alert("Stock actualizado correctamente");
      setEditingId(null);
      fetchData(); // Recarga ambos datos para mantener sincronía
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando datos de sucursal Maipú...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans text-left">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* SECCIÓN A: GESTIÓN DE PEDIDOS (PICKING) */}
        <section>
          <header className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-900">LoyalData Admin</h1>
              <p className="text-gray-500 italic">Gestión de Pedidos O2O - Maipú</p>
            </div>
            <button onClick={fetchData} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-orange-500">
              <Clock className="h-6 w-6" />
            </button>
          </header>

          {pedidos.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl shadow-sm text-center border-2 border-dashed border-gray-200">
              <PackageCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">No hay pedidos por preparar.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pedidos.map((pedido) => (
                <div key={pedido.id_venta} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-orange-500 bg-orange-50 px-2 py-1 rounded-md">ID: {pedido.id_venta.slice(0, 8)}</span>
                    <h3 className="font-bold text-gray-900 text-lg mt-1">{pedido.perfiles?.full_name || 'Cliente'}</h3>
                    <p className="text-gray-500 text-sm">Total Pedido: ${pedido.total_venta?.toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => procesarPedido(pedido.id_venta, pedido.perfiles?.full_name)}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-2xl transition-all"
                  >
                    <MessageSquare className="h-5 w-5" /> Listo
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECCIÓN B: GESTIÓN DE INVENTARIO (NUEVO) */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Package className="h-6 w-6 text-orange-500" />
            <h2 className="text-2xl font-black text-gray-900">Control de Stock</h2>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Producto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Stock Actual</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {productos.map((prod) => (
                  <tr key={prod.id_alimento} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{prod.nombre_producto}</p>
                      <p className="text-xs text-gray-400">{prod.marca}</p>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === prod.id_alimento ? (
                        <input 
                          type="number" 
                          value={tempStock}
                          onChange={(e) => setTempStock(Number(e.target.value))}
                          className="w-20 border-2 border-orange-500 rounded-lg px-2 py-1 focus:outline-none"
                        />
                      ) : (
                        <span className={`font-mono font-bold ${prod.stock < 5 ? 'text-red-500' : 'text-gray-700'}`}>
                          {prod.stock} unidades
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingId === prod.id_alimento ? (
                        <button 
                          onClick={() => handleUpdateStock(prod.id_alimento)}
                          className="text-green-600 hover:bg-green-50 p-2 rounded-xl"
                        >
                          <Save className="h-5 w-5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingId(prod.id_alimento);
                            setTempStock(prod.stock);
                          }}
                          className="text-gray-400 hover:text-orange-500 p-2 rounded-xl transition-colors"
                        >
                          <Edit3 className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}