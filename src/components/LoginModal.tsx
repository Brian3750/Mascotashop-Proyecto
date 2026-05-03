import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, CreditCard, Phone, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<"login" | "register">("register"); // Por defecto en Registro para capturar datos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetFields = () => {
    setEmail(""); setPassword(""); setNombres(""); 
    setApellidos(""); setRut(""); setTelefono(""); setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onSuccess?.();
      onClose();
      resetFields();
    } catch (err: any) {
      setError(err.message || "Credenciales incorrectas");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombres, apellidos, rut, telefono },
        },
      });
      if (authError) throw authError;
      if (data.user && data.session === null) {
        alert("¡Registro exitoso! Revisa tu email para confirmar.");
      } else {
        alert("¡Cuenta creada con éxito!");
      }
      setMode("login");
    } catch (err: any) {
      setError(err.message.includes("Database error") ? "Error en DB: El perfil no pudo crearse." : err.message);
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
      >
        {/* Botón Cerrar */}
        <button onClick={onClose} className="absolute top-5 right-5 z-10 p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="h-5 w-5 text-gray-400" />
        </button>

        {/* Pestañas Estilo SuperZoo */}
        <div className="flex border-b">
          <button 
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-5 text-sm font-black uppercase tracking-wider transition-all ${mode === "register" ? "text-orange-600 border-b-4 border-orange-600 bg-white" : "text-gray-400 bg-gray-50 border-b-4 border-transparent"}`}
          >
            Regístrate
          </button>
          <button 
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-5 text-sm font-black uppercase tracking-wider transition-all ${mode === "login" ? "text-orange-600 border-b-4 border-orange-600 bg-white" : "text-gray-400 bg-gray-50 border-b-4 border-transparent"}`}
          >
            Inicia Sesión
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          <form className="space-y-4" onSubmit={mode === "login" ? handleLogin : handleRegister}>
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* Nombres</label>
                    <input type="text" placeholder="Juan" value={nombres} onChange={(e) => setNombres(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* Apellidos</label>
                    <input type="text" placeholder="Pérez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* Teléfono</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-100 bg-gray-100 text-gray-500 text-xs">+56</span>
                      <input type="text" placeholder="912345678" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-r-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* RUT</label>
                    <input type="text" placeholder="12345678-9" value={rut} onChange={(e) => setRut(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* Email</label>
              <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 italic">* Contraseña</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 outline-none text-sm" required />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="w-full py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest mt-4">
              {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (mode === "login" ? "Ingresa" : "Crear cuenta")}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}