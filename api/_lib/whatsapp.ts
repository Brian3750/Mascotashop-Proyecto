import twilio from "twilio";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export async function enviarNotificacionWhatsApp(datosTicket: any): Promise<boolean> {
  const telefono = datosTicket.telefono;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!twilioClient) {
    console.warn("⚠️ [WhatsApp] Twilio no configurado — revisa TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN.");
    return false;
  }

  if (!telefono) {
    console.warn("⚠️ [WhatsApp] Cliente sin teléfono registrado — mensaje no enviado.");
    return false;
  }

  let telefonoLimpio = String(telefono).replace(/\D/g, "");
  if (!telefonoLimpio.startsWith("56") && telefonoLimpio.length === 9) {
    telefonoLimpio = `56${telefonoLimpio}`;
  }
  const telefonoWA = `whatsapp:+${telefonoLimpio}`;

  const mensaje =
    datosTicket.mensajePersonalizado ||
    `🐾 *MascotaShop* — Confirmación de compra\n\n` +
      `Hola *${datosTicket.cliente}*! Tu pago fue procesado con éxito ✅\n\n` +
      `📋 Orden: *${datosTicket.buyOrder}*\n` +
      `💰 Total pagado: *$${Number(datosTicket.monto).toLocaleString("es-CL")}*\n` +
      `🕐 Fecha: *${datosTicket.fechaHora}*\n\n` +
      `¡Gracias por confiar en nosotros! 🐶🐱`;

  try {
    const msg = await twilioClient.messages.create({
      from: fromNumber,
      to: telefonoWA,
      body: mensaje,
    });
    console.log(`✅ [WhatsApp Twilio] Mensaje enviado a ${telefonoWA} — SID: ${msg.sid}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [WhatsApp Twilio] Error al enviar a ${telefonoWA}:`, error.message);
    return false;
  }
}
