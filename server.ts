import dotenv from "dotenv";
dotenv.config({ path: ".env.local" }); 

import express from "express";
import { getSupabaseServer } from './src/lib/supabaseServer'; 
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import pkg from 'transbank-sdk';
import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

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

// Cliente Twilio — se inicializa solo si las variables están en .env.local
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function enviarNotificacionWhatsApp(datosTicket: any) {
  const telefono = datosTicket.telefono;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!twilioClient) {
    console.warn('⚠️ [WhatsApp] Twilio no configurado — revisa TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env.local');
    return false;
  }

  if (!telefono) {
    console.warn('⚠️ [WhatsApp] Cliente sin teléfono registrado — mensaje no enviado.');
    return false;
  }

  // Formatear: 945685662 → +56945685662 → whatsapp:+56945685662
  let telefonoLimpio = String(telefono).replace(/\D/g, '');

  // Si no empieza con 56 (código de Chile) y tiene 9 dígitos (celular sin código país), se lo agregamos
  if (!telefonoLimpio.startsWith('56') && telefonoLimpio.length === 9) {
    telefonoLimpio = `56${telefonoLimpio}`;
  }

  const telefonoWA = `whatsapp:+${telefonoLimpio}`;

  const mensaje = datosTicket.mensajePersonalizado || (
    `🐾 *MascotaShop* — Confirmación de compra\n\n` +
    `Hola *${datosTicket.cliente}*! Tu pago fue procesado con éxito ✅\n\n` +
    `📋 Orden: *${datosTicket.buyOrder}*\n` +
    `💰 Total pagado: *$${Number(datosTicket.monto).toLocaleString('es-CL')}*\n` +
    `🕐 Fecha: *${datosTicket.fechaHora}*\n\n` +
    `¡Gracias por confiar en nosotros! 🐶🐱`
  );

  try {
    const msg = await twilioClient.messages.create({
      from: fromNumber,
      to: telefonoWA,
      body: mensaje,
    });
    console.log(`✅ [WhatsApp Twilio] Mensaje enviado a ${telefonoWA} — SID: ${msg.sid}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [WhatsApp Twilio] Error al enviar a ${telefonoWA}:`, error.message);
    return false;
  }
}

export async function createApp() {
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
  // =========================================================================
  // 🎟️ ENDPOINT: VALIDAR CUPÓN (solo consulta, sin marcar como usado)
  // =========================================================================
  app.post('/api/validar-cupon', async (req, res) => {
    try {
      const { codigo } = req.body;
      if (!codigo) return res.status(400).json({ error: 'Falta el código del cupón.' });

      const supabaseServerInstance = getSupabaseServer();
      const codigoNorm = String(codigo).trim().toUpperCase();

      const { data: cupon, error } = await supabaseServerInstance
        .from('cupones')
        .select('id_cupon, codigo, descuento_tipo, descuento_valor, usado, fecha_expiracion, id_cliente')
        .eq('codigo', codigoNorm)
        .maybeSingle();

      if (error) {
        console.error('❌ [validar-cupon] Error Supabase:', error?.message, error?.code, '| Código buscado:', codigoNorm);
        return res.status(500).json({ error: 'Error al consultar el cupón.' });
      }
      if (!cupon) {
        console.warn(`⚠️ [validar-cupon] Cupón no encontrado: ${codigoNorm}`);
        return res.status(404).json({ error: 'El cupón no existe.' });
      }
      if (cupon.usado) return res.status(400).json({ error: 'Este cupón ya fue utilizado.' });
      if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) {
        return res.status(400).json({ error: 'Este cupón está vencido.' });
      }

      return res.json({
        success: true,
        codigo: cupon.codigo,
        descuento_tipo: cupon.descuento_tipo,
        descuento_valor: Number(cupon.descuento_valor),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crear-pago', async (req, res) => {
    try {
      const { sessionId, buyOrder, cartItems, codigoCupon } = req.body;

      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío." });
      }

      const supabaseServerInstance = getSupabaseServer();

      // 1. Recalcular el total desde los precios reales en Supabase
      //    (nunca se confía en el total que manda el navegador).
      let totalReal = 0;

      for (const item of cartItems) {
        const { data: productoDB, error: errorStock } = await supabaseServerInstance
          .from('inventario')
          .select('nombre_producto, stock, precio_venta')
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

        totalReal += Number(productoDB.precio_venta) * item.quantity;
      }

      // 2. Validar el cupón (si vino uno) y aplicar el descuento del 20% sobre el total real
      let cuponValidado: any = null;

      if (codigoCupon) {
        const codigoNormalizado = String(codigoCupon).trim().toUpperCase();

        try {
          const { data: cupones, error: errorCupon } = await supabaseServerInstance
            .from('cupones')
            .select('*');

          if (errorCupon) {
            console.warn('⚠️ No se pudo consultar la tabla de cupones:', errorCupon.message);
          } else {
            const cupon = (cupones || []).find((item: any) => {
              const codigoDb = String(item?.codigo ?? '').trim().toUpperCase();
              const codigoIngresado = codigoNormalizado;
              return codigoDb === codigoIngresado || codigoDb.includes(codigoIngresado) || codigoIngresado.includes(codigoDb);
            }) || null;

            if (cupon) {
              if (cupon.usado) {
                return res.status(400).json({ error: `El cupón ${codigoNormalizado} ya fue utilizado.` });
              } else if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) {
                return res.status(400).json({ error: `El cupón ${codigoNormalizado} está vencido.` });
              } else if (cupon.id_cliente && cupon.id_cliente !== sessionId) {
                return res.status(400).json({ error: `El cupón ${codigoNormalizado} no está disponible para esta cuenta.` });
              } else {
                cuponValidado = cupon;

                // Aplicar descuento real desde la BD (porcentaje o monto fijo)
                const valorDescuento = Number(cupon.descuento_valor) || 0;
                if (cupon.descuento_tipo === 'monto_fijo') {
                  totalReal = totalReal - valorDescuento;
                } else {
                  // porcentaje (ej: descuento_valor = 20 → 20%)
                  totalReal = totalReal * (1 - valorDescuento / 100);
                }
                if (totalReal < 0) totalReal = 0;

                console.log(`🎁 Cupón válido: ${codigoNormalizado}. Tipo: ${cupon.descuento_tipo}, Valor: ${valorDescuento}. Total final: $${Math.round(totalReal).toLocaleString('es-CL')}`);
              }
            } else {
              return res.status(400).json({ error: `Cupón no encontrado: ${codigoNormalizado}` });
            }
          }
        } catch (err: any) {
          console.warn('⚠️ Error inesperado al validar cupón:', err?.message || err);
        }
      }

      const totalFinal = Math.round(totalReal);

      const createResponse = await tx.create(buyOrder, sessionId, totalFinal, `http://localhost:3000/`);
      // Devolvemos también el id del cupón validado para que el frontend lo reenvíe
      // al confirmar el pago (así sabemos cuál marcar como usado).
      res.json({ ...createResponse, id_cupon_aplicado: cuponValidado?.id_cupon || null });
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
    const { cartItems, id_usuario, id_cupon_aplicado } = req.body;
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

        if (id_cupon_aplicado) {
          const { error: errorMarcarCupon } = await supabaseServerInstance
            .from('cupones')
            .update({ usado: true, id_venta_uso: nuevaVenta.id_venta })
            .eq('id_cupon', id_cupon_aplicado)
            .eq('usado', false); // evita marcar dos veces el mismo cupón en una carrera

          if (errorMarcarCupon) {
            console.error(`⚠️ No se pudo marcar el cupón ${id_cupon_aplicado} como usado:`, errorMarcarCupon.message);
          } else {
            console.log(`🎟️ Cupón ${id_cupon_aplicado} marcado como usado.`);
          }
        }

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
        let telefonoClienteTicket: string | null = null;

        if (id_usuario) {
          console.log("6. 🎁 Calculando y guardando puntos de fidelización...");
          const puntosGanados = Math.floor(commitResponse.amount * 0.01);

          const { data: perfil, error: errorPerfil } = await supabaseServerInstance
            .from('perfiles')
            .select('puntos_acumulados, nombres, apellidos, telefono')
            .eq('id', id_usuario)
            .single();

          if (errorPerfil) {
            console.warn(`⚠️ No se encontró perfil para usuario ${id_usuario}:`, errorPerfil.message);
          } else {
            if (perfil?.nombres) {
              nombreClienteTicket = `${perfil.nombres} ${perfil.apellidos || ''}`.trim();
            }
            if (perfil?.telefono) {
              telefonoClienteTicket = perfil.telefono;
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

              // Registrar el movimiento en el historial (auditoría/trazabilidad)
              console.log(`📊 Intentando guardar historial de puntos:`, {
                id_cliente: id_usuario,
                tipo_movimiento: 'Ganados',
                puntos: puntosGanados,
                id_venta: nuevaVenta.id_venta
              });

              const { error: errorHistorial, data: datosHistorial } = await supabaseServerInstance
                .from('historial_puntos')
                .insert([{
                  id_cliente: id_usuario,
                  tipo_movimiento: 'Ganados',
                  puntos: puntosGanados,
                  id_venta: nuevaVenta.id_venta,
                  descripcion: `Puntos por compra #${nuevaVenta.id_venta}`
                }])
                .select();

              if (errorHistorial) {
                console.error(`⚠️ No se pudo registrar el historial de puntos:`, errorHistorial.code, errorHistorial.message, errorHistorial.details);
              } else {
                console.log(`✅ Historial de puntos guardado:`, datosHistorial);
              }
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
          monto: commitResponse.amount,
          telefono: telefonoClienteTicket
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
  // 📊 ENDPOINT ANALÍTICA - CON FILTROS DINÁMICOS REACTIVOS
  // =========================================================================
  app.get('/api/analitica/dashboard', async (req, res) => {
    try {
      const supabaseServerInstance = getSupabaseServer();

      // 1. CAPTURAR FILTROS ENVIADOS DESDE EL FRONTEND
      const { clienteId, animal, segmento } = req.query;

      // 2. OBTENER LISTA DE CLIENTES REALES PARA EL DROP DOWN SELECTOR
      const { data: perfilesDropdown } = await supabaseServerInstance
        .from('perfiles')
        .select('id, nombres, apellidos');

      const listaClientes = (perfilesDropdown || []).map(c => ({
        id: c.id,
        nombre: `${c.nombres || ''} ${c.apellidos || ''}`.trim() || 'Cliente Sin Identificar'
      }));

      // 3. TRAER INGRESOS TRANSACCIONALES FILTRADOS POR CLIENTE
      let queryVentas = supabaseServerInstance
        .from('ventas')
        .select('id_venta, id_cliente, total_venta, fecha_venta')
        .eq('estado', 'completado')
        .order('fecha_venta', { ascending: false });

      if (clienteId && clienteId !== 'Todos') {
        queryVentas = queryVentas.eq('id_cliente', clienteId);
      }

      const { data: todasLasVentas, error: errVentas } = await queryVentas;
      if (errVentas) throw errVentas;

      const totalIngresos = todasLasVentas?.reduce((sum, v) => sum + Number(v.total_venta), 0) || 0;

      // Monitor Transaccional: últimas 10 ventas enriquecidas con segmento_rfm del cliente
      // Si hay filtro por animal, solo mostramos ventas que contengan productos de esa categoría
      let ventasFiltradas = todasLasVentas || [];

      if (animal && animal !== 'Todos') {
        // Traer ids de ventas que tienen al menos un producto de la categoría filtrada
        const { data: detallesFiltro } = await supabaseServerInstance
          .from('detalle_ventas')
          .select('id_venta, inventario!id_alimento(categoria)');

        const CATEGORIA_NORM: Record<string, string> = {
          'perros': 'Perro', 'perro': 'Perro', 'gatos': 'Gato', 'gato': 'Gato',
          'hamster': 'Hamster', 'conejos': 'Conejo', 'conejo': 'Conejo',
          'peces': 'Pez', 'pez': 'Pez', 'aves': 'Ave', 'ave': 'Ave',
        };

        const idsVentasConAnimal = new Set(
          (detallesFiltro || [])
            .filter((d: any) => {
              const inv = Array.isArray(d.inventario) ? d.inventario[0] : d.inventario;
              const cat = CATEGORIA_NORM[(inv?.categoria || '').trim().toLowerCase()] || '';
              return cat.toLowerCase() === String(animal).toLowerCase();
            })
            .map((d: any) => d.id_venta)
        );

        ventasFiltradas = ventasFiltradas.filter(v => idsVentasConAnimal.has(v.id_venta));
      }

      const ultimasVentas = ventasFiltradas.slice(0, 10);

      const idsClientes = [...new Set(ultimasVentas.map((v: any) => v.id_cliente).filter(Boolean))];
      let mapaSegmentos: Record<string, string> = {};

      if (idsClientes.length > 0) {
        const { data: perfilesRFM } = await supabaseServerInstance
          .from('perfiles')
          .select('id, segmento_rfm')
          .in('id', idsClientes);

        mapaSegmentos = Object.fromEntries(
          (perfilesRFM || []).map((p: any) => [p.id, p.segmento_rfm || 'Sin Segmentar'])
        );
      }

      const transaccionesRecientes = ultimasVentas.map((v: any) => ({
        ...v,
        segmento_rfm: mapaSegmentos[v.id_cliente] || null,
      }));

      // 4. OBTENER CLIENTES FILTRADOS (Para KPIs y Gráfico de Torta RFM)
      let queryPerfiles = supabaseServerInstance
        .from('perfiles')
        .select('id, nombres, apellidos, puntos_acumulados, segmento_rfm');

      if (clienteId && clienteId !== 'Todos') {
        queryPerfiles = queryPerfiles.eq('id', clienteId);
      }
      if (segmento && segmento !== 'Todos') {
        const stringSegmento = segmento === 'VIP' ? 'Campeones' : segmento;
        queryPerfiles = queryPerfiles.ilike('segmento_rfm', `%${stringSegmento}%`);
      }

      const { data: todosLosPerfiles, error: errPerfiles } = await queryPerfiles;
      if (errPerfiles) throw errPerfiles;

      const totalClientes = todosLosPerfiles?.length || 0;
      const totalPuntos = todosLosPerfiles?.reduce((sum, p) => sum + (p.puntos_acumulados || 0), 0) || 0;

      // IDENTIFICAR DINÁMICAMENTE AL CLIENTE VIP (El de mayor puntaje acumulado en el set actual)
      let topCliente = 'No asignado';
      if (todosLosPerfiles && todosLosPerfiles.length > 0) {
        const clonPerfiles = [...todosLosPerfiles];
        clonPerfiles.sort((a, b) => (b.puntos_acumulados || 0) - (a.puntos_acumulados || 0));
        topCliente = `${clonPerfiles[0].nombres || ''} ${clonPerfiles[0].apellidos || ''}`.trim() || 'Cliente Premium';
      }

      // Conteo estructural limpio para el gráfico de torta analítico
      const conteoRFM: Record<string, number> = { 
        'Campeones': 0, 'Leales': 0, 'En Riesgo': 0, 'Perdidos': 0, 'Nuevo Cliente': 0, 'Sin Segmentar': 0
      };

      todosLosPerfiles?.forEach(p => {
        const seg = p.segmento_rfm ? p.segmento_rfm.trim() : 'Sin Segmentar';
        if (conteoRFM[seg] !== undefined) {
          conteoRFM[seg]++;
        } else {
          conteoRFM['Sin Segmentar']++;
        }
      });

      const distribucionRFMReal = Object.keys(conteoRFM)
        .filter(key => conteoRFM[key] > 0)
        .map(name => ({
          name,
          count: conteoRFM[name]
        }));

      // 5. DETALLES DE VENTAS CRUZADOS CON EL INVENTARIO (Resolviendo filtros cruzados y especie de Animal)
      const { data: detallesVentasData, error: errDetalles } = await supabaseServerInstance
        .from('detalle_ventas')
        .select(`
          cantidad,
          id_venta,
          inventario!id_alimento (
            categoria
          )
        `); 

      if (errDetalles) console.error("❌ [LoyalData Join Error]:", errDetalles.message);

      const acumuladorCategorias: Record<string, { totalVentas: number, totalPuntosAsociados: number, conteoItems: number }> = {};
      const conteoAnimalesVenta: Record<string, number> = {};

      // Mapa de normalización: valor en BD → nombre display consistente
      const CATEGORIA_DISPLAY: Record<string, string> = {
        'perros':  'Perro',   'perro':   'Perro',
        'gatos':   'Gato',    'gato':    'Gato',
        'hamster': 'Hamster', 'hámster': 'Hamster',
        'conejos': 'Conejo',  'conejo':  'Conejo',
        'peces':   'Pez',     'pez':     'Pez',     'pece': 'Pez',
        'aves':    'Ave',     'ave':     'Ave',      'pájaros': 'Ave',
      };

      if (!errDetalles && detallesVentasData && detallesVentasData.length > 0) {
        const idsVentasValidas = new Set(todasLasVentas?.map(v => v.id_venta) || []);

        detallesVentasData.forEach((item: any) => {
          // Si filtramos por cliente y esta venta no le pertenece, se ignora del cálculo
          if (clienteId && clienteId !== 'Todos' && !idsVentasValidas.has(item.id_venta)) return;

          const inv = Array.isArray(item.inventario) ? item.inventario[0] : item.inventario;
          const categoriaRaw = inv?.categoria ? inv.categoria.trim().toLowerCase() : 'otros';
          const categoriaReal = CATEGORIA_DISPLAY[categoriaRaw] || (inv?.categoria?.trim() || 'Otros');
          const cant = Number(item.cantidad) || 0;

          // Filtro reactivo por especie — compara contra el valor normalizado
          if (animal && animal !== 'Todos' && categoriaReal.toLowerCase() !== String(animal).toLowerCase()) {
            return;
          }

          if (!acumuladorCategorias[categoriaReal]) {
            acumuladorCategorias[categoriaReal] = { totalVentas: 0, totalPuntosAsociados: 0, conteoItems: 0 };
          }

          acumuladorCategorias[categoriaReal].totalVentas += cant;
          acumuladorCategorias[categoriaReal].totalPuntosAsociados += (cant * 100); 
          acumuladorCategorias[categoriaReal].conteoItems += 1;

          // Registro acumulado para extraer la especie top
          conteoAnimalesVenta[categoriaReal] = (conteoAnimalesVenta[categoriaReal] || 0) + cant;
        });
      }

      // Determinar dinámicamente cuál es el animal que más vende bajo los filtros activos
      let topAnimalEspecie = 'Ninguno';
      let maxVentasAnimal = 0;
      Object.entries(conteoAnimalesVenta).forEach(([especie, total]) => {
        if (total > maxVentasAnimal) {
          maxVentasAnimal = total;
          topAnimalEspecie = especie;
        }
      });

      const metricasCategoriasReales = Object.keys(acumuladorCategorias).map(catKey => {
        const item = acumuladorCategorias[catKey];
        return {
          name: catKey, 
          totalVentas: item.totalVentas,
          promedioPuntos: item.conteoItems > 0 ? Math.round(item.totalPuntosAsociados / item.conteoItems) : 0
        };
      });

      if (metricasCategoriasReales.length === 0) {
        metricasCategoriasReales.push({ name: "Sin ventas en filtro", totalVentas: 0, promedioPuntos: 0 });
      }

      // 6. RETORNO DE DATOS LIMPIOS AL DASHBOARD DE CONTROLES
      return res.json({
        success: true,
        totalIngresos,
        totalClientes,
        totalPuntos,
        topCliente,               // KPI: Quién compra más
        topAnimalEspecie,         // KPI: Animales que más venden
        listaClientes,            // Selectores del Frontend
        distribuciónRFM: distribucionRFMReal,
        transaccionesRecientes: transaccionesRecientes,
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
  // =========================================================================
  // 📦 ENDPOINT: MARCAR PEDIDO LISTO PARA RETIRO + NOTIFICACIÓN
  // =========================================================================
  app.post('/api/admin/pedido-listo', async (req, res) => {
    try {
      const { id_venta, id_cliente, nombre_cliente, correo_cliente, telefono_cliente, total_venta } = req.body;

      if (!id_venta || !id_cliente) {
        return res.status(400).json({ error: 'Faltan datos del pedido.' });
      }

      const supabaseServerInstance = getSupabaseServer();

      // 1. Cambiar estado a 'listo para retiro'
      const { error: errorEstado } = await supabaseServerInstance
        .from('ventas')
        .update({ estado: 'listo para retiro' })
        .eq('id_venta', id_venta);

      if (errorEstado) throw errorEstado;

      // 2. Calcular y acreditar puntos
      const puntosGanados = Math.floor(Number(total_venta) * 0.01);

      const { data: perfil } = await supabaseServerInstance
        .from('perfiles')
        .select('puntos_acumulados, categoria_rfm')
        .eq('id', id_cliente)
        .single();

      const nuevosPuntos = (perfil?.puntos_acumulados || 0) + puntosGanados;

      await supabaseServerInstance
        .from('perfiles')
        .update({ puntos_acumulados: nuevosPuntos })
        .eq('id', id_cliente);

      // Registrar en historial de puntos
      console.log(`📊 Intentando guardar historial (retiro pedido):`, {
        id_cliente,
        tipo_movimiento: 'Ganados',
        puntos: puntosGanados,
        id_venta
      });

      const { error: errorHistorialRetiro, data: datosHistorialRetiro } = await supabaseServerInstance
        .from('historial_puntos')
        .insert([{
          id_cliente,
          tipo_movimiento: 'Ganados',
          puntos: puntosGanados,
          id_venta,
          descripcion: `Puntos por retiro pedido #${id_venta}`
        }])
        .select();

      if (errorHistorialRetiro) {
        console.error(`⚠️ Error al registrar historial (retiro):`, errorHistorialRetiro.code, errorHistorialRetiro.message, errorHistorialRetiro.details);
      } else {
        console.log(`✅ Historial de puntos (retiro) guardado:`, datosHistorialRetiro);
      }

      // 3. Armar mensaje personalizado según RFM
      const categoria = (perfil?.categoria_rfm || '').toLowerCase();
      const esRiesgo = categoria.includes('riesgo') || categoria.includes('perder') || categoria.includes('hibernando');
      const mensajeExtra = esRiesgo ? ' ¡Te extrañamos, vuelve pronto! 🐾❤️' : '';

      const mensajeWsp = `¡Hola ${nombre_cliente}! 🐾 Tu pedido #${id_venta} de MascotaShop ya está listo para retiro en nuestra sucursal. Ganaste ${puntosGanados} puntos de fidelización. Total acumulado: ${nuevosPuntos} pts.${mensajeExtra}`;

      // 4. Enviar correo de confirmación
      if (correo_cliente) {
        await transporter.sendMail({
          from: `"MascotaShop 🐾" <${process.env.SMTP_USER}>`,
          to: correo_cliente,
          subject: `¡Tu pedido #${id_venta} está listo para retiro! 🎉`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;padding:30px;border-radius:16px;background:#fff;">
              <h2 style="color:#f97316;margin-top:0;">¡Tu pedido está listo, ${nombre_cliente}! 🐾</h2>
              <p style="color:#475569;">Ya puedes pasar a retirar tu pedido <strong>#${id_venta}</strong> a nuestra sucursal.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;padding:16px;border-radius:12px;margin:20px 0;">
                <p style="margin:0;color:#9a3412;font-size:14px;"><strong>📍 Dirección:</strong> MascotaShop — Maipú, Santiago</p>
                <p style="margin:8px 0 0;color:#9a3412;font-size:14px;"><strong>🕐 Horario:</strong> Lunes a Sábado 10:00 – 20:00 hrs</p>
              </div>
              <p style="color:#475569;">Por esta compra ganaste <strong style="color:#f97316;">+${puntosGanados} puntos</strong>. Total acumulado: <strong>${nuevosPuntos} pts</strong>.</p>
              ${esRiesgo ? '<p style="color:#e11d48;">¡Te extrañamos! Fue genial tenerte de vuelta. 🐾❤️</p>' : ''}
              <hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;">
              <p style="font-size:11px;color:#94a3b8;text-align:center;">MascotaShop SpA — Sistema LoyalData 2026</p>
            </div>
          `,
        });
      }

      // 5. Enviar el mensaje real por Twilio WhatsApp (en vez de generar un link wa.me)
      const enviado = await enviarNotificacionWhatsApp({
        cliente: nombre_cliente,
        telefono: telefono_cliente,
        buyOrder: id_venta,
        monto: total_venta,
        fechaHora: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
        mensajePersonalizado: mensajeWsp,
      });

      console.log(`✅ Pedido #${id_venta} marcado como listo. Correo enviado a ${correo_cliente}. WhatsApp: ${enviado ? 'enviado ✅' : 'no enviado ⚠️'}`);

      return res.json({ success: true, whatsappEnviado: enviado, puntosGanados, nuevosPuntos });

    } catch (error: any) {
      console.error('❌ Error al marcar pedido listo:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 🔄 ENDPOINT: CAMBIAR ESTADO DE PEDIDO (pendiente → en preparación)
  // =========================================================================
  app.post('/api/admin/pedido-estado', async (req, res) => {
    try {
      const { id_venta, estado } = req.body;
      if (!id_venta || !estado) return res.status(400).json({ error: 'Faltan datos.' });

      const ESTADOS_VALIDOS = ['en preparación', 'apartado', 'listo para retiro', 'completado'];
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido: ${estado}` });
      }

      const supabaseServerInstance = getSupabaseServer();
      const { error } = await supabaseServerInstance
        .from('ventas')
        .update({ estado })
        .eq('id_venta', id_venta);

      if (error) throw error;
      return res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error al cambiar estado:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // 🎁 ENDPOINT: ENVIAR CUPÓN POR WHATSAPP (TWILIO)
  // =========================================================================
  app.post('/api/admin/enviar-cupon-whatsapp', async (req, res) => {
    try {
      const { telefono_cliente, nombre_cliente, codigo_cupon, descuento, correo_cliente } = req.body;

      if (!telefono_cliente || !codigo_cupon) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (Teléfono o Código)' });
      }

      const supabaseServerInstance = getSupabaseServer();

      // 1. Buscar el id del cliente por correo si viene
      let idCliente = null;
      if (correo_cliente) {
        const { data: usuarioAuth } = await supabaseServerInstance.auth.admin.listUsers();
        const clienteEncontrado = usuarioAuth?.users.find((u: any) => u.email === correo_cliente);
        idCliente = clienteEncontrado?.id || null;
      }

      // 2. Parsear descuento
      const esPorcentaje = /%/.test(descuento || '');
      const valorDescuento = parseFloat((descuento || '20').replace(/[^\d.]/g, '')) || 20;

      // 3. Verificar si el código ya existe para no duplicar
      const { data: cuponExistente } = await supabaseServerInstance
        .from('cupones')
        .select('id_cupon')
        .eq('codigo', codigo_cupon)
        .maybeSingle();

      if (!cuponExistente) {
        const { error: errorInsert } = await supabaseServerInstance
          .from('cupones')
          .insert([{
            codigo: codigo_cupon,
            id_cliente: idCliente,
            descuento_tipo: esPorcentaje ? 'porcentaje' : 'monto_fijo',
            descuento_valor: valorDescuento,
          }]);

        if (errorInsert) {
          console.error('❌ Error al guardar cupón en BD:', errorInsert.message);
          return res.status(400).json({ error: `No se pudo guardar el cupón: ${errorInsert.message}` });
        }
        console.log(`✅ Cupón ${codigo_cupon} guardado en Supabase.`);
      } else {
        console.log(`ℹ️ Cupón ${codigo_cupon} ya existía en la BD — no se duplica.`);
      }

      // 4. Enviar por WhatsApp
      const nombre = nombre_cliente || 'Amigo/a';
      const descuentoTexto = esPorcentaje
        ? `*${valorDescuento}% DE DESCUENTO*`
        : `*$${valorDescuento.toLocaleString('es-CL')} de descuento*`;

      const mensajeCupon =
        `🎁 *MascotaShop* — Beneficio Exclusivo\n\n` +
        `¡Hola *${nombre}*! Queremos consentir a tu mascota. 🐾\n\n` +
        `Te regalamos un cupón de ${descuentoTexto}.\n\n` +
        `🏷️ Código: *${codigo_cupon}*\n\n` +
        `📝 Cómo usarlo:\n` +
        `1️⃣ Agrega productos al carrito\n` +
        `2️⃣ En "¿Tienes un cupón?" ingresa: ${codigo_cupon}\n` +
        `3️⃣ El descuento se aplica automáticamente ✅\n` +
        `4️⃣ ¡Paga normalmente! 💳\n\n` +
        `¡Te esperamos en MascotaShop! 🛍️`;

      const enviado = await enviarNotificacionWhatsApp({
        telefono: telefono_cliente,
        mensajePersonalizado: mensajeCupon,
      });

      if (!enviado) {
        return res.status(400).json({ error: 'Cupón guardado en BD pero no se pudo enviar el WhatsApp.' });
      }

      console.log(`🎁 [Admin] Cupón ${codigo_cupon} enviado por WhatsApp a ${telefono_cliente}`);
      return res.json({ success: true, message: 'Cupón guardado y enviado por WhatsApp.' });

    } catch (error: any) {
      console.error('❌ Error al enviar cupón por WhatsApp:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

    app.post('/api/admin/enviar-cupon', async (req, res) => {
    try {
      const { correo_cliente, nombre_cliente, codigo_cupon, descuento } = req.body;

      if (!correo_cliente || !codigo_cupon) {
        return res.status(400).json({ error: "Faltan datos obligatorios (Correo o Código)" });
      }

      const supabaseServerInstance = getSupabaseServer();

      // 1. Buscar el id del cliente a partir del correo (vía Supabase Auth)
      const { data: usuarioAuth } = await supabaseServerInstance.auth.admin.listUsers();
      const clienteEncontrado = usuarioAuth?.users.find((u: { email?: string }) => u.email === correo_cliente);

      // 2. Parsear el descuento real desde la glosa del formulario
      // Ej: '20% DE DESCUENTO' → tipo: porcentaje, valor: 20
      // Ej: '5000 PESOS' → tipo: monto_fijo, valor: 5000
      const esPorcentaje = /%/.test(descuento || '');
      const valorDescuento = parseFloat((descuento || '20').replace(/[^\d.]/g, '')) || 20;

      console.log(`🎁 [ADMIN CUPON] Guardando: ${codigo_cupon} | ${esPorcentaje ? 'porcentaje' : 'monto_fijo'} | valor: ${valorDescuento}`);

      // 3. Registrar el cupón en la base de datos (única fuente de verdad) con 20% de descuento
      const { data: cuponeData, error: errorCupon } = await supabaseServerInstance
        .from('cupones')
        .insert([{
          codigo: codigo_cupon,
          id_cliente: clienteEncontrado?.id || null,
          descuento_tipo: esPorcentaje ? 'porcentaje' : 'monto_fijo',
          descuento_valor: valorDescuento,
        }])
        .select();

      if (errorCupon) {
        // Código duplicado u otro error de validación: no enviamos el correo si no quedó registrado
        console.error("❌ Error al registrar el cupón:", errorCupon.code, errorCupon.message, errorCupon.details);
        return res.status(400).json({ error: `No se pudo registrar el cupón: ${errorCupon.message}` });
      }

      console.log(`✅ Cupón guardado exitosamente en Supabase:`, cuponeData);

      await transporter.sendMail({
        from: `"MascotaShop VIP 🏆" <${process.env.SMTP_USER}>`,
        to: correo_cliente,
        subject: `¡Tienes un cupón de 20% de DESCUENTO de regalo! 🎁`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; background-color: #0b1329; color: #ffffff; padding: 35px; border-radius: 20px; text-align: center;">
            <span style="background-color: #f97316; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Beneficio Exclusivo - 20% OFF</span>
            <h2 style="color: #10b981; margin-top: 20px; font-size: 24px;">¡Felicidades ${nombre_cliente || 'Cliente'}! 🏆</h2>
            <p style="color: #94a3b8; font-size: 16px;">El administrador de MascotaShop te ha otorgado un descuento especial del <strong style="color: #f97316;">20%</strong> en tu próxima compra.</p>
            <div style="background-color: #1e293b; padding: 25px; border-radius: 14px; margin: 25px 0; border: 2px dashed #f97316;">
              <p style="margin: 0; color: #94a3b8; font-size: 15px;">Tu código de cupón es:</p>
              <h1 style="margin: 12px 0; color: #f97316; letter-spacing: 5px; font-size: 32px;">${codigo_cupon}</h1>
              <p style="margin: 8px 0 0 0; color: #10b981; font-size: 14px; font-weight: bold;">✅ Descuento: 20% en tu próxima compra</p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">Ingresa este código en el carrito al finalizar</p>
            </div>
            <p style="color: #94a3b8; margin-top: 20px; font-size: 14px;"><strong>¿Cómo usarlo?</strong></p>
            <ol style="color: #64748b; text-align: left; display: inline-block; font-size: 13px;">
              <li>Agrega productos a tu carrito 🛒</li>
              <li>En la sección "¿Tienes un cupón?", ingresa: <strong>${codigo_cupon}</strong></li>
              <li>El descuento del 20% se aplicará automáticamente ✅</li>
              <li>¡Paga normalmente! 💳</li>
            </ol>
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
            <p style="font-size: 11px; color: #475569; margin: 0;">Este cupón es válido en una única compra y es intransferible. Si tienes dudas, contáctanos.</p>
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

  return app;
}

export async function startServer() {
  const app = await createApp();
  const preferredPort = Number(process.env.PORT || 3000);
  const initialPort = Number.isNaN(preferredPort) || preferredPort <= 0 ? 0 : preferredPort;

  return new Promise((resolve, reject) => {
    const tryListen = (portToTry: number) => {
      const server = app.listen(portToTry, "0.0.0.0", () => {
        const actualPort = (server.address() as any)?.port ?? portToTry;
        console.log(`🚀 Servidor Express escuchando en http://localhost:${actualPort}`);
        resolve(server);
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' && portToTry !== 0) {
          console.warn(`⚠️ Puerto ${portToTry} ocupado, intentando un puerto libre...`);
          server.close();
          tryListen(0);
        } else {
          reject(error);
        }
      });
    };

    tryListen(initialPort);
  });
}

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

const isDirectRun = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (!process.env.VERCEL && isDirectRun) {
  startServer().catch((err) => {
    console.error('❌ Error al iniciar el servidor:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}