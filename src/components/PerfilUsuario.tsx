import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Loader } from 'lucide-react';

interface Mascota {
  id_mascota: number;
  nombre: string;
  especie: string;
  edad: number;
}

interface UserInfo {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export default function UserProfile() {
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

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('No hay un usuario autenticado activo.');
        setLoading(false);
        return;
      }

      setUserInfo({
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
      });

      const { data: mascotasData, error: mascotasError } = await supabase
        .from('mascotas')
        .select('*')
        .eq('id_usuario', user.id);

      if (mascotasError) {
        console.error('❌ Error cargando mascotas:', mascotasError.message);
        setError('No se pudieron cargar las mascotas.');
      } else {
        setMascotas(mascotasData || []);
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
      
      {/* SECCIÓN SUPERIOR: Info Usuario & Tarjeta de Fidelización */}
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

      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-600 mb-8">
          {error}
        </div>
      )}

      <div className="mt-8 bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        
        {/* Columna Izquierda: Mascotas */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
          <h3 className="text-xl font-bold text-gray-800 mb-6 italic flex items-center gap-2">
            🐾 Mis Mascotas
          </h3>

          {mascotas.length === 0 ? (
            <div className="text-center py-12 flex-1 flex flex-col justify-center">
              <p className="text-gray-400 mb-2">Aún no tienes mascotas registradas.</p>
              <p className="text-gray-500 text-xs">Regresa al home para añadir tu primera mascota.</p>
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
                      <p className="text-orange-600 text-xs font-bold capitalize mt-0.5">{mascota.especie}</p>
                    </div>
                    <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-orange-500 border border-orange-200">
                      {mascota.edad} {mascota.edad === 1 ? 'año' : 'años'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-orange-200/40">
                    ID Mascota: #{mascota.id_mascota}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}