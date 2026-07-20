import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "../_lib/mongo";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { id_usuario } = req.query;
    if (!id_usuario) return res.status(400).json({ error: "Se requiere id_usuario" });

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
