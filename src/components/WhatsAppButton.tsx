import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function WhatsAppButton() {
  const [datosCRM, setDatosCRM] = useState({
    nombreCliente: "un cliente",
    nombreMascota: ""
  });

  useEffect(() => {
    const fetchCRMData = async () => {
      // 1. Obtener Sesión (Servicio de Identidad)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const nombre = session.user.user_metadata?.full_name || "Cliente";
        
        // 2. Intentar obtener la primera mascota registrada (Servicio Biométrico)
        const { data: mascotas } = await supabase
          .from('mascotas')
          .select('nombre')
          .eq('id_cliente', session.user.id)
          .limit(1);

        setDatosCRM({
          nombreCliente: nombre,
          nombreMascota: mascotas && mascotas.length > 0 ? mascotas[0].nombre : ""
        });
      }
    };

    fetchCRMData();

    // Escuchar cambios de auth para actualizar el mensaje dinámicamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCRMData();
    });

    return () => subscription.unsubscribe();
  }, []);

// 3. Construcción del Mensaje Parametrizado (Pilar B del CRM)
  const construirMensaje = () => {
    const base = `Hola MascotaShop Maipú, soy ${datosCRM.nombreCliente}.`;
    const detalleMascota = datosCRM.nombreMascota 
      ? ` Quisiera coordinar el retiro del pedido para ${datosCRM.nombreMascota}.`
      : ` Quisiera consultar por el stock para retiro en tienda.`;
    
    return encodeURIComponent(base + detalleMascota);
  };

  // USA ESTE FORMATO DE URL:
  // Reemplaza 56912345678 por tu número real de pruebas
  const numeroTelefono = "56945685662"; 
  const whatsappUrl = `https://wa.me/${numeroTelefono}?text=${construirMensaje()}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group"
      title="Soporte de Retiro Maipú"
    >
      <MessageCircle className="h-6 w-6" />
      
      {/* Tooltip dinámico que refuerza el modelo Pick-up */}
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-sm whitespace-nowrap">
        Coordinar Retiro Maipú
      </span>
    </a>
  );
}