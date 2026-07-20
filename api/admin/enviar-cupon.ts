import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";
import { transporter } from "../_lib/mailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { correo_cliente, nombre_cliente, codigo_cupon, descuento } = req.body || {};

    if (!correo_cliente || !codigo_cupon) {
      return res.status(400).json({ error: "Faltan datos obligatorios (Correo o Código)" });
    }

    const supabaseServerInstance = getSupabaseServer();

    const { data: usuarioAuth } = await supabaseServerInstance.auth.admin.listUsers();
    const clienteEncontrado = usuarioAuth?.users.find((u: any) => u.email === correo_cliente);

    const esPorcentaje = /%/.test(descuento || "");
    const valorDescuento = parseFloat((descuento || "20").replace(/[^\d.]/g, "")) || 20;

    console.log(`🎁 [ADMIN CUPON] Guardando: ${codigo_cupon} | ${esPorcentaje ? "porcentaje" : "monto_fijo"} | valor: ${valorDescuento}`);

    const { data: cuponeData, error: errorCupon } = await supabaseServerInstance
      .from("cupones")
      .insert([
        {
          codigo: codigo_cupon,
          id_cliente: clienteEncontrado?.id || null,
          descuento_tipo: esPorcentaje ? "porcentaje" : "monto_fijo",
          descuento_valor: valorDescuento,
        },
      ])
      .select();

    if (errorCupon) {
      console.error("❌ Error al registrar el cupón:", errorCupon.code, errorCupon.message, errorCupon.details);
      return res.status(400).json({ error: `No se pudo registrar el cupón: ${errorCupon.message}` });
    }

    console.log("✅ Cupón guardado exitosamente en Supabase:", cuponeData);

    await transporter.sendMail({
      from: `"MascotaShop VIP 🏆" <${process.env.SMTP_USER}>`,
      to: correo_cliente,
      subject: `¡Tienes un cupón de 20% de DESCUENTO de regalo! 🎁`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; background-color: #0b1329; color: #ffffff; padding: 35px; border-radius: 20px; text-align: center;">
          <span style="background-color: #f97316; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Beneficio Exclusivo - 20% OFF</span>
          <h2 style="color: #10b981; margin-top: 20px; font-size: 24px;">¡Felicidades ${nombre_cliente || "Cliente"}! 🏆</h2>
          <p style="color: #94a3b8; font-size: 16px;">El administrador de MascotaShop te ha otorgado un descuento especial del <strong style="color: #f97316;">20%</strong> en tu próxima compra.</p>
          <div style="background-color: #1e293b; padding: 25px; border-radius: 14px; margin: 25px 0; border: 2px dashed #f97316;">
            <p style="margin: 0; color: #94a3b8; font-size: 15px;">Tu código de cupón es:</p>
            <h1 style="margin: 12px 0; color: #f97316; letter-spacing: 5px; font-size: 32px;">${codigo_cupon}</h1>
            <p style="margin: 8px 0 0 0; color: #10b981; font-size: 14px; font-weight: bold;">✅ Descuento: 20% en tu próxima compra</p>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">Ingresa este código en el carrito al finalizar</p>
          </div>
          <p style="color: #94a3b8; margin-top: 20px; font-size: 14px;"><strong>¿Cómo usarlo?</strong></p>
          <ol style="color: #64748b; text-align: left; display: inline-block; font-size: 13px;">
            <li>Agrega productos a tu carrito 🛒</li>
            <li>En la sección "¿Tienes un cupón?", ingresa: <strong>${codigo_cupon}</strong></li>
            <li>El descuento del 20% se aplicará automáticamente ✅</li>
            <li>¡Paga normalmente! 💳</li>
          </ol>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
          <p style="font-size: 11px; color: #475569; margin: 0;">Este cupón es válido en una única compra y es intransferible. Si tienes dudas, contáctanos.</p>
        </div>
      `,
    });

    console.log(`🎁 [Admin] Cupón ${codigo_cupon} enviado con éxito a ${correo_cliente}`);
    return res.json({ success: true, message: "Cupón enviado exitosamente al cliente." });
  } catch (error: any) {
    console.error("❌ Error al enviar cupón desde el panel:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
