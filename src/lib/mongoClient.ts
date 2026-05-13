import { MongoClient, ServerApiVersion } from 'mongodb';

// Credenciales provistas por tu compañero
const uri = "mongodb+srv://admin_loyaldata:UINrVDBJFVG8hheJ@clusterloyaldataanalyti.hwpmyyl.mongodb.net/?appName=ClusterLoyalDataAnalytics";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

export async function conectarMongoDB() {
  try {
    await client.connect();
    // Apuntamos a la base de datos del proyecto
    const db = client.db("LoyalDataAnalytics");
    console.log("🚀 Conexión exitosa a MongoDB: LoyalDataAnalytics (Trazabilidad lista)");
    return db;
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB:", error);
    throw error;
  }
}

export { client };