import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Loader, Award, ShoppingCart, MousePointer2, ChevronDown, ChevronUp } from 'lucide-react';

interface Mascota {
  id_mascota: number;
  nombre: string;
  especie: string;
  raza: string;
  edad: number;
}

interface UserInfo {
  id: string;
  email: string;
  puntos_acumulados: number;
  total_compras: number;
  total_clicks: number;
  user_metadata?: {
    full_name?: string;
  };
}

interface Compra {
  id_venta: number;
  total_venta: number;
  fecha_venta: string;
  cantidad_items: number;
}

interface Click {
  evento: string;
  nombre_producto: string;
  timestamp: string;
}

interface MovimientoPuntos {
  id_movimiento: number;
  tipo_movimiento: string;
  puntos: number;
  descripcion: string | null;
  fecha: string;
  id_venta: number | null;
}

export default function PerfilUsuario() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCompras, setExpandedCompras] = useState(false);
  const [expandedClicks, setExpandedClicks] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [clicks, setClicks] = useState<Click[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const [expandedPuntos, setExpandedPuntos] = useState(false);
  const [historialPuntos, setHistorialPuntos] = useState<MovimientoPuntos[]>([]);
  const [loadingPuntos, setLoadingPuntos] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadCompras = async () => {
    if (!userInfo) return;
    setLoadingCompras(true);
    try {
      const respuesta = await fetch(
        `${window.location.origin}/api/usuario/compras?id_usuario=${userInfo.id}`
      );
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setCompras(datos.compras || []);
      }
    } catch (err: any) {
      console.warn('⚠️ Error cargando compras:', err.message);
    } finally {
      setLoadingCompras(false);
    }
  };

  const loadClicks = async () => {
    if (!userInfo) return;
    setLoadingClicks(true);
    try {
      const respuesta = await fetch(
        `${window.location.origin}/api/usuario/clicks?id_usuario=${userInfo.id}`
      );
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setClicks(datos.clicks || []);
      }
    } catch (err: any) {
      console.warn('⚠️ Error cargando clicks:', err.message);
    } finally {
      setLoadingClicks(false);
    }
  };

  const toggleCompras = () => {
    if (!expandedCompras && compras.length === 0) {
      loadCompras();
    }
    setExpandedCompras(!expandedCompras);
  };

  const toggleClicks = () => {
    if (!expandedClicks && clicks.length === 0) {
      loadClicks();
    }
    setExpandedClicks(!expandedClicks);
  };

  const loadHistorialPuntos = async () => {
    if (!userInfo) return;
    setLoadingPuntos(true);
    try {
      const { data, error } = await supabase
        .from('historial_puntos')
        .select('id_movimiento, tipo_movimiento, puntos, descripcion, fecha, id_venta')
        .eq('id_cliente', userInfo.id)
        .order('fecha', { ascending: false })
        .limit(20);
      if (!error) setHistorialPuntos(data || []);
    } catch (err: any) {
      console.warn('⚠️ Error cargando historial de puntos:', err.message);
    } finally {
      setLoadingPuntos(false);
    }
  };

  const togglePuntos = () => {
    if (!expandedPuntos && historialPuntos.length === 0) {
      loadHistorialPuntos();
    }
    setExpandedPuntos(!expandedPuntos);
  };

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Obtener el usuario autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('No hay un usuario autenticado activo.');
        setLoading(false);
        return;
      }

      // 2. Obtener puntos acumulados de la tabla 'perfiles'
      const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('puntos_acumulados')
        .eq('id', user.id)
        .single();

      if (perfilError) {
        console.error('❌ Error cargando puntos del perfil:', perfilError.message);
      }

      // 3. Obtener estadísticas (compras y clicks)
      let totalCompras = 0;
      let totalClicks = 0;
      try {
        const respuestaEstadisticas = await fetch(
          `${window.location.origin}/api/usuario/estadisticas?id_usuario=${user.id}`
        );
        if (respuestaEstadisticas.ok) {
          const datosEstadisticas = await respuestaEstadisticas.json();
          totalCompras = datosEstadisticas.totalCompras || 0;
          totalClicks = datosEstadisticas.totalClicks || 0;
        }
      } catch (err: any) {
        console.warn('⚠️ Error cargando estadísticas:', err.message);
      }

      setUserInfo({
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
        puntos_acumulados: perfilData?.puntos_acumulados ?? 0,
        total_compras: totalCompras,
        total_clicks: totalClicks,
      });

      // 4. Obtener el listado de mascotas con sus relaciones
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: mascotasData, error: mascotasError } = await supabase
        .from('mascotas')
        .select(`
          id_mascota,
          nombre,
          edad,
          especie(id_especie, nombre_especie),
          razas(id_raza, nombre_raza)
        `)
        .eq('id_usuario', user.id);

      if (mascotasError) {
        console.error('❌ Error cargando mascotas:', mascotasError.message);
        setError('No se pudieron cargar las mascotas.');
      } else {
        const mascotasConNombres = (mascotasData || []).map((item: any) => ({
          id_mascota: item.id_mascota,
          nombre: item.nombre,
          edad: item.edad,
          especie: item.especie?.nombre_especie ?? 'Sin especie',
          raza: item.razas?.nombre_raza ?? 'Sin raza',
        }));
        setMascotas(mascotasConNombres);
      }
    } catch (err: any) {
      console.error('❌ Error en loadProfileData del cliente:', err);
      setError(err.message || 'Error al cargar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin text-orange-500 h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      
      {/* SECCIÓN SUPERIOR: Info Usuario & Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        
        {/* Info Básica del Usuario - Ocupa 2 espacios */}
        <div className="md:col-span-2 bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex items-center gap-4">
          <div className="bg-orange-100 p-4 rounded-2xl flex-shrink-0">
            <User className="text-orange-500 h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-gray-800 italic">Mi Perfil</h2>
            <p className="text-gray-500 text-sm truncate">{userInfo?.email}</p>
            {userInfo?.user_metadata?.full_name && (
              <p className="text-gray-700 font-bold mt-1">{userInfo.user_metadata.full_name}</p>
            )}
          </div>
        </div>

        {/* Tarjeta de Puntos Acumulados — clickeable para ver historial */}
        <div
          onClick={togglePuntos}
          className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
        >
          <div className="absolute -right-8 -bottom-8 bg-white/10 w-32 h-32 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Fidelización
            </span>
            <div className="flex items-center gap-2">
              <Award className="text-orange-100 h-6 w-6 opacity-90" />
              {expandedPuntos ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>

          <div className="mt-4">
            <span className="block text-3xl font-black italic tracking-tight">
              {userInfo?.puntos_acumulados.toLocaleString('es-CL')}
            </span>
            <span className="text-xs text-orange-100 font-medium">
              Puntos acumulados · ver historial
            </span>
          </div>
        </div>

        {/* Tarjeta de Compras */}
        <div 
          onClick={toggleCompras}
          className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
        >
          <div className="absolute -right-8 -bottom-8 bg-white/10 w-32 h-32 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Compras
            </span>
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-green-100 h-6 w-6 opacity-90" />
              {expandedCompras ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-4">
            <span className="block text-3xl font-black italic tracking-tight">
              {userInfo?.total_compras.toLocaleString('es-CL')}
            </span>
            <span className="text-xs text-green-100 font-medium">
              Compras realizadas
            </span>
          </div>
        </div>

        {/* Tarjeta de Clicks */}
        <div 
          onClick={toggleClicks}
          className="bg-gradient-to-br from-purple-500 to-violet-600 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
        >
          <div className="absolute -right-8 -bottom-8 bg-white/10 w-32 h-32 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Interacción
            </span>
            <div className="flex items-center gap-2">
              <MousePointer2 className="text-purple-100 h-6 w-6 opacity-90" />
              {expandedClicks ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </div>

          <div className="mt-4">
            <span className="block text-3xl font-black italic tracking-tight">
              {userInfo?.total_clicks.toLocaleString('es-CL')}
            </span>
            <span className="text-xs text-purple-100 font-medium">
              Clicks realizados
            </span>
          </div>
        </div>

      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-600 mb-8">
          {error}
        </div>
      )}

      {/* SECCIÓN DESPLEGABLE: Historial de Puntos */}
      {expandedPuntos && (
        <div className="bg-orange-50 border-2 border-orange-300 p-6 rounded-3xl shadow-lg mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 italic flex items-center gap-2">
              🏅 Historial de Puntos
            </h3>
            <button onClick={togglePuntos} className="text-orange-600 hover:text-orange-700 transition">
              <ChevronUp className="h-6 w-6" />
            </button>
          </div>

          {loadingPuntos ? (
            <div className="flex justify-center py-8">
              <Loader className="animate-spin text-orange-500 h-8 w-8" />
            </div>
          ) : historialPuntos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Aún no tienes movimientos de puntos registrados.</p>
              <p className="text-gray-400 text-xs mt-1">Los puntos se acreditan automáticamente después de cada compra.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {historialPuntos.map((mov) => {
                const esGanado = mov.tipo_movimiento === 'Ganados';
                const esCanjeado = mov.tipo_movimiento === 'Canjeados';
                return (
                  <div
                    key={mov.id_movimiento}
                    className="bg-white p-4 rounded-xl border border-orange-200 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            esGanado    ? 'bg-emerald-100 text-emerald-700' :
                            esCanjeado  ? 'bg-blue-100 text-blue-700' :
                                          'bg-gray-100 text-gray-500'
                          }`}>
                            {mov.tipo_movimiento}
                          </span>
                          {mov.id_venta && (
                            <span className="text-[10px] text-gray-400">Orden #{mov.id_venta}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{mov.descripcion || '—'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(mov.fecha).toLocaleDateString('es-CL', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <span className={`text-xl font-black ${esGanado ? 'text-emerald-600' : 'text-red-500'}`}>
                          {esGanado ? '+' : '-'}{mov.puntos.toLocaleString('es-CL')}
                        </span>
                        <p className="text-[10px] text-gray-400">pts</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN DESPLEGABLE: Detalle de Compras */}
      {expandedCompras && (
        <div className="bg-green-50 border-2 border-green-300 p-6 rounded-3xl shadow-lg mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 italic flex items-center gap-2">
              🛒 Detalle de Compras
            </h3>
            <button
              onClick={toggleCompras}
              className="text-green-600 hover:text-green-700 transition"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
          </div>

          {loadingCompras ? (
            <div className="flex justify-center py-8">
              <Loader className="animate-spin text-green-500 h-8 w-8" />
            </div>
          ) : compras.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No tienes compras registradas aún.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {compras.map((compra, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-xl border border-green-200 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">Orden #{compra.id_venta}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(compra.fecha_venta).toLocaleDateString('es-CL')}
                      </p>
                      <p className="text-xs text-green-600 font-semibold mt-1">
                        {compra.cantidad_items} {compra.cantidad_items === 1 ? 'artículo' : 'artículos'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-green-600">
                        ${compra.total_venta.toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN DESPLEGABLE: Detalle de Clicks */}
      {expandedClicks && (
        <div className="bg-purple-50 border-2 border-purple-300 p-6 rounded-3xl shadow-lg mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 italic flex items-center gap-2">
              👆 Detalle de Interacciones
            </h3>
            <button
              onClick={toggleClicks}
              className="text-purple-600 hover:text-purple-700 transition"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
          </div>

          {loadingClicks ? (
            <div className="flex justify-center py-8">
              <Loader className="animate-spin text-purple-500 h-8 w-8" />
            </div>
          ) : clicks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No tienes interacciones registradas aún.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {clicks.map((click, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-xl border border-purple-200 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{click.nombre_producto}</p>
                      <p className="text-sm text-purple-600 font-semibold capitalize mt-1">
                        {click.evento.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(click.timestamp).toLocaleDateString('es-CL')} - {new Date(click.timestamp).toLocaleTimeString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN INFERIOR: Listado de Mascotas */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6 italic flex items-center gap-2">
          🐾 Mis Mascotas
        </h3>

        {mascotas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">Aún no tienes mascotas registradas.</p>
            <p className="text-gray-500 text-xs">Añade tu primera mascota desde tu panel de registro.</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1">
            {mascotas.map((mascota) => (
              <div 
                key={mascota.id_mascota}
                className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-5 rounded-2xl border border-orange-200/60 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">{mascota.nombre}</h4>
                    <p className="text-orange-600 text-xs font-bold capitalize mt-0.5">
                      {mascota.raza} · {mascota.especie}
                    </p>
                  </div>
                  <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-orange-500 border border-orange-200">
                    {mascota.edad} {mascota.edad === 1 ? 'año' : 'años'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}