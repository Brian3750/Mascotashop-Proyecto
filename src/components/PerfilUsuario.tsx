import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Loader } from 'lucide-react';

interface Mascota {
  id_mascota: number;
  nombre: string;
  especie: string;
  edad: number;
  id_usuario: string;
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

      // 1. Obtener información del usuario autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("No hay un usuario autenticado activo.");
        setLoading(false);
        return;
      }

      setUserInfo({
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
      });

      // 2. Obtener mascotas del usuario
      const { data: mascotasData, error: mascotasError } = await supabase
        .from('mascotas')
        .select('*')
        .eq('id_usuario', user.id); // Trae solo las mascotas del usuario logueado

      if (mascotasError) {
        console.error("Error al obtener mascotas:", mascotasError);
        setError("No se pudieron cargar las mascotas.");
      } else {
        setMascotas(mascotasData || []);
      }
    } catch (err: any) {
      console.error("Error en loadProfileData:", err);
      setError(err.message || "Error al cargar el perfil.");
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
      {/* Información del Usuario */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-orange-100 p-4 rounded-2xl">
            <User className="text-orange-500 h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 italic">Mi Perfil</h2>
            <p className="text-gray-500 text-sm">{userInfo?.email}</p>
          </div>
        </div>
      </div>

      {/* Sección de Mascotas */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6 italic">Mis Mascotas</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-600 mb-6">
            {error}
          </div>
        )}

        {mascotas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Aún no tienes mascotas registradas.</p>
            <p className="text-gray-500 text-sm">Regresa a la página principal para registrar tu primera mascota.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mascotas.map((mascota) => (
              <div 
                key={mascota.id_mascota}
                className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border-2 border-orange-200 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">{mascota.nombre}</h4>
                    <p className="text-orange-600 font-semibold capitalize">{mascota.especie}</p>
                  </div>
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-bold text-orange-500 border border-orange-200">
                    {mascota.edad} {mascota.edad === 1 ? 'año' : 'años'}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-4 pt-4 border-t border-orange-200">
                  <p>ID: {mascota.id_mascota}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
