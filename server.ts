import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pkg from 'transbank-sdk';
import { createClient } from '@supabase/supabase-js';

const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } = pkg as any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURACIÓN DE SUPABASE CON SERVICE_ROLE ---
const supabaseUrl = 'https://klicotyrfitmpltrqewh.supabase.co'; // Extraída de tu token
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaWNvdHlyZml0bXBsdHJxZXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA4NDEyMCwiZXhwIjoyMDkwNjYwMTIwfQ.KUoy-udkq2cKN_zfBUJtASOgMYJ9zJBq4CXxP-cektg'; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  const tx = new WebpayPlus.Transaction(
    new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration
    )
  );

  app.post('/api/crear-pago', async (req, res) => {
    try {
      const { total, sessionId, buyOrder } = req.body;
      const createResponse = await tx.create(buyOrder, sessionId, Math.round(Number(total)), `http://localhost:3000/`);
      res.json(createResponse); 
    } catch (error: any) {
      console.error("❌ Error Webpay Create:", error.message);
      res.status(500).json({ error: 'Error al crear transacción' });
    }
  });

  app.post('/api/confirmar-pago', async (req, res) => {
    const { token, cartItems } = req.body;
    if (!token) return res.status(400).json({ error: "Token no recibido" });

    try {
      console.log("1. Rebiendo token de Transbank...");
      const commitResponse = await tx.commit(token);

      if (commitResponse.response_code === 0) {
        console.log("2. ✅ Pago aprobado. Registrando en Supabase...");

        // A. Insertar Venta
        const { data: ventaData, error: errorVenta } = await supabase
          .from('ventas')
          .insert([{
            total_venta: commitResponse.amount,
            id_cliente: commitResponse.session_id, // DEBE SER UN UUID
            estado: 'completado'
          }])
          .select();

        if (errorVenta) {
          console.error("❌ ERROR TABLA VENTAS:", errorVenta.message);
          console.error("Detalles:", errorVenta.details);
          throw errorVenta;
        }

        const nuevaVenta = ventaData[0];
        console.log(`3. ✨ Venta ${nuevaVenta.id_venta} creada.`);

        // B. Insertar Detalles
        if (cartItems && cartItems.length > 0) {
          const detalles = cartItems.map((item: any) => ({
            id_venta: nuevaVenta.id_venta,
            id_alimento: item.id, 
            cantidad: item.quantity,
            precio_unitario: item.price
          }));

          const { error: errorDetalle } = await supabase
            .from('detalle_ventas')
            .insert(detalles);

          if (errorDetalle) {
            console.error("❌ ERROR TABLA DETALLES:", errorDetalle.message);
            console.error("Detalles:", errorDetalle.details);
          } else {
            console.log("4. 📦 Detalles guardados con éxito.");
          }
        }
      } else {
        console.warn("⚠️ Pago rechazado por Transbank:", commitResponse.response_code);
      }

      res.json({ success: commitResponse.response_code === 0, data: commitResponse });

    } catch (error: any) {
      console.error("❌ Error Crítico:", error.message);
      res.status(500).json({ error: 'Error interno en el servidor' });
    }
  });

  // Middleware de Vite (mantener igual...)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
  });
}

startServer();