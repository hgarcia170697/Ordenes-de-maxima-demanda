// Worker del sistema de mediciones indirectas.
// Router mínimo, sin frameworks. Los endpoints que faltan
// responden 501 hasta implementarse (ver docs/api.md).

import { cabecerasCors, responderError, responderJson } from "./http";
import { manejarListas } from "./rutas/listas";
import { login } from "./rutas/login";
import { pruebaCorreo } from "./rutas/pruebas";

export interface Env {
  DB: D1Database;
  ARCHIVOS: R2Bucket;
  VERSION: string;
  // Secretos (se cargan con "wrangler secret put")
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  TOKEN_SECRET: string;
  CLAVE_PRUEBA?: string; // secreto, solo para probar el correo (issue #12)
  MODO_PRUEBA?: string; // variable: "1" activa temporalmente el endpoint de prueba
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

    if (request.method === "POST" && pathname === "/api/login") return login(request, env);
    if (request.method === "GET" && pathname === "/api/listas") return manejarListas(request, env);
    if (request.method === "POST" && pathname === "/api/pruebas/correo") return pruebaCorreo(request, env);

    if (RUTAS_CONTRATO.some((r) => r.metodo === request.method && r.patron.test(pathname))) {
      return responderError(request, 501, "no_implementado", "Este endpoint todavía no está implementado.");
    }

    return responderError(request, 404, "no_encontrado", "La ruta solicitada no existe.");
  },
} satisfies ExportedHandler<Env>;
