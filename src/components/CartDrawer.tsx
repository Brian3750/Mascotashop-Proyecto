import React from 'react';
import { motion, AnimatePresence } from "motion/react";
import { X, ShoppingBag, Trash2, Plus, Minus, Loader2 } from "lucide-react"; 
import { formatCLP } from "../lib/utils";
import { Product } from "../data/products";
import { supabase } from "../lib/supabaseClient"; 

// Extendemos la interfaz para asegurar que TypeScript reconozca el campo stock
export type CartItem = Product & {
  quantity: number;
  stock?: number; // 👈 Agregado opcional por si no todas las vistas mapean el stock de inmediato
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: (userId?: string, codigoCupon?: string) => Promise<void>; 
  isProcessing: boolean;           
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  onCheckout, 
  isProcessing, 
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const [codigoCupon, setCodigoCupon] = React.useState('');
  const [cuponValidado, setCuponValidado] = React.useState<{ tipo: string; valor: number; codigo: string } | null>(null);
  const [cuponError, setCuponError] = React.useState('');
  const [validandoCupon, setValidandoCupon] = React.useState(false);

  const API = import.meta.env.VITE_API_URL || window.location.origin;

  const validarCupon = async () => {
    if (!codigoCupon.trim()) return;
    setValidandoCupon(true);
    setCuponError('');
    setCuponValidado(null);
    try {
      const res = await fetch(`${API}/api/validar-cupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoCupon.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCuponError(data.error || 'Cupón inválido');
      } else {
        setCuponValidado({ tipo: data.descuento_tipo, valor: data.descuento_valor, codigo: data.codigo });
      }
    } catch {
      setCuponError('Error de conexión al validar el cupón');
    } finally {
      setValidandoCupon(false);
    }
  };

  const calcularDescuento = () => {
    if (!cuponValidado) return 0;
    if (cuponValidado.tipo === 'monto_fijo') return Math.min(cuponValidado.valor, total);
    return total * (cuponValidado.valor / 100);
  };

  const totalConDescuento = total - calcularDescuento();

  // =========================================================================
  // 🔥 MANEJADOR DE INCREMENTO CON CONTROL DE STOCK CENTRALIZADO
  // =========================================================================
  const handleSafeIncrement = (item: CartItem) => {
    // Si el producto trae stock definido desde Supabase (ej: stock = 3)
    if (item.stock !== undefined && item.quantity >= item.stock) {
      alert(`⚠️ Lo sentimos, solo quedan ${item.stock} unidades disponibles de "${item.name}".`);
      return; // Bloquea la ejecución y no actualiza
    }
    
    // Si hay stock disponible o no está definido, permite sumar 1
    onUpdateQuantity(item.id, 1);
  };
  // =========================================================================

  const handleInterceptedCheckout = async () => {
    let currentUserId: string | undefined = undefined;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentUserId = user.id;
        localStorage.setItem('id_usuario_checkout', user.id);
        console.log("🛡️ ID de usuario asegurado para Webpay:", user.id);
      }
    } catch (error) {
      console.warn("⚠️ No se pudo pre-guardar el ID de usuario:", error);
    } finally {
      await onCheckout(currentUserId, codigoCupon.trim() || undefined);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-6 w-6 text-orange-500" />
                <h2 className="text-xl font-bold text-gray-900">Tu Carrito</h2>
                <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">
                  {items.length} items
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.length > 0 ? (
                items.map((item) => {
                  // Validamos si el botón '+' debe salir deshabilitado visualmente
                  const alcanzóLímiteStock = item.stock !== undefined && item.quantity >= item.stock;

                  return (
                    <div key={item.id} className="flex gap-4 group">
                      <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-gray-900 text-sm line-clamp-1">
                            {item.name}
                          </h3>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Pequeño indicador del stock disponible en tienda */}
                        {item.stock !== undefined && (
                          <p className="text-[11px] text-gray-400 mb-1">
                            Disponibles: <span className="font-bold text-gray-600">{item.stock} u.</span>
                          </p>
                        )}

                        <p className="text-orange-600 font-bold text-sm mb-3">
                          {formatCLP(item.price)}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              disabled={item.quantity <= 1 || isProcessing}
                              className="p-1 hover:bg-white rounded-md disabled:opacity-30 transition-all"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold">
                              {item.quantity}
                            </span>
                            
                            {/* Botón Mas (+) modificado para evaluar el stock o deshabilitarse */}
                            <button
                              onClick={() => handleSafeIncrement(item)}
                              disabled={isProcessing || alcanzóLímiteStock}
                              className={`p-1 rounded-md transition-all ${alcanzóLímiteStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'hover:bg-white text-gray-900'}`}
                              title={alcanzóLímiteStock ? "Máximo stock alcanzado" : "Añadir unidad"}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-gray-900">
                            {formatCLP(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-orange-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Tu carrito está vacío</h3>
                    <p className="text-gray-500 text-sm">¡Agrega algo delicioso para tu mascota!</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all"
                  >
                    Seguir comprando
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    ¿Tienes un cupón?
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={codigoCupon}
                      onChange={(e) => {
                        setCodigoCupon(e.target.value.toUpperCase());
                        setCuponValidado(null);
                        setCuponError('');
                      }}
                      placeholder="Ej: VIP-MASC-2026"
                      disabled={isProcessing || validandoCupon}
                      className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono tracking-wider outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={validarCupon}
                      disabled={!codigoCupon.trim() || validandoCupon || isProcessing}
                      className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-40"
                    >
                      {validandoCupon ? '...' : 'Aplicar'}
                    </button>
                  </div>

                  {/* Feedback del cupón */}
                  {cuponError && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">❌ {cuponError}</p>
                  )}
                  {cuponValidado && (
                    <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                      ✅ Cupón válido — {cuponValidado.tipo === 'monto_fijo' ? `$${cuponValidado.valor.toLocaleString('es-CL')} de descuento` : `${cuponValidado.valor}% de descuento`}
                    </p>
                  )}
                </div>

                {/* Resumen de precios */}
                <div className="space-y-2 bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="text-sm font-bold text-gray-900">{formatCLP(total)}</span>
                  </div>

                  {cuponValidado && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="text-sm font-semibold">🎁 Descuento ({cuponValidado.tipo === 'monto_fijo' ? `$${cuponValidado.valor.toLocaleString('es-CL')}` : `${cuponValidado.valor}%`})</span>
                      <span className="text-sm font-bold">-{formatCLP(calcularDescuento())}</span>
                    </div>
                  )}

                  <div className={`flex justify-between items-center px-3 py-2 rounded-lg border mt-1 ${cuponValidado ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                    <span className={`text-sm font-bold ${cuponValidado ? 'text-emerald-900' : 'text-orange-900'}`}>Total a Pagar</span>
                    <span className={`text-lg font-black ${cuponValidado ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {formatCLP(cuponValidado ? totalConDescuento : total)}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 text-center">
                  Transacción procesada vía Supabase
                </p>
                <button 
                  onClick={handleInterceptedCheckout} 
                  disabled={isProcessing}
                  className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Procesando Venta...
                    </>
                  ) : (
                    "Pagar"
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}