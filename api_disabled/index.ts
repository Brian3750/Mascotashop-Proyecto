// API deshabilitada temporalmente para evitar errores en Vercel
// Este archivo es una copia del handler original y se movió aquí para
// que Vercel no intente ejecutar la función mientras se adapta a serverless.

import { createApp } from '../server';

export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}
