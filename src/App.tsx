import React, { useState, useMemo, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import LoginModal from "./components/LoginModal";
import CartDrawer, { CartItem } from "./components/CartDrawer";
import RegistroMascota from './components/RegistroMascota'; 
import WhatsAppButton from './components/WhatsAppButton'; 
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
  Twitter 
} from "lucide-react";

import { supabase } from "./lib/supabaseClient";

const ADMIN_EMAIL = "brian.contreras@inacapmail.cl";

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); 
  const [activeSearch, setActiveSearch] = useState(""); 
  const [currentView, setCurrentView] = useState<"home" | "catalog" | "confirmacion">("home");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [products, setProducts] = useState<Product[]>([]);
  const [session, setSession] = useState<any>(null);

  const paymentProcessed = useRef(false);

  useEffect(() => {
    fetchProducts();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session || session.user.email !== ADMIN_EMAIL) {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenWs = params.get('token_ws');

    if (tokenWs && !paymentProcessed.current) {
      paymentProcessed.current = true; 
      setCurrentView("confirmacion");
      confirmarPago(tokenWs);
    }
  }, []);

  // --- FUNCIÓN PARA CONFIRMAR PAGO Y REGISTRAR VENTA/STOCK ---
  const confirmarPago = async (token: string) => {
    try {
      // Recuperamos el carrito guardado en localStorage antes de ir a Transbank
      const pendingCart = JSON.parse(localStorage.getItem('pending_cart') || '[]');
      
      console.log("🔍 Validando pago y actualizando inventario...");
      
      const response = await fetch('http://localhost:3000/api/confirmar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token,
          cartItems: pendingCart 
        })
      });
      
      const result = await response.json();

      if (result.success) {
        alert("¡Compra realizada con éxito! El inventario ha sido actualizado.");
        setCartItems([]);
        localStorage.removeItem('pending_cart');
        // Refrescamos los productos para mostrar el nuevo stock
        fetchProducts();
      } else {
        alert("El pago fue rechazado o cancelado.");
      }
    } catch (error) {
      console.error("❌ Error en confirmación:", error);
      alert("Error de conexión con el servidor.");
    } finally {
      // Limpiamos la URL y volvemos al inicio
      window.history.replaceState({}, document.title, "/");
      setCurrentView("home");
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
          stock: item.stock || 0 // Muestra el stock real de la BD
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
    if (session && session.user.email === ADMIN_EMAIL) {
      setIsAdmin(true);
    } else if (!session) {
      alert("Debes iniciar sesión como administrador.");
      setIsLoginOpen(true);
    } else {
      alert("Acceso denegado.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false); 
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!session) {
      setIsCartOpen(false); 
      setIsLoginOpen(true); 
      return; 
    }

    setIsProcessing(true);
    try {
      const totalVenta = Math.round(cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0));
      const buyOrder = `ORD-${Date.now()}`;

      const response = await fetch('http://localhost:3000/api/crear-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyOrder: buyOrder,
          sessionId: session.user.id, // Enviamos el UUID del usuario
          total: totalVenta
        })
      });

      if (!response.ok) throw new Error("Error en el servidor al contactar con Transbank");

      const data = await response.json();

      if (data.url && data.token) {
        // MUY IMPORTANTE: Guardamos el carrito para recuperarlo al volver de Transbank
        localStorage.setItem('pending_cart', JSON.stringify(cartItems));
        
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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(activeSearch.toLowerCase());
      const matchesFilter = selectedFilter === "all" || p.category === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeSearch, selectedFilter, products]);

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
      <section className="py-12 bg-white">
        <RegistroMascota />
      </section>
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
            {products.slice(0, 4).map((p) => (
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
        <div className="relative">
          <AdminPanel />
          <button 
            onClick={() => setIsAdmin(false)}
            className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl hover:bg-orange-500 transition-all z-50"
          >
            Cerrar Panel Admin
          </button>
        </div>
      ) : (
        <>
          <Navbar 
            userSession={session}
            onLoginClick={() => setIsLoginOpen(true)} 
            onLogoutClick={handleLogout}
            onHomeClick={() => {setCurrentView("home"); setIsAdmin(false); window.location.search = "";}}
            onCartClick={() => setIsCartOpen(true)}
            onAdminClick={handleAdminAccess}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
          />
          
          <main className="flex-grow">
            {currentView === "home" ? renderHome() : 
             currentView === "confirmacion" ? (
               <div className="py-20 text-center">
                 <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                 <h2 className="text-2xl font-bold mb-4">Procesando tu pago...</h2>
                 <p className="text-gray-500">Estamos validando la transacción y actualizando el stock.</p>
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
                  <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-orange-500" /> +56 9 1234 5678</div>
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

          <WhatsAppButton /> 
        </>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
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

// Subcomponente ProductCard incluido dentro de App.tsx para facilitar el pegado
function ProductCard({ product, onAdd }: { product: any; onAdd: () => void }) {
  const isOutOfStock = product.stock <= 0;

  return (
    <div className={`bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col h-full transition-all text-left ${isOutOfStock ? 'opacity-60' : 'hover:shadow-xl hover:-translate-y-1'}`}>
      <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 bg-gray-50 flex items-center justify-center p-2">
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <span className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">Agotado</span>
          </div>
        )}
        <img 
          src={product.image} 
          alt={product.name} 
          className="max-w-full max-h-full object-contain" 
          onError={(e) => { (e.target as HTMLImageElement).src = '/images/Master-Dog-Adulto-Carne.png'; }} 
        />
      </div>
      <div className="flex-grow">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-50 px-2 py-1 rounded-md">{product.category}</span>
          <span className={`text-[10px] font-bold ${product.stock < 5 ? 'text-red-500' : 'text-gray-400'}`}>Stock: {product.stock}</span>
        </div>
        <h3 className="font-bold text-gray-900 mt-2 mb-1 line-clamp-2">{product.name}</h3>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        <span className="text-xl font-black text-gray-900">{formatCLP(product.price)}</span>
        <button 
          onClick={onAdd} 
          disabled={isOutOfStock}
          className={`${isOutOfStock ? 'bg-gray-300' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'} text-white p-3 rounded-xl transition-all active:scale-90`}
        >
          <ShoppingCart className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}