import React from 'react';
import { CheckCircle, ArrowLeft, MessageSquare } from 'lucide-react';
import { formatCLP } from '../lib/utils'; // Tu función de formateo de dinero

interface TicketPagoProps {
  datos: {
    buyOrder: string;
    fechaHora: string;
    cliente: string;
    monto: number;
  };
  onVolver: () => void;
}

export default function TicketPago({ datos, onVolver }: TicketPagoProps) {
  const { buyOrder, fechaHora, cliente, monto } = datos;

  // Función para construir el texto formateado y abrir WhatsApp
  const handleCompartirWhatsApp = () => {
    const mensaje = encodeURIComponent(
      `🛒 *¡COMPROBANTE DE COMPRA!* 🐾\n\n` +
      `👤 *Cliente:* ${cliente}\n` +
      `🔢 *N° de Orden:* ${buyOrder}\n` +
      `📅 *Fecha y Hora:* ${fechaHora}\n` +
      `💰 *Total Pagado:* ${formatCLP(monto)}\n\n` +
      `✅ _Gracias por tu compra. Tu pedido está siendo procesado con éxito._`
    );

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${mensaje}`;
    window.open(urlWhatsApp, '_blank');
  };

  return (
    <div className="min-h-[80vh] bg-gray-50 py-12 px-4 flex flex-col items-center justify-center font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
        
        {/* Decoración superior estética */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-orange-500"></div>

        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
          <CheckCircle className="h-10 w-10" />
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-1">¡Pago Confirmado!</h2>
        <p className="text-sm text-gray-500 mb-6">Tu comprobante de compra ha sido generado con éxito.</p>

        {/* Cuerpo del Ticket tipo Voucher */}
        <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-4 border border-dashed border-gray-200">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">N° de Orden</span>
            <p className="font-mono text-sm font-bold text-gray-800">{buyOrder}</p>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Fecha y Hora</span>
            <p className="text-sm font-semibold text-gray-700">{fechaHora}</p>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Titular de la Compra</span>
            <p className="text-sm font-semibold text-gray-700">{cliente}</p>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-gray-900">Total Pagado</span>
            <span className="text-xl font-black text-orange-500">{formatCLP(monto)}</span>
          </div>
        </div>

        {/* Recordatorio del envío automático */}
        <div className="mt-6 p-4 bg-orange-50 rounded-xl text-xs text-orange-700 font-medium flex items-center gap-2 justify-center">
          <span>📲 Un respaldo de este ticket se envió automáticamente a tu WhatsApp.</span>
        </div>

        {/* ACCIÓN NUEVA: Botón para compartir por WhatsApp en el cliente */}
        <button
          onClick={handleCompartirWhatsApp}
          className="mt-6 w-full bg-[#25D366] hover:bg-[#20ba56] text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <MessageSquare className="h-4 w-4" />
          Compartir por WhatsApp
        </button>

        {/* Botón de salida para limpiar estados y volver de manera segura */}
        <button
          onClick={onVolver}
          className="mt-3 w-full bg-gray-900 hover:bg-orange-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Volver a la Tienda
        </button>
      </div>
    </div>
  );
}