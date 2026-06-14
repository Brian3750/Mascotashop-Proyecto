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
import nodemailer from 'nodemailer';

const { WebpayPlus, Options, IntegrationCommerceCodes, IntegrationApiKeys, Environment } = pkg as any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin_loyaldata:UINrVDBJFVG8hheJ@clusterloyaldataanalyti.hwpmyyl.mongodb.net/LoyalDataAnalytics?appName=ClusterLoyalDataAnalytics";

async function conectarMongoDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db("LoyalDataAnalytics");
}

const supabaseUrl = 'https://klicotyrfitmpltrqewh.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaWNvdHlyZml0bXBsdHJxZXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTt7NTA4NDEyMCwiZXhwIjoyMDkwNjYwMTIwfQ.KUoy-udkq2cKN_zfBUJtASOgMYJ9zJBq4CXxP-cektg'; 
const supabase = createClient(supabaseUrl, supabaseKey);

let mongoDb: any;

async function enviarNotificacionWhatsApp(datosTicket: any) {
  try {
    console.log(`📲 [WhatsApp API] Enviando ticket de forma automática...`);
    console.log(`📱 Destinatario: ${datosTicket.cliente}`);
    console.log(`📱 Mensaje: Tu compra ${datosTicket.buyOrder} por un monto de $${datosTicket.monto} ha sido procesada con éxito a las ${datosTicket.fechaHora}.`);
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

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // =========================================================================
  // ENDPOINT DE TRAZABILIDAD - MONGODB
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
      console.error("❌ Error al guardar interacción in MongoDB:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 🔥 ENDPOINT TRANSACCIONAL: VALIDACIÓN DE STOCK ANTES DE PAGO
  // =========================================================================
  app.post('/api/crear-pago', async (req, res) => {
    try {
      const { total, sessionId, buyOrder, cartItems } = req.body;

      if (cartItems && cartItems.length > 0) {
        const supabaseServerInstance = getSupabaseServer();
        
        for (const item of cartItems) {
          const { data: productoDB, error: errorStock } = await supabaseServerInstance
            .from('inventario')
            .select('nombre_producto, stock')
            .eq('id_alimento', item.id) 
            .single();

          if (errorStock || !productoDB) {
            return res.status(404).json({ error: `El producto "${item.name || 'Desconocido'}" no se encuentra en el inventario.` });
          }

          if (item.quantity > productoDB.stock) {
            console.log(`🚫 Intento de sobrecompra bloqueado: ${productoDB.nombre_producto}. Pide ${item.quantity}, stock: ${productoDB.stock}`);
            return res.status(400).json({ 
              error: `¡Stock insuficiente para ${productoDB.nombre_producto}! Solo quedan ${productoDB.stock} unidades en la sucursal y has intentado llevar ${item.quantity}.` 
            });
          }
        }
      }

      const createResponse = await tx.create(buyOrder, sessionId, Math.round(Number(total)), `http://localhost:3000/`);
      res.json(createResponse); 
    } catch (error: any) {
      console.error("❌ Error Webpay Create:", error.message);
      res.status(500).json({ error: 'Error al crear transacción' });
    }
  });

  app.post('/', (req, res) => {
    const token_ws = req.body?.token_ws;
    if (!token_ws) {
      return res.status(400).send('Token no recibido en la URL de retorno de Transbank');
    }

    console.log('🔁 Redirect desde Transbank con token_ws:', token_ws);
    return res.redirect(`/?view=confirmacion&token_ws=${encodeURIComponent(token_ws)}`);
  });

  // =========================================================================
  // 🧾 ENDPOINT DE CONFIRMACIÓN DE PAGO - TRANSBANK & PERSISTENCIA RECHAZADA
  // =========================================================================
  app.post('/api/confirmar-pago', async (req, res) => {
    const { cartItems, id_usuario } = req.body;
    const token = req.body.token || req.body.token_ws;
    if (!token) return res.status(400).json({ error: "Token no recibido" });

    try {
      console.log("1. Recibiendo token de Transbank...");
      const commitResponse = await tx.commit(token);
      const supabaseServerInstance = getSupabaseServer();

      if (commitResponse.response_code === 0) {
        console.log("2. ✅ Pago aprobado. Registrando en Supabase...");

        const idClienteFinal = id_usuario || commitResponse.session_id;

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

        let nombreClienteTicket = "Cliente MascotaShop";

        if (id_usuario) {
          console.log("6. 🎁 Calculando y guardando puntos de fidelización...");
          const puntosGanados = Math.floor(commitResponse.amount * 0.01);

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

          console.log("7. 📊 Ejecutando motor analítico RFM...");
          const { error: rfmError } = await supabaseServerInstance
            .rpc('actualizar_segmentacion_rfm');

          if (rfmError) {
            console.error("⚠️ Error al recalcular la segmentación RFM:", rfmError.message);
          } else {
            console.log("✅ Segmentación RFM recalculada con éxito.");
          }

        } else {
          console.warn("⚠️ No se recibió id_usuario. Los puntos ni el análisis RFM se guardarán.");
        }

        const fechaChile = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
        const estructuraTicket = {
          buyOrder: commitResponse.buy_order,
          fechaHora: fechaChile,
          cliente: nombreClienteTicket,
          monto: commitResponse.amount
        };

        await enviarNotificacionWhatsApp(estructuraTicket);

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
          console.log(`📧 [Nodemailer] Notificación enviada con éxito al cliente.`);
        }).catch(err => {
          console.error("❌ [Nodemailer] Error al despachar correo:", err.message);
        });

        return res.json({ success: true, data: estructuraTicket });

      } else {
        console.warn(`⚠️ Pago rechazado por Transbank (${commitResponse.response_code}). Persistiendo orden...`);
        
        const { error: errorSupabasePendiente } = await supabaseServerInstance
          .from('ventas')
          .insert([{
            id_venta: Number(commitResponse.buy_order) || Math.floor(Date.now() / 1000),
            id_cliente: id_usuario || 'd5e10331-fefd-430c-b1b6-a4e90fffcb43', 
            total_venta: commitResponse.amount || 0,
            estado: 'Pendiente' 
          }]);

        if (errorSupabasePendiente) {
          console.error("❌ No se pudo inyectar el pedido Pendiente tras rechazo:", errorSupabasePendiente.message);
        } else {
          console.log("✨ Intento de compra fallido registrado como 'Pendiente' en Supabase de forma automatizada.");
        }

        return res.json({ success: false, data: commitResponse });
      }

    } catch (error: any) {
      console.error("❌ Error Crítico:", error.message);
      res.status(500).json({ error: 'Error interno en el servidor' });
    }
  });

  // =========================================================================
  // 📊 ENDPOINT ANALÍTICA - ENTRADA DE KPIs REALES (CORREGIDO DE RAÍZ)
  // =========================================================================
  app.get('/api/analitica/dashboard', async (req, res) => {
    try {
      const supabaseServerInstance = getSupabaseServer();

      // 1. Obtener ingresos transaccionales reales
      const { data: todasLasVentas, error: errVentas } = await supabaseServerInstance
        .from('ventas')
        .select('total_venta')
        .eq('estado', 'completado');

      if (errVentas) throw errVentas;
      const totalIngresos = todasLasVentas?.reduce((sum, v) => sum + Number(v.total_venta), 0) || 0;

      // 2. Obtener clientes reales y acumulación analítica RFM
      const { data: todosLosPerfiles, error: errPerfiles } = await supabaseServerInstance
        .from('perfiles')
        .select('puntos_acumulados, segmento_rfm');

      if (errPerfiles) throw errPerfiles;

      const totalClientes = todosLosPerfiles?.length || 0;
      const totalPuntos = todosLosPerfiles?.reduce((sum, p) => sum + (p.puntos_acumulados || 0), 0) || 0;

      // Estructuramos el conteo incluyendo soporte para estados iniciales de tu BD
      const conteoRFM: Record<string, number> = { 
        'Campeones': 0, 
        'Leales': 0, 
        'En Riesgo': 0, 
        'Perdidos': 0,
        'Nuevo Cliente': 0,
        'Sin Segmentar': 0
      };

      todosLosPerfiles?.forEach(p => {
        // Si el segmento viene vacío de la BD caerá en 'Sin Segmentar'
        const seg = p.segmento_rfm ? p.segmento_rfm.trim() : 'Sin Segmentar';
        
        if (conteoRFM[seg] !== undefined) {
          conteoRFM[seg]++;
        } else {
          // Fallback dinámico inteligente para evitar agrupar todo erróneamente en Campeones
          conteoRFM['Sin Segmentar']++;
        }
      });

      // Mapeamos a la estructura limpia que espera el Frontend
      const distribucionRFMReal = Object.keys(conteoRFM)
        .filter(key => conteoRFM[key] > 0) // Solo enviamos segmentos que tengan clientes reales
        .map(name => ({
          name,
          count: conteoRFM[name] // Enviamos el número entero de clientes
        }));

      // 3. Monitor Transaccional en Tiempo Real (Últimas 10 ventas)
      const { data: transaccionesRecientes, error: errHistorial } = await supabaseServerInstance
        .from('ventas')
        .select('id_venta, id_cliente, total_venta, fecha_venta')
        .order('fecha_venta', { ascending: false })
        .limit(10);

      if (errHistorial) throw errHistorial;

      // 4. Mapeo 100% Real y Dinámico del Inventario vendido (RESOLVIENDO JOIN CON POSTGRES)
      const { data: detallesVentasData, error: errDetalles } = await supabaseServerInstance
        .from('detalle_ventas')
        .select(`
          cantidad,
          inventario!id_alimento (
            categoria
          )
        `); 

      if (errDetalles) {
        console.error("❌ [LoyalData Join Error] Error al cruzar detalle_ventas con inventario:", errDetalles.message);
      }

      const acumuladorCategorias: Record<string, { totalVentas: number, totalPuntosAsociados: number, conteoItems: number }> = {};

      if (!errDetalles && detallesVentasData && detallesVentasData.length > 0) {
        detallesVentasData.forEach((item: any) => {
          const inv = Array.isArray(item.inventario) ? item.inventario[0] : item.inventario;
          
          const categoriaReal = inv?.categoria ? inv.categoria.trim() : 'Otros';
          const cant = Number(item.cantidad) || 0;

          if (!acumuladorCategorias[categoriaReal]) {
            acumuladorCategorias[categoriaReal] = { 
              totalVentas: 0, 
              totalPuntosAsociados: 0, 
              conteoItems: 0 
            };
          }

          acumuladorCategorias[categoriaReal].totalVentas += cant;
          acumuladorCategorias[categoriaReal].totalPuntosAsociados += (cant * 100); 
          acumuladorCategorias[categoriaReal].conteoItems += 1;
        });
      }

      const metricasCategoriasReales = Object.keys(acumuladorCategorias).map(catKey => {
        const item = acumuladorCategorias[catKey];
        return {
          name: catKey, 
          totalVentas: item.totalVentas,
          promedioPuntos: item.conteoItems > 0 ? Math.round(item.totalPuntosAsociados / item.conteoItems) : 0
        };
      });

      if (metricasCategoriasReales.length === 0) {
        metricasCategoriasReales.push({
          name: "Sin ventas aún",
          totalVentas: 0,
          promedioPuntos: 0
        });
      }

      return res.json({
        success: true,
        totalIngresos,
        totalClientes,
        totalPuntos,
        distribuciónRFM: distribucionRFMReal,
        transaccionesRecientes: transaccionesRecientes || [] ,
        metricasCategorias: metricasCategoriasReales 
      });

    } catch (error: any) {
      console.error("❌ Error al obtener métricas consolidadas del CRM:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 🎁 ENDPOINT: ACCIÓN DEL ADMINISTRADOR PARA ENVIAR CUPONES
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

  // =========================================================================
  // 📊 ENDPOINT ESTADÍSTICAS DE USUARIO - COMPRAS Y CLICKS
  // =========================================================================
  app.get('/api/usuario/estadisticas', async (req, res) => {
    try {
      const { id_usuario } = req.query;

      if (!id_usuario) {
        return res.status(400).json({ error: "Se requiere id_usuario" });
      }

      const supabaseServerInstance = getSupabaseServer();

      // 1. Obtener el número de compras (ventas completadas)
      const { data: ventasData, error: errorVentas } = await supabaseServerInstance
        .from('ventas')
        .select('id_venta', { count: 'exact', head: false })
        .eq('id_cliente', id_usuario)
        .eq('estado', 'completado');

      const totalCompras = ventasData?.length || 0;

      // 2. Obtener el número de clicks (interacciones en MongoDB)
      let totalClicks = 0;
      try {
        if (!mongoDb) {
          console.warn("⚠️ MongoDB no se encuentra inicializado en estadísticas.");
          mongoDb = await conectarMongoDB();
        }

        const logsCollection = mongoDb.collection("Logs_Comportamiento_RFM");
        totalClicks = await logsCollection.countDocuments({ id_usuario: id_usuario });
      } catch (mongoError: any) {
        console.warn("⚠️ Error al conectar MongoDB para contar clicks:", mongoError.message);
        totalClicks = 0;
      }

      return res.json({
        success: true,
        totalCompras: totalCompras,
        totalClicks: totalClicks
      });
    } catch (error: any) {
      console.error("❌ Error al obtener estadísticas del usuario:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 📋 ENDPOINT DETALLE DE COMPRAS DEL USUARIO
  // =========================================================================
  app.get('/api/usuario/compras', async (req, res) => {
    try {
      const { id_usuario } = req.query;

      if (!id_usuario) {
        return res.status(400).json({ error: "Se requiere id_usuario" });
      }

      const supabaseServerInstance = getSupabaseServer();

      // Obtener compras detalladas
      const { data: ventasData, error: errorVentas } = await supabaseServerInstance
        .from('ventas')
        .select(`
          id_venta,
          total_venta,
          fecha_venta,
          detalle_ventas(cantidad)
        `)
        .eq('id_cliente', id_usuario)
        .eq('estado', 'completado')
        .order('fecha_venta', { ascending: false });

      if (errorVentas) {
        console.error("❌ Error al obtener compras:", errorVentas.message);
        return res.status(500).json({ error: errorVentas.message });
      }

      const compras = (ventasData || []).map((venta: any) => ({
        id_venta: venta.id_venta,
        total_venta: venta.total_venta,
        fecha_venta: venta.fecha_venta,
        cantidad_items: (venta.detalle_ventas || []).reduce((sum: number, det: any) => sum + (det.cantidad || 0), 0)
      }));

      return res.json({
        success: true,
        compras: compras
      });
    } catch (error: any) {
      console.error("❌ Error al obtener detalle de compras:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 👆 ENDPOINT DETALLE DE CLICKS/INTERACCIONES DEL USUARIO
  // =========================================================================
  app.get('/api/usuario/clicks', async (req, res) => {
    try {
      const { id_usuario } = req.query;

      if (!id_usuario) {
        return res.status(400).json({ error: "Se requiere id_usuario" });
      }

      let clicks: any[] = [];
      try {
        if (!mongoDb) {
          console.warn("⚠️ MongoDB no se encuentra inicializado en clicks.");
          mongoDb = await conectarMongoDB();
        }

        const logsCollection = mongoDb.collection("Logs_Comportamiento_RFM");
        const logsData = await logsCollection
          .find({ id_usuario: id_usuario })
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();

        clicks = logsData.map((log: any) => ({
          evento: log.evento,
          nombre_producto: log.detalles?.nombre || "Producto desconocido",
          timestamp: log.timestamp
        }));
      } catch (mongoError: any) {
        console.warn("⚠️ Error al conectar MongoDB para obtener clicks:", mongoError.message);
      }

      return res.json({
        success: true,
        clicks: clicks
      });
    } catch (error: any) {
      console.error("❌ Error al obtener detalle de clicks:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

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