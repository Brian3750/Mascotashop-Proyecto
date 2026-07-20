import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

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
