import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../src/lib/supabaseServer.js";
import { tx } from "./_lib/transbank.js";
import { transporter } from "./_lib/mailer.js";
import { enviarNotificacionWhatsApp } from "./_lib/whatsapp.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { cartItems, id_usuario, id_cupon_aplicado } = req.body || {};
  const token = req.body?.token || req.body?.token_ws;
  if (!token) return res.status(400).json({ error: "Token no recibido" });

  try {
    console.log("1. Recibiendo token de Transbank...");
    const commitResponse = await tx.commit(token);
    const supabaseServerInstance = getSupabaseServer();

    if (commitResponse.response_code === 0) {
      console.log("2. ✅ Pago aprobado. Registrando en Supabase...");

      const idClienteFinal = id_usuario || commitResponse.session_id;

      const { data: ventaData, error: errorVenta } = await supabaseServerInstance
        .from("ventas")
        .insert([{ total_venta: commitResponse.amount, id_cliente: idClienteFinal, estado: "completado" }])
        .select();

      if (errorVenta) {
        console.error("❌ ERROR TABLA VENTAS:", errorVenta.message, errorVenta);
        throw errorVenta;
      }

      const nuevaVenta = ventaData[0];
      console.log(`3. ✨ Venta ${nuevaVenta.id_venta} creada.`);

      if (id_cupon_aplicado) {
        const { error: errorMarcarCupon } = await supabaseServerInstance
          .from("cupones")
          .update({ usado: true, id_venta_uso: nuevaVenta.id_venta })
          .eq("id_cupon", id_cupon_aplicado)
          .eq("usado", false);

        if (errorMarcarCupon) {
          console.error(`⚠️ No se pudo marcar el cupón ${id_cupon_aplicado} como usado:`, errorMarcarCupon.message);
        } else {
          console.log(`🎟️ Cupón ${id_cupon_aplicado} marcado como usado.`);
        }
      }

      if (cartItems && cartItems.length > 0) {
        const detalles = cartItems.map((item: any) => ({
          id_venta: nuevaVenta.id_venta,
          id_alimento: item.id,
          cantidad: item.quantity,
          precio_unitario: item.price,
        }));

        const { error: errorDetalle } = await supabaseServerInstance.from("detalle_ventas").insert(detalles);

        if (errorDetalle) {
          console.error("❌ ERROR TABLA DETALLES:", errorDetalle.message);
        } else {
          console.log("4. 📦 Detalles guardados con éxito.");
          console.log("5. 📉 Actualizando inventario...");
          for (const item of cartItems) {
            const { error: errorStock } = await supabaseServerInstance.rpc("discount_stock", {
              row_id: item.id,
              quantity_to_subtract: item.quantity,
            });
            if (errorStock) {
              console.error(`⚠️ No se pudo descontar stock para el producto ${item.id}:`, errorStock.message);
            }
          }
          console.log("✅ Proceso de stock finalizado.");
        }
      }

      let nombreClienteTicket = "Cliente MascotaShop";
      let telefonoClienteTicket: string | null = null;

      if (id_usuario) {
        console.log("6. 🎁 Calculando y guardando puntos de fidelización...");
        const puntosGanados = Math.floor(commitResponse.amount * 0.01);

        const { data: perfil, error: errorPerfil } = await supabaseServerInstance
          .from("perfiles")
          .select("puntos_acumulados, nombres, apellidos, telefono")
          .eq("id", id_usuario)
          .single();

        if (errorPerfil) {
          console.warn(`⚠️ No se encontró perfil para usuario ${id_usuario}:`, errorPerfil.message);
        } else {
          if (perfil?.nombres) {
            nombreClienteTicket = `${perfil.nombres} ${perfil.apellidos || ""}`.trim();
          }
          if (perfil?.telefono) {
            telefonoClienteTicket = perfil.telefono;
          }

          const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

          const { error: errorPuntos } = await supabaseServerInstance
            .from("perfiles")
            .update({ puntos_acumulados: nuevosPuntos })
            .eq("id", id_usuario);

          if (errorPuntos) {
            console.error(`❌ Error al guardar puntos para usuario ${id_usuario}:`, errorPuntos.message);
          } else {
            console.log(`✅ Puntos guardados: +${puntosGanados} puntos. Total: ${nuevosPuntos} puntos`);

            const { error: errorHistorial, data: datosHistorial } = await supabaseServerInstance
              .from("historial_puntos")
              .insert([
                {
                  id_cliente: id_usuario,
                  tipo_movimiento: "Ganados",
                  puntos: puntosGanados,
                  id_venta: nuevaVenta.id_venta,
                  descripcion: `Puntos por compra #${nuevaVenta.id_venta}`,
                },
              ])
              .select();

            if (errorHistorial) {
              console.error("⚠️ No se pudo registrar el historial de puntos:", errorHistorial.code, errorHistorial.message, errorHistorial.details);
            } else {
              console.log("✅ Historial de puntos guardado:", datosHistorial);
            }
          }
        }

        console.log("7. 📊 Ejecutando motor analítico RFM...");
        const { error: rfmError } = await supabaseServerInstance.rpc("actualizar_segmentacion_rfm");
        if (rfmError) {
          console.error("⚠️ Error al recalcular la segmentación RFM:", rfmError.message);
        } else {
          console.log("✅ Segmentación RFM recalculada con éxito.");
        }
      } else {
        console.warn("⚠️ No se recibió id_usuario. Los puntos ni el análisis RFM se guardarán.");
      }

      const fechaChile = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
      const estructuraTicket = {
        buyOrder: commitResponse.buy_order,
        fechaHora: fechaChile,
        cliente: nombreClienteTicket,
        monto: commitResponse.amount,
        telefono: telefonoClienteTicket,
      };

      await enviarNotificacionWhatsApp(estructuraTicket);

      const destinoCorreoCliente = req.body.email_usuario || process.env.CLIENT_TEST_EMAIL || "brian.jovani.g@gmail.com";
      const listaProductosHTML =
        cartItems && cartItems.length > 0
          ? cartItems.map((p: any) => `<li>${p.quantity || 1}x ${p.name || "Producto"} - $${(p.price * (p.quantity || 1)).toLocaleString("es-CL")}</li>`).join("")
          : "<li>Detalle de productos en procesamiento por LoyalData</li>";

      transporter
        .sendMail({
          from: `"MascotaShop 🐾" <${process.env.SMTP_USER}>`,
          to: destinoCorreoCliente,
          subject: `Confirmación de Compra #${estructuraTicket.buyOrder} - MascotaShop`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #f97316; margin-top: 0;">¡Gracias por tu compra en MascotaShop! 🐾</h2>
              <p style="color: #475569;">Hola <strong>${estructuraTicket.cliente}</strong>, tu pago ha sido procesado con éxito a través de Transbank.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #1e293b;"><strong>Orden de Compra:</strong> ${estructuraTicket.buyOrder}</p>
              <p style="color: #1e293b;"><strong>Detalle de tu pedido:</strong></p>
              <ul style="color: #475569; padding-left: 20px;">${listaProductosHTML}</ul>
              <h3 style="color: #0f172a; background-color: #f8fafc; padding: 12px; border-radius: 8px; display: inline-block;">
                Total Pagado: $${estructuraTicket.monto.toLocaleString("es-CL")}
              </h3>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">MascotaShop SpA — Panel Analítico LoyalData 2026</p>
            </div>
          `,
        })
        .then(() => {
          console.log("📧 [Nodemailer] Notificación enviada con éxito al cliente.");
        })
        .catch((err) => {
          console.error("❌ [Nodemailer] Error al despachar correo:", err.message);
        });

      return res.json({ success: true, data: estructuraTicket });
    } else {
      console.warn(`⚠️ Pago rechazado por Transbank (${commitResponse.response_code}). Persistiendo orden...`);

      const { error: errorSupabasePendiente } = await supabaseServerInstance.from("ventas").insert([
        {
          id_venta: Number(commitResponse.buy_order) || Math.floor(Date.now() / 1000),
          id_cliente: id_usuario || "d5e10331-fefd-430c-b1b6-a4e90fffcb43",
          total_venta: commitResponse.amount || 0,
          estado: "Pendiente",
        },
      ]);

      if (errorSupabasePendiente) {
        console.error("❌ No se pudo inyectar el pedido Pendiente tras rechazo:", errorSupabasePendiente.message);
      } else {
        console.log("✨ Intento de compra fallido registrado como 'Pendiente' en Supabase de forma automatizada.");
      }

      return res.json({ success: false, data: commitResponse });
    }
  } catch (error: any) {
    console.error("❌ Error Crítico:", error.message);
    res.status(500).json({ error: "Error interno en el servidor" });
  }
}
