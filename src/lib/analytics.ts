import { supabase } from './supabaseClient';

/**
 * Función centralizada que envía trazas de interacción del usuario a MongoDB Atlas.
 * @param evento Nombre de la acción (ej: 'visualizacion_producto', 'click_sin_stock')
 * @param producto Objeto con los datos del producto interactuado
 */
export const registrarInteraccionMongo = async (evento: string, producto: any) => {
  try {
    // 1. Obtener el usuario logueado desde tu Supabase Auth local
    const { data: { user } } = await supabase.auth.getUser();

    // Si no hay una sesión activa, se ignora el log por regla del profesor
    if (!user) {
      console.warn(`⚠️ [Trazabilidad] Evento '${evento}' ignorado: No hay usuario autenticado.`);
      return;
    }

    // CORRECCIÓN: Usamos la URL absoluta con el puerto 3000 de Express de forma explícita
    // Esto evita que Vite intente resolver la ruta internamente y tire el 404
    const respuesta = await fetch(`${window.location.origin}/api/trazabilidad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id_usuario: user.id, // Enviamos el UUID de Supabase Auth
        evento: evento,
        data_producto: {
          id_producto: producto?.id_alimento || producto?.id || producto?.id_producto || null,
          nombre: producto?.nombre || "Desconocido",
          categoria: producto?.categoria || "Alimentos",
          stock: producto?.stock ?? 0
        }
      })
    });

    // Validar si la respuesta falló a nivel HTTP (como un 404 o 500)
    if (!respuesta.ok) {
      throw new Error(`El servidor respondió con estado ${respuesta.status}`);
    }

    const resultado = await respuesta.json();
    
    if (resultado.success) {
      console.log(`🚀 [MongoDB Atlas] Métrica guardada con éxito. ID: ${resultado.logId}`);
    } else {
      console.error("❌ Error en la respuesta del servidor de trazabilidad:", resultado.error);
    }
  } catch (error: any) {
    console.error("❌ Fallo crítico al conectar con el endpoint de trazabilidad:", error.message);
  }
};