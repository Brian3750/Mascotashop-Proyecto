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
// 🚀 INYECCIÓN: Importación de Nodemailer para notificaciones por correo
import nodemailer from 'nodemailer';

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

// =========================================================================
// FUNCIÓN AUXILIAR: NOTIFICACIÓN AUTOMÁTICA VÍA WHATSAPP BUSINESS API
// =========================================================================
async function enviarNotificacionWhatsApp(datosTicket: any) {
  try {
    console.log(`📲 [WhatsApp API] Enviando ticket de forma automática...`);
    console.log(`📱 Destinatario: ${datosTicket.cliente}`);
    console.log(`📱 Mensaje: Tu compra ${datosTicket.buyOrder} por un monto de $${datosTicket.monto} ha sido procesada con éxito a las ${datosTicket.fechaHora}.`);
    
    // Aquí puedes realizar el fetch real hacia la API de WhatsApp si cuentas con los tokens:
    /*
    await fetch('https://graph.facebook.com/v17.0/TU_PHONE_NUMBER_ID/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ... })
    });
    */
    return true;
  } catch (error: any) {
    console.error("⚠️ No se pudo despachar el mensaje de WhatsApp:", error.message);
    return false;
  }
}

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
  // CONFIGURACIÓN DE NODEMAILER (Credenciales leídas desde el .env.local)
  // =========================================================================
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Tu contraseña de aplicación segura
    },
  });

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
  // 🧾 MODIFICACIÓN: RETURN URL DE TRANSBANK CON PARÁMETROS EXPLÍCITOS DE SPA
  // =========================================================================
  app.post('/', (req, res) => {
    const token_ws = req.body?.token_ws;
    if (!token_ws) {
      return res.status(400).send('Token no recibido en la URL de retorno de Transbank');
    }

    console.log('🔁 Redirect desde Transbank con token_ws:', token_ws);
    return res.redirect(`/?view=confirmacion&token_ws=${encodeURIComponent(token_ws)}`);
  });

  // =========================================================================
  // 🧾 ENDPOINT DE CONFIRMACIÓN DE PAGO - TRANSBANK & SUPABASE CRM
  // =========================================================================
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

        // Variable para almacenar el nombre que irá al ticket y a WhatsApp
        let nombreClienteTicket = "Cliente MascotaShop";

        // D. GUARDAR PUNTOS DE FIDELIZACIÓN & EJECUTAR MOTOR RFM
        if (id_usuario) {
          console.log("6. 🎁 Calculando y guardando puntos de fidelización...");
          const puntosGanados = Math.floor(commitResponse.amount * 0.01); // 1% del total

          const { data: perfil, error: errorPerfil } = await supabaseServerInstance
            .from('perfiles')
            .select('puntos_acumulados, nombres, apellidos')
            .eq('id', id_usuario)
            .single();

          if (errorPerfil) {
            console.warn(`⚠️ No se encontró perfil para usuario ${id_usuario}:`, errorPerfil.message);
          } else {
            if (perfil?.nombres) {
              nombreClienteTicket = `${perfil.nombres} ${perfil.apellidos || ''}`.trim();
            }

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

          // =========================================================
          // 📊 INVOCACIÓN DEL MOTOR ANALÍTICO RFM DE SUPABASE
          // =========================================================
          console.log("7. 📊 Ejecutando motor analítico RFM...");
          
          const { error: rfmError } = await supabaseServerInstance
            .rpc('actualizar_segmentacion_rfm');

          if (rfmError) {
            console.error("⚠️ Error al recalcular la segmentación RFM:", rfmError.message);
          } else {
            console.log("✅ Segmentación RFM y Categorías recalculadas en tiempo real para la base de datos.");
          }
          // =========================================================

        } else {
          console.warn("⚠️ No se recibió id_usuario. Los puntos ni el análisis RFM se guardarán.");
        }

        // E. 🧾 CONSTRUCCIÓN DEL OBJETO COMPROBANTE DE COMPRA DINÁMICO
        const fechaChile = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
        const estructuraTicket = {
          buyOrder: commitResponse.buy_order,
          fechaHora: fechaChile,
          cliente: nombreClienteTicket,
          monto: commitResponse.amount
        };

        // F. Gatillar envío automático asíncrono a WhatsApp
        await enviarNotificacionWhatsApp(estructuraTicket);

        // =========================================================================
        // 🚀 INYECCIÓN: ENVÍO AUTOMÁTICO DE CORREO HTML PREMIUM AL CLIENTE DE PRUEBAS
        // =========================================================================
        const destinoCorreoCliente = req.body.email_usuario || process.env.CLIENT_TEST_EMAIL || "brian.jovani.g@gmail.com";
        
        const listaProductosHTML = cartItems && cartItems.length > 0
          ? cartItems.map((p: any) => `<li>${p.quantity || 1}x ${p.name || 'Producto'} - $${(p.price * (p.quantity || 1)).toLocaleString('es-CL')}</li>`).join('')
          : '<li>Detalle de productos en procesamiento por LoyalData</li>';

        transporter.sendMail({
          from: `"MascotaShop 🐾" <${process.env.SMTP_USER}>`,
          to: destinoCorreoCliente,
          subject: `Confirmación de Compra #${estructuraTicket.buyOrder} - MascotaShop`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 16px; background-color: #ffffff;">
              <h2 style="color: #f97316; margin-top: 0;">¡Gracias por tu compra en MascotaShop! 🐾</h2>
              <p style="color: #475569;">Hola <strong>${estructuraTicket.cliente}</strong>, tu pago ha sido procesado con éxito a través de Transbank.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #1e293b;"><strong>Orden de Compra:</strong> ${estructuraTicket.buyOrder}</p>
              <p style="color: #1e293b;"><strong>Detalle de tu pedido:</strong></p>
              <ul style="color: #475569; padding-left: 20px;">${listaProductosHTML}</ul>
              <h3 style="color: #0f172a; background-color: #f8fafc; padding: 12px; border-radius: 8px; display: inline-block;">
                Total Pagado: $${estructuraTicket.monto.toLocaleString('es-CL')}
              </h3>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">MascotaShop SpA — Panel Analítico LoyalData 2026</p>
            </div>
          `,
        }).then(() => {
          console.log(`📧 [Nodemailer] Notificación enviada con éxito al cliente: ${destinoCorreoCliente}`);
        }).catch(err => {
          console.error("❌ [Nodemailer] Error al despachar correo al cliente:", err.message);
        });
        // =========================================================================

        return res.json({ 
          success: true, 
          data: estructuraTicket 
        });

      } else {
        console.warn("⚠️ Pago rechazado por Transbank:", commitResponse.response_code);
        return res.json({ success: false, data: commitResponse });
      }

    } catch (error: any) {
      console.error("❌ Error Crítico:", error.message);
      res.status(500).json({ error: 'Error interno en el servidor' });
    }
  });

  // =========================================================================
  // 📊 ENDPOINT ANALÍTICO - ENTRADA DE KPIs INTEGRADOS (EVITA RLS)
  // =========================================================================
  app.get('/api/analitica/dashboard', async (req, res) => {
    try {
      const supabaseServerInstance = getSupabaseServer();

      // 1. Obtener ingresos totales históricos basados en las ventas completadas
      const { data: todasLasVentas, error: errVentas } = await supabaseServerInstance
        .from('ventas')
        .select('total_venta')
        .eq('estado', 'completado');

      if (errVentas) throw errVentas;
      const totalIngresos = todasLasVentas?.reduce((sum, v) => sum + Number(v.total_venta), 0) || 0;

      // 2. Traer perfiles completos de la DB para evadir el bloqueo de RLS en el front
      const { data: todosLosPerfiles, error: errPerfiles } = await supabaseServerInstance
        .from('perfiles')
        .select('puntos_acumulados, segmento_rfm');

      if (errPerfiles) throw errPerfiles;

      const totalClientes = todosLosPerfiles?.length || 0;
      const totalPuntos = todosLosPerfiles?.reduce((sum, p) => sum + (p.puntos_acumulados || 0), 0) || 0;

      // 3. Agrupar y mapear dinámicamente la distribución RFM calculada por el motor SQL
      const conteoRFM: Record<string, number> = { 'Campeones': 0, 'Leales': 0, 'En Riesgo': 0, 'Perdidos': 0 };
      todosLosPerfiles?.forEach(p => {
        const seg = p.segmento_rfm || 'Perdidos';
        if (conteoRFM[seg] !== undefined) {
          conteoRFM[seg]++;
        } else {
          conteoRFM['Campeones']++;
        }
      });

      const totalConSegmento = todosLosPerfiles?.length || 1;
      const distribucionRFMReal = Object.keys(conteoRFM).map(name => ({
        name,
        value: Math.round((conteoRFM[name] / totalConSegmento) * 100),
        color: name === 'Campeones' ? '#10b981' : name === 'Leales' ? '#3b82f6' : name === 'En Riesgo' ? '#f97316' : '#ef4444'
      }));

      // 4. Traer el historial transaccional de auditoría reciente usando 'fecha_venta'
      const { data: transaccionesRecientes, error: errHistorial } = await supabaseServerInstance
        .from('ventas')
        .select('id_venta, id_cliente, total_venta, fecha_venta')
        .order('fecha_venta', { ascending: false })
        .limit(10);

      if (errHistorial) throw errHistorial;

      return res.json({
        success: true,
        totalIngresos,
        totalClientes,
        totalPuntos,
        distribuciónRFM: distribucionRFMReal,
        transaccionesRecientes: transaccionesRecientes || []
      });

    } catch (error: any) {
      console.error("❌ Error al obtener métricas consolidadas del CRM:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 🏆 ENDPOINT: ACCIÓN DEL ADMINISTRADOR PARA ENVIAR CUPONES PERSONALIZADOS
  // =========================================================================
  app.post('/api/admin/enviar-cupon', async (req, res) => {
    try {
      const { correo_cliente, nombre_cliente, codigo_cupon, descuento } = req.body;

      if (!correo_cliente || !codigo_cupon) {
        return res.status(400).json({ error: "Faltan datos obligatorios (Correo o Código)" });
      }

      await transporter.sendMail({
        from: `"MascotaShop VIP 🏆" <${process.env.SMTP_USER}>`,
        to: correo_cliente,
        subject: `¡Tienes un cupón de ${descuento || 'Descuento'} de regalo! 🎁`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; background-color: #0b1329; color: #ffffff; padding: 35px; border-radius: 20px; text-align: center;">
            <span style="background-color: #f97316; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Beneficio Exclusivo</span>
            <h2 style="color: #10b981; margin-top: 20px; font-size: 24px;">¡Felicidades ${nombre_cliente || 'Cliente'}! 🏆</h2>
            <p style="color: #94a3b8; font-size: 16px;">El administrador de MascotaShop te ha otorgado un beneficio especial premium.</p>
            
            <div style="background-color: #1e293b; padding: 25px; border-radius: 14px; margin: 25px 0; border: 2px dashed #f97316;">
              <p style="margin: 0; color: #94a3b8; font-size: 15px;">Tu cupón de **${descuento || 'Regalo'}** es:</p>
              <h1 style="margin: 12px 0; color: #f97316; letter-spacing: 5px; font-size: 32px;">${codigo_cupon}</h1>
              <p style="margin: 0; color: #64748b; font-size: 12px;">Aplica este código al finalizar tu próximo carrito</p>
            </div>
            
            <p style="font-size: 11px; color: #475569; margin-top: 20px;">Este beneficio es gestionado directamente por administración.</p>
          </div>
        `,
      });

      console.log(`🎁 [Admin] Cupón ${codigo_cupon} enviado con éxito a ${correo_cliente}`);
      return res.json({ success: true, message: "Cupón enviado exitosamente al cliente." });

    } catch (error: any) {
      console.error("❌ Error al enviar cupón desde el panel:", error.message);
      return res.status(500).json({ error: error.message });
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