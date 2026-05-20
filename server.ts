import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); 

import express from "express";
import { getSupabaseServer } from './src/lib/supabaseServer'; 
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pkg from 'transbank-sdk';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';

const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } = pkg as any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURACIÓN DEL CLÚSTER EN LA NUBE ---
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin_loyaldata:UINrVDBJFVG8hheJ@clusterloyaldataanalyti.hwpmyyl.mongodb.net/LoyalDataAnalytics?appName=ClusterLoyalDataAnalytics";

async function conectarMongoDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db("LoyalDataAnalytics");
}

// --- CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = 'https://klicotyrfitmpltrqewh.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaWNvdHlyZml0bXBsdHJxZXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTt7NTA4NDEyMCwiZXhwIjoyMDkwNjYwMTIwfQ.KUoy-udkq2cKN_zfBUJtASOgMYJ9zJBq4CXxP-cektg'; 
const supabase = createClient(supabaseUrl, supabaseKey);

let mongoDb: any;

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const tx = new WebpayPlus.Transaction(
    new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration
    )
  );

  // =========================================================================
  // ENDPOINT DE TRAZABILIDAD - MONGODB (Exigencia de Ingeniería del Profesor)
  // =========================================================================
  app.post('/api/trazabilidad', async (req, res) => {
    try {
      const { id_usuario, evento, data_producto } = req.body;

      if (!id_usuario) {
        return res.status(400).json({ error: "No se puede registrar una interacción anónima. Se requiere id_usuario." });
      }

      const nuevoLog = {
        id_usuario: id_usuario, 
        evento: evento || "interaccion_producto", 
        detalles: {
          id_producto: data_producto?.id_producto || data_producto?.id || null,
          nombre: data_producto?.nombre || "Producto desconocido",
          categoria: data_producto?.categoria || "General",
          stock_actual: data_producto?.stock ?? 0
        },
        timestamp: new Date()
      };

      if (!mongoDb) {
        console.warn("⚠️ MongoDB no se encuentra inicializado. Intentando reconexión forzada...");
        try {
          mongoDb = await conectarMongoDB();
        } catch (reconnectError) {
          return res.status(500).json({ error: "Persistencia analítica no disponible temporalmente in Atlas." });
        }
      }

      const resultado = await mongoDb.collection("Logs_Comportamiento_RFM").insertOne(nuevoLog);
      
      console.log(`📥 [MongoDB Atlas] Log guardado con éxito. ID de inserción: ${resultado.insertedId}`);
      return res.status(201).json({ success: true, logId: resultado.insertedId });
    } catch (error: any) {
      console.error("❌ Error al guardar interacción en MongoDB:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // ENDPOINTS TRANSACCIONALES - WEBPAY PLUS
  // =========================================================================
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

  // =========================================================================
  // 🧾 RETURN URL DE TRANSBANK - RECIBE token_ws POR POST
  // =========================================================================
  app.post('/', (req, res) => {
    const token_ws = req.body?.token_ws;
    if (!token_ws) {
      return res.status(400).send('Token no recibido en la URL de retorno de Transbank');
    }

    console.log('🔁 Redirect desde Transbank con token_ws:', token_ws);
    return res.redirect(`/payment-confirmation?token_ws=${encodeURIComponent(token_ws)}`);
  });

  app.post('/api/confirmar-pago', async (req, res) => {
    const { cartItems, id_usuario } = req.body;
    const token = req.body.token || req.body.token_ws;
    if (!token) return res.status(400).json({ error: "Token no recibido" });

    try {
      console.log("1. Recibiendo token de Transbank...");
      const commitResponse = await tx.commit(token);

      if (commitResponse.response_code === 0) {
        console.log("2. ✅ Pago aprobado. Registrando en Supabase...");

        const idClienteFinal = id_usuario || commitResponse.session_id;
        const supabaseServerInstance = getSupabaseServer();

        // A. Insertar Venta usando la instancia segura creada
        const { data: ventaData, error: errorVenta } = await supabaseServerInstance
          .from('ventas')
          .insert([{
            total_venta: commitResponse.amount,
            id_cliente: idClienteFinal,
            estado: 'completado'
          }])
          .select();

        if (errorVenta) {
          console.error("❌ ERROR TABLA VENTAS:", errorVenta.message, errorVenta);
          throw errorVenta;
        }

        const nuevaVenta = ventaData[0];
        console.log(`3. ✨ Venta ${nuevaVenta.id_venta} creada.`);

        // B. Insertar Detalles e Actualizar Stock usando la instancia segura
        if (cartItems && cartItems.length > 0) {
          const detalles = cartItems.map((item: any) => ({
            id_venta: nuevaVenta.id_venta,
            id_alimento: item.id,
            cantidad: item.quantity,
            precio_unitario: item.price
          }));

          const { error: errorDetalle } = await supabaseServerInstance
            .from('detalle_ventas')
            .insert(detalles);

          if (errorDetalle) {
            console.error("❌ ERROR TABLA DETALLES:", errorDetalle.message);
          } else {
            console.log("4. 📦 Detalles guardados con éxito.");

            // C. DESCUENTO AUTOMÁTICO DE STOCK
            console.log("5. 📉 Actualizando inventario...");
            for (const item of cartItems) {
              const { error: errorStock } = await supabaseServerInstance
                .rpc('discount_stock', {
                  row_id: item.id,
                  quantity_to_subtract: item.quantity
                });

              if (errorStock) {
                console.error(`⚠️ No se pudo descontar stock para el producto ${item.id}:`, errorStock.message);
              }
            }
            console.log("✅ Proceso de stock finalizado.");
          }
        }

        // D. GUARDAR PUNTOS DE FIDELIZACIÓN
        if (id_usuario) {
          console.log("6. 🎁 Calculando y guardando puntos de fidelización...");
          const puntosGanados = Math.floor(commitResponse.amount * 0.01); // 1% del total

          // Obtener puntos actuales del usuario
          const { data: perfil, error: errorPerfil } = await supabaseServerInstance
            .from('perfiles')
            .select('puntos_acumulados')
            .eq('id', id_usuario)
            .single();

          if (errorPerfil) {
            console.warn(`⚠️ No se encontró perfil para usuario ${id_usuario}:`, errorPerfil.message);
          } else {
            const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

            const { error: errorPuntos } = await supabaseServerInstance
              .from('perfiles')
              .update({ puntos_acumulados: nuevosPuntos })
              .eq('id', id_usuario);

            if (errorPuntos) {
              console.error(`❌ Error al guardar puntos para usuario ${id_usuario}:`, errorPuntos.message);
            } else {
              console.log(`✅ Puntos guardados: +${puntosGanados} puntos. Total: ${nuevosPuntos} puntos`);
            }
          }
        } else {
          console.warn("⚠️ No se recibió id_usuario. Los puntos no se guardarán.");
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


  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  // --- CONEXIÓN PREVIA A MONGODB ATLAS ---
  try {
    console.log("⏳ Conectando al clúster analítico de MongoDB Atlas...");
    mongoDb = await conectarMongoDB();
    console.log("🚀 Conectado con éxito a MongoDB Atlas en la nube.");
  } catch (err: any) {
    console.error("⚠️ Error crítico inicial: La persistencia NoSQL falló:", err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor Express escuchando en http://localhost:${PORT}`);
  });
}

// Manejo central de errores no capturados para debugging local
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

startServer().catch((err) => {
  console.error('❌ Error al iniciar el servidor:', err && err.stack ? err.stack : err);
  process.exit(1);
});