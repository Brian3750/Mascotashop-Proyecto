import { MongoClient, Db } from "mongodb";

const DB_NAME = "LoyalDataAnalytics";

// En serverless, el contenedor puede reutilizarse entre invocaciones.
// Guardamos la conexión en variables globales para no reconectar en cada request.
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no está configurada en las variables de entorno.");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(DB_NAME);
  return cachedDb;
}
