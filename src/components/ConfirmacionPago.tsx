import { useEffect, useState } from 'react';

const ConfirmacionPago = () => {
  const [estado, setEstado] = useState<'cargando' | 'exito' | 'error'>('cargando');
  const [datosVenta, setDatosVenta] = useState<any>(null);

  // El token viene en la URL como ?token_ws=...
  const token = new URLSearchParams(window.location.search).get('token_ws');

  useEffect(() => {
    const confirmar = async () => {
      if (!token) {
        setEstado('error');
        return;
      }

      try {
        // Llamamos a la ruta que creamos en el server.ts
        const response = await fetch('http://localhost:3000/api/confirmar-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const resultado = await response.json();

        if (resultado.success) {
          setDatosVenta(resultado.data);
          setEstado('exito');
        } else {
          setEstado('error');
        }
      } catch (error) {
        setEstado('error');
      }
    };

    confirmar();
  }, [token]);

  if (estado === 'cargando') return <p>Confirmando tu pago, por favor espera...</p>;
  if (estado === 'error') return <p>Hubo un problema con tu pago. Reintenta más tarde.</p>;

  // Datos para el mensaje de WhatsApp
  const ordenCompra = datosVenta?.buy_order;
  const urlWhatsApp = `https://wa.me/569XXXXXXXX?text=Hola! Mi pago fue aprobado (Orden: ${ordenCompra}). ¿Cuándo puedo pasar a la sucursal de Maipú por el pedido de mi mascota?`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h2 className="text-3xl font-bold text-green-600 mb-4">¡Pago Exitoso!</h2>
        <p className="text-gray-600 mb-6">
          Tu transacción ha sido procesada. Los puntos de fidelización han sido cargados a tu perfil de cliente.
        </p>
        
        <a 
          href={urlWhatsApp} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition-colors"
        >
          Coordinar Retiro por WhatsApp
        </a>
      </div>
    </div>
  );
};

export default ConfirmacionPago;