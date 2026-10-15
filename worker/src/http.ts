// Utilidades de respuesta compartidas por todas las rutas: JSON, errores y CORS.

// Origen de la app Android (Capacitor).
const ORIGENES_PERMITIDOS = ["https://localhost"];

export function cabecerasCors(request: Request): Record<string, string> {
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

export function responderJson(
  request: Request,
  cuerpo: unknown,
  estado = 200,
  extras: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cabecerasCors(request), ...extras },
  });
}

// Formato de error común de la API (docs/api.md §1.1).
export function responderError(
  request: Request,
  estado: number,
  codigo: string,
  mensaje: string,
  extras: Record<string, string> = {},
): Response {
  return responderJson(request, { error: { codigo, mensaje } }, estado, extras);
}
