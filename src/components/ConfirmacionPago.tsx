import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Importamos tu cliente de Supabase del Frontend

const ConfirmacionPago = () => {
  const [estado, setEstado] = useState<'cargando' | 'exito' | 'error'>('cargando');
  const [datosVenta, setDatosVenta] = useState<any>(null);

  // El token viene en la URL devuelta por Transbank como ?token_ws=...
  const token = new URLSearchParams(window.location.search).get('token_ws');

  useEffect(() => {
    const confirmar = async () => {
      if (!token) {
        setEstado('error');
        return;
      }

      try {
        // Recuperamos los artículos del carro para mandárselos al backend
        // (Reemplaza 'cartItems' si en tu app usas otro nombre en el localStorage)
        const cartItemsStorage = localStorage.getItem('cartItems');
        const cartItems = cartItemsStorage ? JSON.parse(cartItemsStorage) : [];

        // --- 🛡️ ESTRATEGIA TRIPLE PARA RESCATAR EL ID DEL USUARIO ---
        // 1. Intentamos leerlo del localStorage (El método más seguro al volver de Webpay)
        let userId = localStorage.getItem('id_usuario_checkout') || null;

        // 2. Si no estaba ahí, intentamos por sesión rápida en memoria
        if (!userId) {
          const { data: sessionData } = await supabase.auth.getSession();
          userId = sessionData.session?.user?.id || null;
        }

        // 3. Si sigue sin aparecer, probamos por usuario directo
        if (!userId) {
          const { data: userData } = await supabase.auth.getUser();
          userId = userData.user?.id || null;
        }
        // -------------------------------------------------------------

        // Llamamos a la ruta actualizada en el server.ts inyectando el id_usuario verificado
        const response = await fetch('http://localhost:3000/api/confirmar-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token,
            cartItems, // Mandamos el carrito para que descuente el stock en Supabase
            id_usuario: userId // 👈 PASAMOS EL UUID SEGURO OBTENIDO DE LAS 3 VÍAS
          })
        });

        const resultado = await response.json();

        if (resultado.success) {
          setDatosVenta(resultado.data);
          setEstado('exito');
          // Limpiamos el carro del localStorage ya que la compra fue exitosa
          localStorage.removeItem('cartItems');
          // Limpiamos también el ID de respaldo auxiliar usado para el checkout
          localStorage.removeItem('id_usuario_checkout');
        } else {
          setEstado('error');
        }
      } catch (error) {
        console.error("❌ Error en confirmación frontend:", error);
        setEstado('error');
      }
    };

    confirmar();
  }, [token]);

  if (estado === 'cargando') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-slate-50">
        <p className="text-xl font-medium text-slate-700 animate-pulse">
          🔄 Confirmando tu pago con Transbank, por favor espera...
        </p>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
          <h2 className="text-3xl font-bold text-red-500 mb-4">❌ Pago Cancelado o Rechazado</h2>
          <p className="text-gray-600 mb-6">
            Hubo un problema al validar tu transacción con Webpay o decidiste cancelar la operation. Reintenta el proceso de pago.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Volver a la Tienda
          </button>
        </div>
      </div>
    );
  }

  // Datos para el mensaje de WhatsApp directo a la sucursal
  const ordenCompra = datosVenta?.buy_order || "N/A";
  const urlWhatsApp = `https://wa.me/569XXXXXXXX?text=¡Hola! Mi pago fue aprobado con éxito (Orden de Compra: ${ordenCompra}). ¿Cuándo puedo pasar a la sucursal de Maipú a retirar el pedido de mi mascota?`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-green-600 mb-4">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          Tu transacción ha sido procesada de manera correcta. El inventario ha sido actualizado y los datos de tu compra ya están registrados de forma segura.
        </p>
        
        <a 
          href={urlWhatsApp} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition-colors w-full shadow-md shadow-green-200 mb-4"
        >
          💬 Coordinar Retiro por WhatsApp
        </a>

        <button 
          onClick={() => window.location.href = '/'}
          className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          Seguir Explorando la Tienda
        </button>
      </div>
    </div>
  );
};

export default ConfirmacionPago;