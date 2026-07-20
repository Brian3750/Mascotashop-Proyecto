import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../src/lib/supabaseServer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { codigo } = req.body || {};
    if (!codigo) return res.status(400).json({ error: "Falta el código del cupón." });

    const supabaseServerInstance = getSupabaseServer();
    const codigoNorm = String(codigo).trim().toUpperCase();

    const { data: cupon, error } = await supabaseServerInstance
      .from("cupones")
      .select("id_cupon, codigo, descuento_tipo, descuento_valor, usado, fecha_expiracion, id_cliente")
      .eq("codigo", codigoNorm)
      .maybeSingle();

    if (error) {
      console.error("❌ [validar-cupon] Error Supabase:", error?.message, error?.code, "| Código buscado:", codigoNorm);
      return res.status(500).json({ error: "Error al consultar el cupón." });
    }
    if (!cupon) {
      console.warn(`⚠️ [validar-cupon] Cupón no encontrado: ${codigoNorm}`);
      return res.status(404).json({ error: "El cupón no existe." });
    }
    if (cupon.usado) return res.status(400).json({ error: "Este cupón ya fue utilizado." });
    if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) {
      return res.status(400).json({ error: "Este cupón está vencido." });
    }

    return res.json({
      success: true,
      codigo: cupon.codigo,
      descuento_tipo: cupon.descuento_tipo,
      descuento_valor: Number(cupon.descuento_valor),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
