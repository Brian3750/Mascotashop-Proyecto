import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer";
import { getMongoDb } from "../_lib/mongo";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { id_usuario } = req.query;
    if (!id_usuario) return res.status(400).json({ error: "Se requiere id_usuario" });

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
