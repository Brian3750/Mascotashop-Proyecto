import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Loader, Award } from 'lucide-react';

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
  user_metadata?: {
    full_name?: string;
  };
}

export default function PerfilUsuario() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

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

      setUserInfo({
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
        puntos_acumulados: perfilData?.puntos_acumulados ?? 0,
      });

      // 3. Obtener el listado de mascotas con sus relaciones
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
      
      {/* SECCIÓN SUPERIOR: Info Usuario & Tarjeta de Puntos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Info Básica del Usuario */}
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

        {/* Tarjeta de Puntos Acumulados (Fidelización) */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 bg-white/10 w-32 h-32 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Club Mascotas
            </span>
            <Award className="text-orange-100 h-6 w-6 opacity-90" />
          </div>

          <div className="mt-4">
            <span className="block text-3xl font-black italic tracking-tight">
              {userInfo?.puntos_acumulados.toLocaleString('es-CL')}
            </span>
            <span className="text-xs text-orange-100 font-medium">
              Puntos acumulados
            </span>
          </div>
        </div>

      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-600 mb-8">
          {error}
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