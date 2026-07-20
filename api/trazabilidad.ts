import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMongoDb } from "./_lib/mongo";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { id_usuario, evento, data_producto } = req.body || {};

    if (!id_usuario) {
      return res.status(400).json({ error: "No se puede registrar una interacción anónima. Se requiere id_usuario." });
    }

    const nuevoLog = {
      id_usuario,
      evento: evento || "interaccion_producto",
      detalles: {
        id_producto: data_producto?.id_producto || data_producto?.id || null,
        nombre: data_producto?.nombre || "Producto desconocido",
        categoria: data_producto?.categoria || "General",
        stock_actual: data_producto?.stock ?? 0,
      },
      timestamp: new Date(),
    };

    const mongoDb = await getMongoDb();
    const resultado = await mongoDb.collection("Logs_Comportamiento_RFM").insertOne(nuevoLog);

    console.log(`📥 [MongoDB Atlas] Log guardado con éxito. ID de inserción: ${resultado.insertedId}`);
    return res.status(201).json({ success: true, logId: resultado.insertedId });
  } catch (error: any) {
    console.error("❌ Error al guardar interacción en MongoDB:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
