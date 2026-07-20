import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../src/lib/supabaseServer";
import { tx } from "./_lib/transbank";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { sessionId, buyOrder, cartItems, codigoCupon } = req.body || {};

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    const supabaseServerInstance = getSupabaseServer();

    // 1. Recalcular el total desde los precios reales en Supabase
    let totalReal = 0;

    for (const item of cartItems) {
      const { data: productoDB, error: errorStock } = await supabaseServerInstance
        .from("inventario")
        .select("nombre_producto, stock, precio_venta")
        .eq("id_alimento", item.id)
        .single();

      if (errorStock || !productoDB) {
        return res.status(404).json({ error: `El producto "${item.name || "Desconocido"}" no se encuentra en el inventario.` });
      }

      if (item.quantity > productoDB.stock) {
        console.log(`🚫 Intento de sobrecompra bloqueado: ${productoDB.nombre_producto}. Pide ${item.quantity}, stock: ${productoDB.stock}`);
        return res.status(400).json({
          error: `¡Stock insuficiente para ${productoDB.nombre_producto}! Solo quedan ${productoDB.stock} unidades en la sucursal y has intentado llevar ${item.quantity}.`,
        });
      }

      totalReal += Number(productoDB.precio_venta) * item.quantity;
    }

    // 2. Validar el cupón (si vino uno) y aplicar el descuento sobre el total real
    let cuponValidado: any = null;

    if (codigoCupon) {
      const codigoNormalizado = String(codigoCupon).trim().toUpperCase();

      try {
        const { data: cupones, error: errorCupon } = await supabaseServerInstance.from("cupones").select("*");

        if (errorCupon) {
          console.warn("⚠️ No se pudo consultar la tabla de cupones:", errorCupon.message);
        } else {
          const cupon =
            (cupones || []).find((item: any) => {
              const codigoDb = String(item?.codigo ?? "").trim().toUpperCase();
              const codigoIngresado = codigoNormalizado;
              return codigoDb === codigoIngresado || codigoDb.includes(codigoIngresado) || codigoIngresado.includes(codigoDb);
            }) || null;

          if (cupon) {
            if (cupon.usado) {
              return res.status(400).json({ error: `El cupón ${codigoNormalizado} ya fue utilizado.` });
            } else if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) {
              return res.status(400).json({ error: `El cupón ${codigoNormalizado} está vencido.` });
            } else if (cupon.id_cliente && cupon.id_cliente !== sessionId) {
              return res.status(400).json({ error: `El cupón ${codigoNormalizado} no está disponible para esta cuenta.` });
            } else {
              cuponValidado = cupon;

              const valorDescuento = Number(cupon.descuento_valor) || 0;
              if (cupon.descuento_tipo === "monto_fijo") {
                totalReal = totalReal - valorDescuento;
              } else {
                totalReal = totalReal * (1 - valorDescuento / 100);
              }
              if (totalReal < 0) totalReal = 0;

              console.log(`🎁 Cupón válido: ${codigoNormalizado}. Tipo: ${cupon.descuento_tipo}, Valor: ${valorDescuento}. Total final: $${Math.round(totalReal).toLocaleString("es-CL")}`);
            }
          } else {
            return res.status(400).json({ error: `Cupón no encontrado: ${codigoNormalizado}` });
          }
        }
      } catch (err: any) {
        console.warn("⚠️ Error inesperado al validar cupón:", err?.message || err);
      }
    }

    const totalFinal = Math.round(totalReal);

    // El returnUrl apunta a nuestra función serverless dedicada, que redirige de vuelta al SPA.
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers.host;
    const returnUrl = `${proto}://${host}/api/webpay-return`;

    const createResponse = await tx.create(buyOrder, sessionId, totalFinal, returnUrl);
    res.json({ ...createResponse, id_cupon_aplicado: cuponValidado?.id_cupon || null });
  } catch (error: any) {
    console.error("❌ Error Webpay Create:", error.message);
    res.status(500).json({ error: "Error al crear transacción" });
  }
}
