import type { VercelRequest, VercelResponse } from "@vercel/node";

// Transbank hace un POST (form submit) a esta URL después de que el usuario paga.
// Como es un POST a una función serverless dedicada, no choca con el rewrite del SPA,
// y de aquí redirigimos (GET) al frontend con el token para que confirme el pago.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token_ws = (req.body && req.body.token_ws) || req.query?.token_ws;

  if (!token_ws) {
    return res.status(400).send("Token no recibido en la URL de retorno de Transbank");
  }

  console.log("🔁 Redirect desde Transbank con token_ws:", token_ws);
  return res.redirect(302, `/?view=confirmacion&token_ws=${encodeURIComponent(String(token_ws))}`);
}
