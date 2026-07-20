import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";
import { enviarNotificacionWhatsApp } from "../_lib/whatsapp";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { telefono_cliente, nombre_cliente, codigo_cupon, descuento, correo_cliente } = req.body || {};

    if (!telefono_cliente || !codigo_cupon) {
      return res.status(400).json({ error: "Faltan datos obligatorios (Teléfono o Código)" });
    }

    const supabaseServerInstance = getSupabaseServer();

    let idCliente = null;
    if (correo_cliente) {
      const { data: usuarioAuth } = await supabaseServerInstance.auth.admin.listUsers();
      const clienteEncontrado = usuarioAuth?.users.find((u: any) => u.email === correo_cliente);
      idCliente = clienteEncontrado?.id || null;
    }

    const esPorcentaje = /%/.test(descuento || "");
    const valorDescuento = parseFloat((descuento || "20").replace(/[^\d.]/g, "")) || 20;

    const { data: cuponExistente } = await supabaseServerInstance.from("cupones").select("id_cupon").eq("codigo", codigo_cupon).maybeSingle();

    if (!cuponExistente) {
      const { error: errorInsert } = await supabaseServerInstance.from("cupones").insert([
        {
          codigo: codigo_cupon,
          id_cliente: idCliente,
          descuento_tipo: esPorcentaje ? "porcentaje" : "monto_fijo",
          descuento_valor: valorDescuento,
        },
      ]);

      if (errorInsert) {
        console.error("❌ Error al guardar cupón en BD:", errorInsert.message);
        return res.status(400).json({ error: `No se pudo guardar el cupón: ${errorInsert.message}` });
      }
      console.log(`✅ Cupón ${codigo_cupon} guardado en Supabase.`);
    } else {
      console.log(`ℹ️ Cupón ${codigo_cupon} ya existía en la BD — no se duplica.`);
    }

    const nombre = nombre_cliente || "Amigo/a";
    const descuentoTexto = esPorcentaje ? `*${valorDescuento}% DE DESCUENTO*` : `*$${valorDescuento.toLocaleString("es-CL")} de descuento*`;

    const mensajeCupon =
      `🎁 *MascotaShop* — Beneficio Exclusivo\n\n` +
      `¡Hola *${nombre}*! Queremos consentir a tu mascota. 🐾\n\n` +
      `Te regalamos un cupón de ${descuentoTexto}.\n\n` +
      `🏷️ Código: *${codigo_cupon}*\n\n` +
      `📝 Cómo usarlo:\n` +
      `1️⃣ Agrega productos al carrito\n` +
      `2️⃣ En "¿Tienes un cupón?" ingresa: ${codigo_cupon}\n` +
      `3️⃣ El descuento se aplica automáticamente ✅\n` +
      `4️⃣ ¡Paga normalmente! 💳\n\n` +
      `¡Te esperamos en MascotaShop! 🛍️`;

    const enviado = await enviarNotificacionWhatsApp({
      telefono: telefono_cliente,
      mensajePersonalizado: mensajeCupon,
    });

    if (!enviado) {
      return res.status(400).json({ error: "Cupón guardado en BD pero no se pudo enviar el WhatsApp." });
    }

    console.log(`🎁 [Admin] Cupón ${codigo_cupon} enviado por WhatsApp a ${telefono_cliente}`);
    return res.json({ success: true, message: "Cupón guardado y enviado por WhatsApp." });
  } catch (error: any) {
    console.error("❌ Error al enviar cupón por WhatsApp:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
