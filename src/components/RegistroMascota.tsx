import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; 
import { Dog, Save } from 'lucide-react';

export default function RegistroMascota() {
  const [especies, setEspecies] = useState<any[]>([]);
  const [tamanos, setTamanos] = useState<any[]>([]);
  const [razasGlobales, setRazasGlobales] = useState<any[]>([]);
  const [razasFiltradas, setRazasFiltradas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    edad: '',
    id_especie: '',
    id_tamano: '',
    id_raza: ''
  });

  // 1. Carga inicial de datos desde Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: esp, error: errEsp } = await supabase.from('especie').select('*');
        const { data: tam, error: errTam } = await supabase.from('tamano').select('*');
        const { data: raz, error: errRaz } = await supabase.from('razas').select('*');
        
        if (errEsp) console.error("Error en especie:", errEsp.message);
        if (errTam) console.error("Error en tamano:", errTam.message);
        if (errRaz) console.error("Error en razas:", errRaz.message);

        console.log('✅ Especies cargadas:', esp);
        console.log('✅ Tamaños cargados:', tam);
        console.log('✅ Razas cargadas:', raz);
        
        // Log detallado de estructura
        if (raz && raz.length > 0) {
          console.log('🔍 Primera raza:', raz[0]);
          console.log('🔍 Campos de la primera raza:', Object.keys(raz[0]));
          
          // Log en formato tabla para fácil lectura
          console.table(raz.map(r => ({ 
            id_raza: r.id_raza, 
            nombre_raza: r.nombre_raza, 
            id_especie: r.id_especie,
            tipo_id_especie: typeof r.id_especie
          })));
        }

        if (esp) setEspecies(esp);
        if (tam) setTamanos(tam);
        if (raz) setRazasGlobales(raz);
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
      }
    }
    loadData();
  }, []);

  // Consulta de razas por especie en Supabase
  const fetchRazasByEspecie = async (idEspecieNum: number) => {
    try {
      const { data, error } = await supabase.from('razas').select('*').eq('id_especie', idEspecieNum);
      if (error) {
        console.error('Error cargando razas filtradas:', error.message);
        setRazasFiltradas([]);
        return;
      }
      setRazasFiltradas(data || []);
    } catch (err) {
      console.error('Error fetchRazasByEspecie:', err);
      setRazasFiltradas([]);
    }
  };

  // Filtrar razas automáticamente cuando se actualice la especie seleccionada
  useEffect(() => {
    if (!formData.id_especie) {
      setRazasFiltradas([]);
      return;
    }

    const idEspecieNum = Number(formData.id_especie);
    const filtradas = razasGlobales.filter(r => Number(r.id_especie) === idEspecieNum);
    setRazasFiltradas(filtradas);

    // Si solo hay una raza, preseleccionarla para mejorar UX
    if (filtradas.length === 1) {
      setFormData(prev => ({ ...prev, id_raza: String(filtradas[0].id_raza) }));
    }
  }, [formData.id_especie, razasGlobales]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Debes estar logueado para registrar una mascota.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('mascotas').insert([
        { 
          nombre: formData.nombre,
          edad: parseInt(formData.edad, 10),
          id_especie: parseInt(formData.id_especie, 10),
          id_tamano: parseInt(formData.id_tamano, 10),
          id_raza: formData.id_raza ? parseInt(formData.id_raza, 10) : null,
          id_usuario: user.id 
        }
      ]);

      if (error) throw error;

      alert("¡Mascota registrada exitosamente!");
      
      setFormData({ 
        nombre: '', 
        edad: '', 
        id_especie: '', 
        id_tamano: '',
        id_raza: ''
      });
      setRazasFiltradas([]);

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
            onChange={(e) => {
              const val = e.target.value;
              setFormData(prev => ({ ...prev, id_especie: val, id_raza: '' }));
              if (val) {
                const idNum = Number(val);
                fetchRazasByEspecie(idNum);
              } else {
                setRazasFiltradas([]);
              }
            }}
            required
          >
            <option value="">Selecciona una especie</option>
            {especies.map(e => (
              <option key={e.id_especie} value={String(e.id_especie)}>
                {e.nombre_especie}
              </option>
            ))}
          </select>
        </div>

        {/* Selector Dinámico de Raza */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 ml-1">Raza (Opcional)</label>
          <select 
            className="w-full p-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            value={formData.id_raza}
            onChange={(e) => setFormData({...formData, id_raza: e.target.value})}
            disabled={!formData.id_especie}
          >
            <option value="">
              {!formData.id_especie ? "Primero selecciona una especie" : (razasFiltradas.length === 0 ? "No hay razas registradas para esta especie" : "Selecciona una raza (opcional)")}
            </option>
            {razasFiltradas.map(r => (
              <option key={r.id_raza} value={String(r.id_raza)}>
                {r.nombre_raza}
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
              <option key={t.id_tamano} value={String(t.id_tamano)}>
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