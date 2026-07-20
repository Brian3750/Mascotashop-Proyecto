import type { VercelRequest, VercelResponse } from "@vercel/node";
import { enviarNotificacionWhatsApp } from "../_lib/whatsapp";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { telefono, mensaje } = req.body || {};

    if (!telefono || !mensaje) {
      return res.status(400).json({ error: "Faltan datos (teléfono o mensaje)." });
    }

    const enviado = await enviarNotificacionWhatsApp({
      telefono,
      mensajePersonalizado: mensaje,
    });

    if (!enviado) {
      return res.status(400).json({ error: "No se pudo enviar el mensaje. Revisa el teléfono o la configuración de Twilio." });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error al enviar mensaje directo por WhatsApp:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
