import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import LoginModal from "./components/LoginModal";
import CartDrawer, { CartItem } from "./components/CartDrawer";

const API = import.meta.env.VITE_API_URL || window.location.origin;
import RegistroMascota from './components/RegistroMascota'; 
import UserProfile from './components/PerfilUsuario';
import TicketPago from "./components/TicketPago"; 
import AdminPanel from './components/AdminPanel'; 
import { PRODUCTS as LOCAL_PRODUCTS, Product } from "./data/products"; 
import { formatCLP } from "./lib/utils";
import { 
  ShoppingCart, 
  ArrowLeft, 
  ArrowRight, 
  MapPin, 
  Phone, 
  Mail, 
  Facebook, 
  Instagram, 
  Twitter,
  LogOut
} from "lucide-react";

import { supabase } from "./lib/supabaseClient";
// --- IMPORTACIÓN DE TRAZABILIDAD NO SQL ---
import { registrarInteraccionMongo } from "./lib/analytics";

const ADMIN_EMAIL = "brian.contreras@inacapmail.cl";

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [activeSearch, setActiveSearch] = useState(""); 
  const [currentView, setCurrentView] = useState<"home" | "catalog" | "confirmacion" | "profile" | "admin">("home");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [pathTick, setPathTick] = useState(0);
  const [loginIntent, setLoginIntent] = useState<"customer" | "admin">("customer");

  // 📄 ESTADO DEL TICKET CON TU TIPADO ESTRICTO DE TYPESCRIPT
  const datosTicketInicialState = null;
  const [datosTicket, setDatosTicket] = useState<{
    buyOrder: string;
    fechaHora: string;
    cliente: string;
    monto: number;
  } | null>(datosTicketInicialState);

  const [pagoValidadoExitoso, setPagoValidadoExitoso] = useState(false);

  const paymentProcessed = useRef(false);

  // =========================================================================
  // 🔄 1. EFECTO DE AUTENTICACIÓN E INICIALIZACIÓN DE PRODUCTOS
  // =========================================================================
  useEffect(() => {
    fetchProducts();

    // 🚀 BYPASS AUTOMÁTICO EN MODO DESARROLLO ADMINISTRADOR
    if (import.meta.env.VITE_DEV_AUTO_ADMIN === "true") {
      console.log("🛡️ Bypass de administrador activado localmente mediante variables de entorno.");
      setIsAdmin(true);
      setCurrentView('admin');
      window.history.pushState({}, '', '/admin');
      setAuthReady(true);
      return; // Interrumpe la ejecución para que Supabase no pise el estado local
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && session.user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        setCurrentView('admin');
        window.history.pushState({}, '', '/admin');
      }
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && session.user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        setCurrentView('admin');
        window.history.pushState({}, '', '/admin');
        setIsLoginOpen(false);
      } else {
        setIsAdmin(false);
        // CORRECCIÓN: Si venimos con parámetros de Transbank, evitamos que pise el renderizado a 'home'
        const params = new URLSearchParams(window.location.search);
        if (!params.get('token_ws') && params.get('view') !== 'confirmacion' && window.location.pathname !== '/admin') {
          setCurrentView('home');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // =========================================================================
  // 🛡️ 2. INTERCEPTOR INTEGRADO PARA DETECTAR RETORNO DE TRANSBANK
  // =========================================================================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenWs = params.get('token_ws');
    const viewParam = params.get('view');

    if (tokenWs || viewParam === "confirmacion") {
      // Congelamos la vista inmediatamente para evitar parpadeos antes de resolver la promesa
      setCurrentView("confirmacion");
      
      const tokenEfectivo = tokenWs || "";
      if (!paymentProcessed.current && tokenEfectivo) {
        paymentProcessed.current = true; 
        confirmarPago(tokenEfectivo);
      }
    }
  }, []);

  useEffect(() => {
    // Si el bypass está activo, no sincronizar ni resetear la ruta con los estados de sesión vacíos
    if (import.meta.env.VITE_DEV_AUTO_ADMIN === "true") return;
    // Esperamos a que se resuelva la sesión inicial antes de decidir nada,
    // para no sacar al usuario de /admin por un falso negativo mientras carga.
    if (!authReady) return;

    if (window.location.pathname === '/admin') {
      // AdminPanel tiene su propia clave de acceso interna (pantalla de "Consola
      // Administrativa"), así que no exigimos sesión de Supabase para llegar a /admin.
      setIsAdmin(true);
      setCurrentView('admin');
      setIsLoginOpen(false);
    } else {
      setIsAdmin(false);
    }
  }, [authReady, session, pathTick]);

  useEffect(() => {
    const handlePopState = () => setPathTick((t) => t + 1);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    setActiveSearch(searchQuery);
    if (searchQuery.trim() && currentView === "home") {
      setCurrentView("catalog");
    }
  }, [searchQuery, currentView]);

  // =========================================================================
  // 🧾 3. FUNCIÓN DE VALIDACIÓN CON ASEGURAMIENTO DE LIMPIEZA POST-PAGO
  // =========================================================================
  const confirmarPago = async (token: string) => {
    let pagoAprobado = false;
    try {
      const pendingCart = JSON.parse(localStorage.getItem('pending_cart') || '[]');
      const savedUserId = localStorage.getItem('id_usuario_checkout');
      const savedCuponId = localStorage.getItem('id_cupon_aplicado');

      console.log("🔍 Validando token con Transbank...", token);
      
      const response = await fetch(`${API}/api/confirmar-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token,
          cartItems: pendingCart,
          id_usuario: savedUserId,
          id_cupon_aplicado: savedCuponId || undefined
        })
      });
      
      const result = await response.json();

      if (result.success && result.data) {
        pagoAprobado = true;

        // Estructura limpia leyendo lo devuelto por tu servidor Express
        setDatosTicket({
          buyOrder: result.data.buyOrder || result.data.buy_order || 'N/A',
          fechaHora: result.data.fechaHora || new Date().toLocaleString(),
          cliente: result.data.cliente || 'Cliente MascotaShop',
          monto: Number(result.data.monto || result.data.amount || 0)
        });

        // Limpieza de estados y storage de venta procesada con éxito
        setCartItems([]);
        localStorage.removeItem('pending_cart');
        localStorage.removeItem('id_usuario_checkout');
        localStorage.removeItem('id_cupon_aplicado');
        
        setPagoValidadoExitoso(true);
        fetchProducts();
      } else {
        alert("El pago fue rechazado o cancelado.");
      }
    } catch (error) {
      console.error("❌ Error en confirmación:", error);
      alert("Error de conexión con el servidor.");
    } finally {
      // Si la transacción falló o no se pudo validar, te devuelve al home limpiando la URL
      if (!pagoAprobado) {
        window.history.replaceState({}, document.title, "/");
        paymentProcessed.current = false;
        setCurrentView("home");
      }
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('inventario').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const dbProducts = data.map((item: any) => ({
          id: String(item.id_alimento), 
          name: item.nombre_producto,
          price: Number(item.precio_venta),
          image: item.imagen_url || '/images/Master-Dog-Adulto-Carne.png', 
          category: (item.categoria || 'perros').toLowerCase(),
          description: item.marca || 'Nutrición Premium',
          stock: item.stock || 0 
        }));
        setProducts(dbProducts);
      } else {
        setProducts(LOCAL_PRODUCTS);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setProducts(LOCAL_PRODUCTS);
    }
  };

  const handleAdminAccess = () => {
    setIsAdmin(true);
    setCurrentView('admin');
    window.history.pushState({}, '', '/admin');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false); 
  };

  const handleCheckout = async (userId?: string, codigoCupon?: string) => {
    if (cartItems.length === 0) return;
    if (!session) {
      setIsCartOpen(false); 
      setLoginIntent("customer");
      setIsLoginOpen(true); 
      return; 
    }

    setIsProcessing(true);
    try {
      const buyOrder = `ORD-${Date.now()}`;
      const finalUserId = userId || session.user.id;

      const response = await fetch(`${API}/api/crear-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyOrder: buyOrder,
          sessionId: finalUserId,
          cartItems: cartItems.map(item => ({ id: item.id, name: item.name, quantity: item.quantity })),
          codigoCupon: codigoCupon || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Error en el servidor al contactar con Transbank");

      if (data.url && data.token) {
        localStorage.setItem('pending_cart', JSON.stringify(cartItems));
        localStorage.setItem('id_usuario_checkout', finalUserId);
        if (data.id_cupon_aplicado) {
          localStorage.setItem('id_cupon_aplicado', String(data.id_cupon_aplicado));
        } else {
          localStorage.removeItem('id_cupon_aplicado');
        }
        console.log("🛡️ Contexto de venta respaldado de forma segura localmente.");
        
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
    } catch (error: any) {
      alert(`Error al iniciar el pago: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const availableProducts = useMemo(() => {
    return products.filter((p) => p.stock > 0);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(activeSearch.toLowerCase());
      const matchesFilter = selectedFilter === "all" || p.category === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeSearch, selectedFilter, availableProducts]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Producto sin stock disponible.");
      return;
    }
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const renderHome = () => (
    <>
      <Hero 
        onViewCatalog={(cat) => { setSelectedFilter(cat); setCurrentView("catalog"); window.scrollTo(0, 0); }} 
        onAddToCart={addToCart} 
      />
      {session && session.user?.email !== ADMIN_EMAIL && (
        <section className="py-12 bg-white">
          <RegistroMascota />
        </section>
      )}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10 border-b pb-4">
            <h2 className="text-3xl font-bold italic text-gray-900">Nuestros Alimentos</h2>
            <button 
              onClick={() => { setSelectedFilter("all"); setActiveSearch(""); setCurrentView("catalog"); window.scrollTo(0, 0); }} 
              className="text-orange-500 font-bold flex items-center gap-2 hover:gap-3 transition-all group"
            >
              Ir al Catálogo <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {availableProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />
            ))}
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {isAdmin ? (
        <>
          <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <button onClick={() => {}} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">M</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900 hidden sm:block">
                    Mascota<span className="text-orange-500">Shop</span>
                  </span>
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-orange-500">Panel Administrativo</span>
                  <button
                    onClick={() => { handleLogout(); setIsAdmin(false); setCurrentView('home'); window.history.pushState({}, '', '/'); }}
                    className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-6 w-6" />
                    <span className="hidden sm:block font-medium">Salir</span>
                  </button>
                </div>
              </div>
            </div>
          </nav>
          <main className="flex-grow">
            <AdminPanel />
          </main>
        </>
      ) : (
        <>
          <Navbar 
            userSession={session}
            isAdmin={session && session.user?.email === ADMIN_EMAIL}
            onLoginClick={() => { setLoginIntent("customer"); setIsLoginOpen(true); }} 
            onLogoutClick={handleLogout}
            onProfileClick={() => {setCurrentView("profile"); window.scrollTo(0, 0);}}
            onHomeClick={() => {setCurrentView("home"); setIsAdmin(false); window.history.pushState({}, '', '/'); window.location.search = "";}}
            onCartClick={() => setIsCartOpen(true)}
            onAdminClick={handleAdminAccess}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
          />
          
          <main className="flex-grow">
            {currentView === "home" ? renderHome() : 
             currentView === "confirmacion" ? (
               <div className="py-20 max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center">
                 {!pagoValidadoExitoso ? (
                   <>
                     <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                     <h2 className="text-2xl font-bold mb-4">Procesando tu pago...</h2>
                     <p className="text-gray-500">Estamos validando la transacción y actualizando el stock.</p>
                   </>
                 ) : (
                   /* 🧾 Pasamos los datos del ticket validados y limpios */
                   datosTicket && (
                     <TicketPago 
                       datos={datosTicket} 
                       onVolver={() => {
                         setPagoValidadoExitoso(false);
                         setDatosTicket(null);
                         paymentProcessed.current = false;
                         window.history.replaceState({}, document.title, "/");
                         setCurrentView("home");
                       }} 
                     />
                   )
                 )}
               </div>
             ) : currentView === "profile" ? (
               <div className="bg-gray-50 min-h-screen pt-8">
                 <button onClick={() => {setCurrentView("home"); setActiveSearch("");}} className="ml-8 flex items-center gap-2 mb-8 text-gray-500 font-bold hover:text-orange-500 transition-colors">
                   <ArrowLeft /> Volver al inicio
                 </button>
                 <UserProfile />
               </div>
             ) : (
              <section className="py-12 bg-gray-50 px-4 min-h-screen text-left">
                <div className="max-w-7xl mx-auto">
                  <button onClick={() => {setCurrentView("home"); setActiveSearch("");}} className="flex items-center gap-2 mb-8 text-gray-500 font-bold hover:text-orange-500 transition-colors">
                    <ArrowLeft /> Volver al inicio
                  </button>
                  <h2 className="text-2xl font-bold mb-6">{activeSearch ? `Resultados para: "${activeSearch}"` : "Nuestro Catálogo"}</h2>
                  {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                      {filteredProducts.map((p) => <ProductCard key={p.id} product={p} onAdd={() => addToCart(p)} />)}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-3xl">
                      <p className="text-gray-400">No encontramos productos en esta categoría.</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </main>

          <footer className="bg-gray-900 text-white pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 mb-12 text-left">
              <div>
                <h3 className="text-xl font-black italic mb-6">MascotaShop<span className="text-orange-500">.</span></h3>
                <p className="text-gray-400 text-sm leading-relaxed">Tu tienda amiga en Maipú. Todo lo que necesitas para tus mascotas.</p>
              </div>
              <div>
                <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-orange-500">Contacto</h4>
                <div className="space-y-4 text-sm text-gray-400">
                  <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-orange-500" /> Av. Pajaritos, Maipú, Chile</div>
                  <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-orange-500" /> +56 9 4568 5662</div>
                  <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-orange-500" /> contacto@mascotashop.cl</div>
                </div>
              </div>
              <div>
                <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-orange-500">Síguenos</h4>
                <div className="flex gap-4">
                  <a href="#" className="bg-gray-800 p-3 rounded-xl hover:bg-orange-500 transition-all"><Facebook className="h-5 w-5" /></a>
                  <a href="#" className="bg-gray-800 p-3 rounded-xl hover:bg-orange-500 transition-all"><Instagram className="h-5 w-5" /></a>
                  <a href="#" className="bg-gray-800 p-3 rounded-xl hover:bg-orange-500 transition-all"><Twitter className="h-5 w-5" /></a>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 text-center text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase">
              PROYECTO BRIAN CONTRERAS — INACAP 2026
            </div>
          </footer>
        </>
      )}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        defaultMode={loginIntent === "admin" ? "login" : "register"}
      />
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        items={cartItems} 
        onUpdateQuantity={(id, d) => setCartItems(prev => prev.map(i => i.id === id ? {...i, quantity: Math.max(1, i.quantity + d)} : i))} 
        onRemove={(id) => setCartItems(prev => prev.filter(i => i.id !== id))} 
        onCheckout={handleCheckout} 
        isProcessing={isProcessing}
      />
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: any; onAdd: () => void }) {
  const isOutOfStock = product.stock <= 0;

  const handleCardClick = () => {
    if (!isOutOfStock) {
      console.log(`🎯 Trazando vista del producto: ${product.name}`);
      registrarInteraccionMongo("visualizacion_producto", {
        id: product.id,
        nombre: product.name,
        categoria: product.category,
        stock: product.stock,
        precio: product.price
      });
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col h-full transition-all text-left ${isOutOfStock ? 'opacity-60' : 'hover:shadow-xl hover:-translate-y-1 cursor-pointer'}`}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-gray-50 flex items-center justify-center p-2">
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">Agotado</span>
          </div>
        )}
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
          <p className="text-sm text-gray-500 mb-4">{product.category}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-4">
          <span className="text-lg font-bold text-gray-900">${product.price}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            disabled={isOutOfStock}
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${isOutOfStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
          >
            Añadir
          </button>
        </div>
      </div>
    </div>
  );
}