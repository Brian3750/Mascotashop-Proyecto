export interface Product {
  stock: number;
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
}

export const CATEGORIES = [
  { id: "perros", name: "PERROS", icon: "Dog" },
  { id: "gatos", name: "GATOS", icon: "Cat" },
  { id: "hamster", name: "HAMSTER", icon: "Rat" },
  { id: "conejos", name: "CONEJOS", icon: "Rabbit" },
  { id: "peces", name: "PECES", icon: "Fish" },
  { id: "aves", name: "AVES", icon: "Bird" },
];

export const PRODUCTS: Product[] = [
  // PERROS
  {
    id: "p1",
    name: "Alimento Premium Perro Adulto 18kg",
    category: "perros",
    price: 30000,
    image: "/images/Master-Dog-Adulto-Carne.png",
    description: "Nutrición balanceada para perros adultos de todas las razas.",
  },
  {
    id: "p2",
    name: "Snack de pollo para Perros",
    category: "perros",
    price: 6900,
    image: "/images/Snack-de-Pollo-Deshidratado.webp",
    description: "Ayuda a mantener contento a tu perro.",
  },
    {
    id: "p3",
    name: "Cama tipo sofa para Perros",
    category: "perros",
    price: 15000,
      image: "/images/Cama-tipo-sofa.webp",
    description: "Tu perro podra dormir cómodo.",
  },
  // GATOS
  {
    id: "g1",
    name: "Petclean Arena para Gatos 10L",
    category: "gatos",
    price: 9890,
    image: "/images/arena.webp",
    description: "Con esta arena no tendra ni una preocupacion.",
  },
  {
    id: "g2",
    name: "Master cat adulto carne",
    category: "gatos",
    price: 5690,
    image: "/images/master-cat.png",
    description: "La mejor comida para tu gato.",
  },
  {
    id: "g3",
    name: "Churu Variedades Pollo (20 unidades)",
    category: "gatos",
    price: 9990,
    image: "/images/churu-variedades.jpg",
    description: "Pack ahorro con 20 tubos de Churu.",
  },
  // HAMSTER
  {
    id: "h1",
    name: "TROPIFIT ALIMENTO PARA HAMSTERS 500 GR",
    category: "hamster",
    price: 4500,
    image: "/images/comida-hamster.jpg",
    description: "Variedad de granos y semillas para una dieta completa.",
  },
   {
    id: "h2",
    name: "Bola Esfera Para Rodar Hámster,15 Cm",
    category: "hamster",
    price: 5000,
    image: "/images/Bola-ejercicio.webp",
    description: "Distracción para tu hamster.",
  },
   {
    id: "h3",
    name: "Tobogán con guarida para hamster pequeño",
    category: "hamster",
    price: 3500,
    image: "/images/Tobogan-hamster.webp",
    description: "Mucha diversión para tu hamster.",
  },
  // CONEJOS
  {
    id: "c1",
    name: "HENO PELUDOS DE ALFALFA 100% NATURAL 700 GR",
    category: "conejos",
    price: 3000,
    image: "/images/heno-peludos.jpg",
    description: "Heno fresco y crujiente para conejos.",
  },
   {
    id: "c2",
    name: "Jaula Para Conejos Con Rampa-comedero-bebedero",
    category: "conejos",
    price: 60000,
    image: "/images/Jaula-para-conejos.webp",
    description: "La mejor comodidad para tu conejo.",
  },
   {
    id: "c3",
    name: "Jaula Para Conejos Con Rampa-comedero-bebedero",
    category: "conejos",
    price: 15000,
    image: "/images/Tunel-para-conejos.jpeg",
    description: "Mucha divercion para tu conejo.",
  },
  // PECES
  {
    id: "p1",
    name: "Kit Pecera para Principiantes 1.5 Galones (22x15x25 cm) | Plástico PET Duradero, Bomba Ultra Silenciosa y LED USB",
    category: "peces",
    price: 60000,
    image: "/images/Kit-pecera.webp",
    description: "La mejor opcion si quieres empezar con una pecera.",
  },
   {
    id: "p2",
    name: "Alimento para Peces",
    category: "peces",
    price: 3250,
    image: "/images/alimento-peces.webp",
    description: "Alimento flotante que no enturbia el agua.",
  },
     {
    id: "p3",
    name: "Red Hagen para peces 20 x 15 cm",
    category: "peces",
    price: 5990,
    image: "/images/Red-peces-acuario.jpeg",
    description: "Red para peces tu mejor opcion.",
  },
  // AVES
  {
    id: "a1",
    name: "ALIMENTO PARA AVES CHAMPION MINI PETS CATITAS 500 G",
    category: "aves",
    price: 2800,
    image: "/images/comida-aves.png",
    description: "El mejor alimento para tu catita.",
  },
    {
    id: "a2",
    name: "Jaula para Aves Pinzón Periquito (47x36x35 cm) Celeste",
    category: "aves",
    price: 25000,
    image: "/images/jaula-aves.webp",
    description: "El mejor alimento para tu catita.",
  },
      {
    id: "a3",
    name: "Recipiente Para Agua o Alimento De Pájaros",
    category: "aves",
    price: 2500,
    image: "/images/bebedor-agua-aves.webp",
    description: "El mejor alimento para tu catita.",
  },
];
