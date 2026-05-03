import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Dog, Save } from 'lucide-react';

export default function RegistroMascota() {
  const [especies, setEspecies] = useState<any[]>([]);
  const [tamanos, setTamanos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estado simplificado: ya no pedimos el RUT manualmente
  const [formData, setFormData] = useState({
    nombre: '',
    edad: '',
    id_especie: '',
    id_tamano: ''
  });

  // Carga de selectores (Especies y Tamaños)
  useEffect(() => {
    async function loadData() {
      const { data: esp } = await supabase.from('especie').select('*');
      const { data: tam } = await supabase.from('tamano').select('*');
      if (esp) setEspecies(esp);
      if (tam) setTamanos(tam);
    }
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Obtenemos al usuario logueado actualmente
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Debes estar logueado para registrar una mascota.");
        setLoading(false);
        return;
      }

      // 2. Insertamos en la tabla 'mascotas' usando el ID del usuario como 'id_cliente'
      const { error } = await supabase.from('mascotas').insert([
        { 
          nombre: formData.nombre,
          edad: parseInt(formData.edad),
          id_especie: parseInt(formData.id_especie),
          id_tamano: parseInt(formData.id_tamano),
          id_cliente: user.id // <--- Relación automática con el dueño
        }
      ]);

      if (error) throw error;

      alert("¡Mascota registrada exitosamente!");
      
      // Limpiamos el formulario
      setFormData({ 
        nombre: '', 
        edad: '', 
        id_especie: '', 
        id_tamano: '' 
      });

    } catch (error: any) {
      console.error("Error en registro:", error.message);
      alert("No se pudo registrar la mascota: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-3 rounded-2xl">
          <Dog className="text-orange-500 h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 italic">Nueva Mascota</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo Nombre */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">Nombre</label>
          <input
            type="text"
            placeholder="Ej: Bobby"
            className="w-full p-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all"
            value={formData.nombre}
            onChange={(e) => setFormData({...formData, nombre: e.target.value})}
            required
          />
        </div>
        
        {/* Campo Edad */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">Edad (Años)</label>
          <input
            type="number"
            placeholder="Ej: 3"
            className="w-full p-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all"
            value={formData.edad}
            onChange={(e) => setFormData({...formData, edad: e.target.value})}
            required
          />
        </div>

        {/* Selector Especie */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">Especie</label>
          <select 
            className="w-full p-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-gray-600"
            value={formData.id_especie}
            onChange={(e) => setFormData({...formData, id_especie: e.target.value})}
            required
          >
            <option value="">Selecciona una especie</option>
            {especies.map(e => (
              <option key={e.id_especie} value={e.id_especie}>
                {e.nombre_especie}
              </option>
            ))}
          </select>
        </div>

        {/* Selector Tamaño */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">Tamaño</label>
          <select 
            className="w-full p-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-gray-600"
            value={formData.id_tamano}
            onChange={(e) => setFormData({...formData, id_tamano: e.target.value})}
            required
          >
            <option value="">Selecciona el tamaño</option>
            {tamanos.map(t => (
              <option key={t.id_tamano} value={t.id_tamano}>
                {t.nombre_tamano}
              </option>
            ))}
          </select>
        </div>

        {/* Botón Guardar */}
        <button 
          disabled={loading}
          className="w-full bg-orange-500 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 mt-4"
        >
          <Save className="h-5 w-5" />
          {loading ? 'Guardando...' : 'Registrar Mascota'}
        </button>
      </form>
    </div>
  );
}