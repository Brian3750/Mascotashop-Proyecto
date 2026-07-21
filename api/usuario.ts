import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../src/lib/supabaseServer.js";
import { getMongoDb } from "./_lib/mongo.js";

// Endpoint combinado: antes eran tres funciones separadas (usuario/estadisticas,
// usuario/compras, usuario/clicks). Se unieron en una sola para no superar el
// límite de 12 funciones serverless del plan Hobby de Vercel.
// Uso: GET /api/usuario?tipo=estadisticas|compras|clicks&id_usuario=...
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const { id_usuario, tipo } = req.query;
  if (!id_usuario) return res.status(400).json({ error: "Se requiere id_usuario" });

  if (tipo === "compras") return obtenerCompras(req, res);
  if (tipo === "clicks") return obtenerClicks(req, res);
  if (tipo === "estadisticas") return obtenerEstadisticas(req, res);

  return res.status(400).json({ error: "Falta o es inválido el parámetro 'tipo' (usa 'estadisticas', 'compras' o 'clicks')." });
}

async function obtenerEstadisticas(req: VercelRequest, res: VercelResponse) {
  try {
    const { id_usuario } = req.query;
    const supabaseServerInstance = getSupabaseServer();

    const { data: ventasData } = await supabaseServerInstance
      .from("ventas")
      .select("id_venta", { count: "exact", head: false })
      .eq("id_cliente", id_usuario)
      .eq("estado", "completado");

    const totalCompras = ventasData?.length || 0;

    let totalClicks = 0;
    try {
      const mongoDb = await getMongoDb();
      const logsCollection = mongoDb.collection("Logs_Comportamiento_RFM");
      totalClicks = await logsCollection.countDocuments({ id_usuario: id_usuario as string });
    } catch (mongoError: any) {
      console.warn("⚠️ Error al conectar MongoDB para contar clicks:", mongoError.message);
      totalClicks = 0;
    }

    return res.json({ success: true, totalCompras, totalClicks });
  } catch (error: any) {
    console.error("❌ Error al obtener estadísticas del usuario:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function obtenerCompras(req: VercelRequest, res: VercelResponse) {
  try {
    const { id_usuario } = req.query;
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

async function obtenerClicks(req: VercelRequest, res: VercelResponse) {
  try {
    const { id_usuario } = req.query;

    let clicks: any[] = [];
    try {
      const mongoDb = await getMongoDb();
      const logsCollection = mongoDb.collection("Logs_Comportamiento_RFM");
      const logsData = await logsCollection.find({ id_usuario: id_usuario as string }).sort({ timestamp: -1 }).limit(50).toArray();

      clicks = logsData.map((log: any) => ({
        evento: log.evento,
        nombre_producto: log.detalles?.nombre || "Producto desconocido",
        timestamp: log.timestamp,
      }));
    } catch (mongoError: any) {
      console.warn("⚠️ Error al conectar MongoDB para obtener clicks:", mongoError.message);
    }

    return res.json({ success: true, clicks });
  } catch (error: any) {
    console.error("❌ Error al obtener detalle de clicks:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
