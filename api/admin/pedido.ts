import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";
import { transporter } from "../_lib/mailer";
import { enviarNotificacionWhatsApp } from "../_lib/whatsapp";

// Endpoint combinado: antes eran dos funciones separadas (pedido-estado y pedido-listo).
// Se unieron en una sola para no superar el límite de 12 funciones serverless
// del plan Hobby de Vercel. El campo "accion" en el body decide qué hacer.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { accion } = req.body || {};

  if (accion === "listo") {
    return marcarPedidoListo(req, res);
  }
  if (accion === "estado") {
    return cambiarEstado(req, res);
  }
  return res.status(400).json({ error: "Falta o es inválido el campo 'accion' (usa 'estado' o 'listo')." });
}

async function cambiarEstado(req: VercelRequest, res: VercelResponse) {
  try {
    const { id_venta, estado } = req.body || {};
    if (!id_venta || !estado) return res.status(400).json({ error: "Faltan datos." });

    const ESTADOS_VALIDOS = ["en preparación", "apartado", "listo para retiro", "completado"];
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido: ${estado}` });
    }

    const supabaseServerInstance = getSupabaseServer();
    const { error } = await supabaseServerInstance.from("ventas").update({ estado }).eq("id_venta", id_venta);

    if (error) throw error;
    return res.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error al cambiar estado:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function marcarPedidoListo(req: VercelRequest, res: VercelResponse) {
  try {
    const { id_venta, id_cliente, nombre_cliente, correo_cliente, telefono_cliente, total_venta } = req.body || {};

    if (!id_venta || !id_cliente) {
      return res.status(400).json({ error: "Faltan datos del pedido." });
    }

    const supabaseServerInstance = getSupabaseServer();

    const { error: errorEstado } = await supabaseServerInstance.from("ventas").update({ estado: "listo para retiro" }).eq("id_venta", id_venta);
    if (errorEstado) throw errorEstado;

    const puntosGanados = Math.floor(Number(total_venta) * 0.01);

    const { data: perfil } = await supabaseServerInstance.from("perfiles").select("puntos_acumulados, categoria_rfm").eq("id", id_cliente).single();

    const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

    await supabaseServerInstance.from("perfiles").update({ puntos_acumulados: nuevosPuntos }).eq("id", id_cliente);

    console.log("📊 Intentando guardar historial (retiro pedido):", { id_cliente, tipo_movimiento: "Ganados", puntos: puntosGanados, id_venta });

    const { error: errorHistorialRetiro, data: datosHistorialRetiro } = await supabaseServerInstance
      .from("historial_puntos")
      .insert([
        {
          id_cliente,
          tipo_movimiento: "Ganados",
          puntos: puntosGanados,
          id_venta,
          descripcion: `Puntos por retiro pedido #${id_venta}`,
        },
      ])
      .select();

    if (errorHistorialRetiro) {
      console.error("⚠️ Error al registrar historial (retiro):", errorHistorialRetiro.code, errorHistorialRetiro.message, errorHistorialRetiro.details);
    } else {
      console.log("✅ Historial de puntos (retiro) guardado:", datosHistorialRetiro);
    }

    const categoria = (perfil?.categoria_rfm || "").toLowerCase();
    const esRiesgo = categoria.includes("riesgo") || categoria.includes("perder") || categoria.includes("hibernando");
    const mensajeExtra = esRiesgo ? " ¡Te extrañamos, vuelve pronto! 🐾❤️" : "";

    const mensajeWsp = `¡Hola ${nombre_cliente}! 🐾 Tu pedido #${id_venta} de MascotaShop ya está listo para retiro en nuestra sucursal. Ganaste ${puntosGanados} puntos de fidelización. Total acumulado: ${nuevosPuntos} pts.${mensajeExtra}`;

    if (correo_cliente) {
      await transporter.sendMail({
        from: `"MascotaShop 🐾" <${process.env.SMTP_USER}>`,
        to: correo_cliente,
        subject: `¡Tu pedido #${id_venta} está listo para retiro! 🎉`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;padding:30px;border-radius:16px;background:#fff;">
            <h2 style="color:#f97316;margin-top:0;">¡Tu pedido está listo, ${nombre_cliente}! 🐾</h2>
            <p style="color:#475569;">Ya puedes pasar a retirar tu pedido <strong>#${id_venta}</strong> a nuestra sucursal.</p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;padding:16px;border-radius:12px;margin:20px 0;">
              <p style="margin:0;color:#9a3412;font-size:14px;"><strong>📍 Dirección:</strong> MascotaShop — Maipú, Santiago</p>
              <p style="margin:8px 0 0;color:#9a3412;font-size:14px;"><strong>🕐 Horario:</strong> Lunes a Sábado 10:00 – 20:00 hrs</p>
            </div>
            <p style="color:#475569;">Por esta compra ganaste <strong style="color:#f97316;">+${puntosGanados} puntos</strong>. Total acumulado: <strong>${nuevosPuntos} pts</strong>.</p>
            ${esRiesgo ? '<p style="color:#e11d48;">¡Te extrañamos! Fue genial tenerte de vuelta. 🐾❤️</p>' : ""}
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;">
            <p style="font-size:11px;color:#94a3b8;text-align:center;">MascotaShop SpA — Sistema LoyalData 2026</p>
          </div>
        `,
      });
    }

    const enviado = await enviarNotificacionWhatsApp({
      cliente: nombre_cliente,
      telefono: telefono_cliente,
      buyOrder: id_venta,
      monto: total_venta,
      fechaHora: new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" }),
      mensajePersonalizado: mensajeWsp,
    });

    console.log(`✅ Pedido #${id_venta} marcado como listo. Correo enviado a ${correo_cliente}. WhatsApp: ${enviado ? "enviado ✅" : "no enviado ⚠️"}`);

    return res.json({ success: true, whatsappEnviado: enviado, puntosGanados, nuevosPuntos });
  } catch (error: any) {
    console.error("❌ Error al marcar pedido listo:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
