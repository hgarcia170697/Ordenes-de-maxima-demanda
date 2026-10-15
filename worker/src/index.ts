// Worker del sistema de mediciones indirectas.
// Router mínimo, sin frameworks. Por ahora solo /api/salud funciona;
// el resto de endpoints del contrato responde 501 hasta implementarse.

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

import { pruebaCorreo } from "./rutas/pruebas";

// Origen de la app Android (Capacitor).
const ORIGENES_PERMITIDOS = ["https://localhost"];

function cabecerasCors(request: Request): Record<string, string> {
  const origen = request.headers.get("Origin") ?? "";
  const cabeceras: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (ORIGENES_PERMITIDOS.includes(origen)) {
    cabeceras["Access-Control-Allow-Origin"] = origen;
  }
  return cabeceras;
}

function responderJson(request: Request, cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cabecerasCors(request) },
  });
}

// Formato de error común de la API.
function responderError(request: Request, estado: number, codigo: string, mensaje: string): Response {
  return responderJson(request, { error: { codigo, mensaje } }, estado);
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

    if (request.method === "POST" && pathname === "/api/pruebas/correo") {
      return pruebaCorreo(request, env);
    }

    if (RUTAS_CONTRATO.some((r) => r.metodo === request.method && r.patron.test(pathname))) {
      return responderError(request, 501, "NO_IMPLEMENTADO", "Este endpoint todavía no está implementado.");
    }

    return responderError(request, 404, "NO_ENCONTRADO", "La ruta solicitada no existe.");
  },
} satisfies ExportedHandler<Env>;
