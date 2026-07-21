import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServer } from "../../src/lib/supabaseServer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const supabaseServerInstance = getSupabaseServer();

    const { clienteId, animal, segmento } = req.query;

    const { data: perfilesDropdown } = await supabaseServerInstance.from("perfiles").select("id, nombres, apellidos");

    const listaClientes = (perfilesDropdown || []).map((c) => ({
      id: c.id,
      nombre: `${c.nombres || ""} ${c.apellidos || ""}`.trim() || "Cliente Sin Identificar",
    }));

    let queryVentas = supabaseServerInstance
      .from("ventas")
      .select("id_venta, id_cliente, total_venta, fecha_venta")
      .eq("estado", "completado")
      .order("fecha_venta", { ascending: false });

    if (clienteId && clienteId !== "Todos") {
      queryVentas = queryVentas.eq("id_cliente", clienteId);
    }

    const { data: todasLasVentas, error: errVentas } = await queryVentas;
    if (errVentas) throw errVentas;

    const totalIngresos = todasLasVentas?.reduce((sum, v) => sum + Number(v.total_venta), 0) || 0;

    let ventasFiltradas = todasLasVentas || [];

    if (animal && animal !== "Todos") {
      const { data: detallesFiltro } = await supabaseServerInstance
        .from("detalle_ventas")
        .select("id_venta, inventario!id_alimento(categoria)");

      const CATEGORIA_NORM: Record<string, string> = {
        perros: "Perro",
        perro: "Perro",
        gatos: "Gato",
        gato: "Gato",
        hamster: "Hamster",
        conejos: "Conejo",
        conejo: "Conejo",
        peces: "Pez",
        pez: "Pez",
        aves: "Ave",
        ave: "Ave",
      };

      const idsVentasConAnimal = new Set(
        (detallesFiltro || [])
          .filter((d: any) => {
            const inv = Array.isArray(d.inventario) ? d.inventario[0] : d.inventario;
            const cat = CATEGORIA_NORM[(inv?.categoria || "").trim().toLowerCase()] || "";
            return cat.toLowerCase() === String(animal).toLowerCase();
          })
          .map((d: any) => d.id_venta)
      );

      ventasFiltradas = ventasFiltradas.filter((v) => idsVentasConAnimal.has(v.id_venta));
    }

    const ultimasVentas = ventasFiltradas.slice(0, 10);

    const idsClientes = [...new Set(ultimasVentas.map((v: any) => v.id_cliente).filter(Boolean))];
    let mapaSegmentos: Record<string, string> = {};

    if (idsClientes.length > 0) {
      const { data: perfilesRFM } = await supabaseServerInstance.from("perfiles").select("id, segmento_rfm").in("id", idsClientes);

      mapaSegmentos = Object.fromEntries((perfilesRFM || []).map((p: any) => [p.id, p.segmento_rfm || "Sin Segmentar"]));
    }

    const transaccionesRecientes = ultimasVentas.map((v: any) => ({
      ...v,
      segmento_rfm: mapaSegmentos[v.id_cliente] || null,
    }));

    let queryPerfiles = supabaseServerInstance.from("perfiles").select("id, nombres, apellidos, puntos_acumulados, segmento_rfm");

    if (clienteId && clienteId !== "Todos") {
      queryPerfiles = queryPerfiles.eq("id", clienteId);
    }
    if (segmento && segmento !== "Todos") {
      const stringSegmento = segmento === "VIP" ? "Campeones" : segmento;
      queryPerfiles = queryPerfiles.ilike("segmento_rfm", `%${stringSegmento}%`);
    }

    const { data: todosLosPerfiles, error: errPerfiles } = await queryPerfiles;
    if (errPerfiles) throw errPerfiles;

    const totalClientes = todosLosPerfiles?.length || 0;
    const totalPuntos = todosLosPerfiles?.reduce((sum, p) => sum + (p.puntos_acumulados || 0), 0) || 0;

    let topCliente = "No asignado";
    if (todosLosPerfiles && todosLosPerfiles.length > 0) {
      const clonPerfiles = [...todosLosPerfiles];
      clonPerfiles.sort((a, b) => (b.puntos_acumulados || 0) - (a.puntos_acumulados || 0));
      topCliente = `${clonPerfiles[0].nombres || ""} ${clonPerfiles[0].apellidos || ""}`.trim() || "Cliente Premium";
    }

    const conteoRFM: Record<string, number> = {
      Campeones: 0,
      Leales: 0,
      "En Riesgo": 0,
      Perdidos: 0,
      "Nuevo Cliente": 0,
      "Sin Segmentar": 0,
    };

    todosLosPerfiles?.forEach((p) => {
      const seg = p.segmento_rfm ? p.segmento_rfm.trim() : "Sin Segmentar";
      if (conteoRFM[seg] !== undefined) {
        conteoRFM[seg]++;
      } else {
        conteoRFM["Sin Segmentar"]++;
      }
    });

    const distribucionRFMReal = Object.keys(conteoRFM)
      .filter((key) => conteoRFM[key] > 0)
      .map((name) => ({ name, count: conteoRFM[name] }));

    const { data: detallesVentasData, error: errDetalles } = await supabaseServerInstance.from("detalle_ventas").select(`
        cantidad,
        id_venta,
        inventario!id_alimento (
          categoria
        )
      `);

    if (errDetalles) console.error("❌ [LoyalData Join Error]:", errDetalles.message);

    const acumuladorCategorias: Record<string, { totalVentas: number; totalPuntosAsociados: number; conteoItems: number }> = {};
    const conteoAnimalesVenta: Record<string, number> = {};

    const CATEGORIA_DISPLAY: Record<string, string> = {
      perros: "Perro",
      perro: "Perro",
      gatos: "Gato",
      gato: "Gato",
      hamster: "Hamster",
      hámster: "Hamster",
      conejos: "Conejo",
      conejo: "Conejo",
      peces: "Pez",
      pez: "Pez",
      pece: "Pez",
      aves: "Ave",
      ave: "Ave",
      pájaros: "Ave",
    };

    if (!errDetalles && detallesVentasData && detallesVentasData.length > 0) {
      const idsVentasValidas = new Set(todasLasVentas?.map((v) => v.id_venta) || []);

      detallesVentasData.forEach((item: any) => {
        if (clienteId && clienteId !== "Todos" && !idsVentasValidas.has(item.id_venta)) return;

        const inv = Array.isArray(item.inventario) ? item.inventario[0] : item.inventario;
        const categoriaRaw = inv?.categoria ? inv.categoria.trim().toLowerCase() : "otros";
        const categoriaReal = CATEGORIA_DISPLAY[categoriaRaw] || (inv?.categoria?.trim() || "Otros");
        const cant = Number(item.cantidad) || 0;

        if (animal && animal !== "Todos" && categoriaReal.toLowerCase() !== String(animal).toLowerCase()) {
          return;
        }

        if (!acumuladorCategorias[categoriaReal]) {
          acumuladorCategorias[categoriaReal] = { totalVentas: 0, totalPuntosAsociados: 0, conteoItems: 0 };
        }

        acumuladorCategorias[categoriaReal].totalVentas += cant;
        acumuladorCategorias[categoriaReal].totalPuntosAsociados += cant * 100;
        acumuladorCategorias[categoriaReal].conteoItems += 1;

        conteoAnimalesVenta[categoriaReal] = (conteoAnimalesVenta[categoriaReal] || 0) + cant;
      });
    }

    let topAnimalEspecie = "Ninguno";
    let maxVentasAnimal = 0;
    Object.entries(conteoAnimalesVenta).forEach(([especie, total]) => {
      if (total > maxVentasAnimal) {
        maxVentasAnimal = total;
        topAnimalEspecie = especie;
      }
    });

    const metricasCategoriasReales = Object.keys(acumuladorCategorias).map((catKey) => {
      const item = acumuladorCategorias[catKey];
      return {
        name: catKey,
        totalVentas: item.totalVentas,
        promedioPuntos: item.conteoItems > 0 ? Math.round(item.totalPuntosAsociados / item.conteoItems) : 0,
      };
    });

    if (metricasCategoriasReales.length === 0) {
      metricasCategoriasReales.push({ name: "Sin ventas en filtro", totalVentas: 0, promedioPuntos: 0 });
    }

    return res.json({
      success: true,
      totalIngresos,
      totalClientes,
      totalPuntos,
      topCliente,
      topAnimalEspecie,
      listaClientes,
      distribuciónRFM: distribucionRFMReal,
      transaccionesRecientes: transaccionesRecientes,
      metricasCategorias: metricasCategoriasReales,
    });
  } catch (error: any) {
    console.error("❌ Error al obtener métricas consolidadas del CRM:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
