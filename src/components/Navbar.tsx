import React, { useState } from "react";
import { ShoppingCart, User, Search, Menu, X, Settings, LogOut } from "lucide-react"; 
import { cn } from "../lib/utils";

interface NavbarProps {
  userSession: any; // Prop para recibir la sesión de Supabase
  onLoginClick: () => void;
  onLogoutClick: () => void; // Prop para cerrar sesión
  onHomeClick: () => void;
  onCartClick: () => void;
  onAdminClick: () => void; 
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cartCount: number;
}

export default function Navbar({ 
  userSession,
  onLoginClick, 
  onLogoutClick,
  onHomeClick, 
  onCartClick, 
  onAdminClick, 
  searchQuery, 
  setSearchQuery, 
  cartCount 
}: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button
            onClick={onHomeClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:block">
              Mascota<span className="text-orange-500">Shop</span>
            </span>
          </button>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos para tu mascota..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onAdminClick}
              className="p-2 text-gray-300 hover:text-orange-500 transition-colors"
              title="Administración"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* LÓGICA DINÁMICA DE USUARIO */}
            {userSession ? (
              <button
                onClick={onLogoutClick}
                className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-6 w-6" />
                <span className="hidden sm:block font-medium">Salir</span>
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
              >
                <User className="h-6 w-6" />
                <span className="hidden sm:block font-medium">Ingresar</span>
              </button>
            )}

            <button 
              onClick={onCartClick}
              className="relative p-2 text-gray-600 hover:text-orange-500 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-4">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <div className="flex flex-col gap-2">
            {userSession && (
              <button 
                onClick={() => { onLogoutClick(); setIsMenuOpen(false); }}
                className="flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl font-medium"
              >
                <LogOut className="h-5 w-5" /> Cerrar Sesión
              </button>
            )}
            <button 
              onClick={() => { onAdminClick(); setIsMenuOpen(false); }}
              className="p-4 bg-orange-50 text-orange-600 rounded-xl text-center font-medium"
            >
              Panel de Gestión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}