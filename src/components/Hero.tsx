import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dog, Cat, Rat, Rabbit, Fish, Bird, ChevronDown, ShoppingCart, LucideIcon } from "lucide-react";
import { CATEGORIES, PRODUCTS, Product } from "../data/products";
import { cn, formatCLP } from "../lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Dog,
  Cat,
  Rat,
  Rabbit,
  Fish,
  Bird,
};

interface HeroProps {
  onViewCatalog: (category: string) => void;
  onAddToCart: (product: Product) => void;
}

export default function Hero({ onViewCatalog, onAddToCart }: HeroProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = selectedCategory
    ? PRODUCTS.filter((p) => p.category === selectedCategory)
    : [];

  return (
    <div className="relative bg-orange-50 pt-12 pb-20 overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-orange-200 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-orange-300 rounded-full blur-3xl opacity-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4"
          >
            Todo para tu <span className="text-orange-500">Mejor Amigo</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Encuentra la mejor alimentación y accesorios para tus mascotas con despacho a todo Chile.
          </motion.p>
        </div>

        {/* Categories Carousel/Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {CATEGORIES.map((cat, index) => {
            const Icon = ICON_MAP[cat.icon];
            const isActive = selectedCategory === cat.id;

            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                className={cn(
                  "flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 group",
                  isActive
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105"
                    : "bg-white text-gray-600 hover:bg-orange-100 hover:text-orange-600"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                  isActive ? "bg-white/20" : "bg-orange-50 group-hover:bg-white"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="font-bold text-sm tracking-wider">{cat.name}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 mt-2 transition-transform duration-300",
                  isActive ? "rotate-180" : "rotate-0"
                )} />
              </motion.button>
            );
          })}
        </div>

        {/* Unfolding Section */}
        <AnimatePresence mode="wait">
          {selectedCategory && (
            <motion.div
              key={selectedCategory}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-orange-100">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Productos para <span className="capitalize">{selectedCategory}</span>
                  </h2>
                  <button
                    onClick={() => onViewCatalog(selectedCategory)}
                    className="text-orange-500 font-medium hover:underline"
                  >
                    Ver todo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-gray-50 rounded-2xl p-4 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-orange-100"
                    >
                      <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-white">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-extrabold text-orange-600">
                          {formatCLP(product.price)}
                        </span>
                        <button 
                          onClick={() => onAddToCart(product)}
                          className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
