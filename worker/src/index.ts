// Worker del sistema de mediciones indirectas.
// Router mínimo, sin frameworks. Por ahora solo /api/salud funciona;
// el resto de endpoints del contrato responde 501 hasta implementarse.

import { cabecerasCors, responderError, responderJson } from "./http";
import { login } from "./rutas/login";

export interface Env {
  DB: D1Database;
  ARCHIVOS: R2Bucket;
  VERSION: string;
  // Secretos (se cargan con "wrangler secret put")
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  TOKEN_SECRET: string;
}

// Endpoints del contrato: método + patrón de ruta.
const RUTAS_CONTRATO: { metodo: string; patron: RegExp }[] = [
  { metodo: "POST", patron: /^\/api\/login$/ },
  { metodo: "GET", patron: /^\/api\/listas$/ },
  { metodo: "POST", patron: /^\/api\/reportes$/ },
  { metodo: "PUT", patron: /^\/api\/reportes\/[^/]+\/pdf$/ },
  { metodo: "GET", patron: /^\/api\/reportes$/ },
  { metodo: "GET", patron: /^\/api\/reportes\/[^/]+$/ },
  { metodo: "POST", patron: /^\/api\/alertas\/constante$/ },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Respuesta a la verificación previa de CORS.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cabecerasCors(request) });
    }

    if (request.method === "GET" && pathname === "/api/salud") {
      return responderJson(request, { ok: true, version: env.VERSION });
    }

    if (request.method === "POST" && pathname === "/api/login") {
      return login(request, env);
    }

    if (RUTAS_CONTRATO.some((r) => r.metodo === request.method && r.patron.test(pathname))) {
      return responderError(request, 501, "NO_IMPLEMENTADO", "Este endpoint todavía no está implementado.");
    }

    return responderError(request, 404, "NO_ENCONTRADO", "La ruta solicitada no existe.");
  },
} satisfies ExportedHandler<Env>;
