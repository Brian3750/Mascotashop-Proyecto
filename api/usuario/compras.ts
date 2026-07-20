import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { id_usuario } = req.query;
    if (!id_usuario) return res.status(400).json({ error: "Se requiere id_usuario" });

    const supabaseServerInstance = getSupabaseServer();

    const { data: ventasData, error: errorVentas } = await supabaseServerInstance
      .from("ventas")
      .select(
        `
        id_venta,
        total_venta,
        fecha_venta,
        detalle_ventas(cantidad)
      `
      )
      .eq("id_cliente", id_usuario)
      .eq("estado", "completado")
      .order("fecha_venta", { ascending: false });

    if (errorVentas) {
      console.error("❌ Error al obtener compras:", errorVentas.message);
      return res.status(500).json({ error: errorVentas.message });
    }

    const compras = (ventasData || []).map((venta: any) => ({
      id_venta: venta.id_venta,
      total_venta: venta.total_venta,
      fecha_venta: venta.fecha_venta,
      cantidad_items: (venta.detalle_ventas || []).reduce((sum: number, det: any) => sum + (det.cantidad || 0), 0),
    }));

    return res.json({ success: true, compras });
  } catch (error: any) {
    console.error("❌ Error al obtener detalle de compras:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
