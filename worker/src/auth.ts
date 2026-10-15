// Contraseñas (PBKDF2-SHA256) y tokens de sesión (JWT HS256) con Web Crypto.
// Sin dependencias externas.

import type { Env } from "./index";

// Iteraciones de PBKDF2 para usuarios nuevos. Se guardan por usuario, así que
// se pueden cambiar sin invalidar contraseñas existentes.
// OJO: el plan gratis de Workers da ~10 ms de CPU por petición. Hay que MEDIR
// el login real (wrangler tail / panel de Cloudflare) y bajar este valor, y el
// del script crear-usuario.mjs, si se excede. (Workers admite máximo 100 000.)
export const ITERACIONES_POR_DEFECTO = 50_000;

const DURACION_TOKEN_SEGUNDOS = 8 * 60 * 60; // 8 horas

const codificador = new TextEncoder();

// Se lanza cuando falta TOKEN_SECRET; la ruta que lo captura responde 500.
export class ErrorConfiguracion extends Error {}

// ---------- Base64 ----------

function bytesABase64(bytes: Uint8Array): string {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto);
}

function base64ABytes(base64: string): Uint8Array {
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

function bytesABase64Url(bytes: Uint8Array): string {
  return bytesABase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlABytes(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  return base64ABytes(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}

function textoABase64Url(texto: string): string {
  return bytesABase64Url(codificador.encode(texto));
}

// ---------- Contraseñas ----------

async function derivarHash(contrasena: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", codificador.encode(contrasena), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
    material,
    256,
  );
  return new Uint8Array(bits);
}

// Comparación en tiempo constante (no se corta al primer byte distinto).
function igualesTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
  return diferencia === 0;
}

// Genera sal e hash para guardar en la tabla usuarios (ambos en base64).
export async function hashearContrasena(
  contrasena: string,
  iteraciones = ITERACIONES_POR_DEFECTO,
): Promise<{ hash: string; sal: string; iteraciones: number }> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivarHash(contrasena, sal, iteraciones);
  return { hash: bytesABase64(hash), sal: bytesABase64(sal), iteraciones };
}

export async function verificarContrasena(
  contrasena: string,
  hashGuardado: string,
  salGuardada: string,
  iteraciones: number,
): Promise<boolean> {
  const esperado = base64ABytes(hashGuardado);
  const calculado = await derivarHash(contrasena, base64ABytes(salGuardada), iteraciones);
  return igualesTiempoConstante(esperado, calculado);
}

// ---------- Token JWT HS256 ----------

async function claveHmac(env: Env, usos: ("sign" | "verify")[]): Promise<CryptoKey> {
  if (!env.TOKEN_SECRET) {
    throw new ErrorConfiguracion("TOKEN_SECRET no está configurado en el Worker.");
  }
  return crypto.subtle.importKey(
    "raw",
    codificador.encode(env.TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usos,
  );
}

export async function firmarToken(
  env: Env,
  usuario: { id: number; nombre: string },
): Promise<{ token: string; expira: string }> {
  const clave = await claveHmac(env, ["sign"]);
  const exp = Math.floor(Date.now() / 1000) + DURACION_TOKEN_SEGUNDOS;
  const cabecera = textoABase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const carga = textoABase64Url(JSON.stringify({ sub: String(usuario.id), nombre: usuario.nombre, exp }));
  const firma = await crypto.subtle.sign("HMAC", clave, codificador.encode(`${cabecera}.${carga}`));
  return {
    token: `${cabecera}.${carga}.${bytesABase64Url(new Uint8Array(firma))}`,
    expira: new Date(exp * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

// Devuelve los datos del token si la firma y la expiración son válidas; si no, null.
export async function verificarToken(
  env: Env,
  token: string,
): Promise<{ usuarioId: number; nombre: string } | null> {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const clave = await claveHmac(env, ["verify"]);
    const valida = await crypto.subtle.verify(
      "HMAC",
      clave,
      base64UrlABytes(partes[2]),
      codificador.encode(`${partes[0]}.${partes[1]}`),
    );
    if (!valida) return null;
    const cabecera = JSON.parse(new TextDecoder().decode(base64UrlABytes(partes[0])));
    if (cabecera.alg !== "HS256") return null;
    const carga = JSON.parse(new TextDecoder().decode(base64UrlABytes(partes[1])));
    const usuarioId = Number(carga.sub);
    if (!Number.isInteger(usuarioId) || typeof carga.exp !== "number" || typeof carga.nombre !== "string") {
      return null;
    }
    if (carga.exp <= Math.floor(Date.now() / 1000)) return null;
    return { usuarioId, nombre: carga.nombre };
  } catch {
    // Token mal formado o TOKEN_SECRET ausente: no hay sesión.
    return null;
  }
}

// Lee "Authorization: Bearer", valida el token y que el usuario siga activo.
// Las rutas protegidas responden 401 cuando devuelve null.
export async function verificarSesion(
  request: Request,
  env: Env,
): Promise<{ usuarioId: number; nombre: string } | null> {
  const cabecera = request.headers.get("Authorization") ?? "";
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(cabecera);
  if (!coincidencia) return null;

  const datos = await verificarToken(env, coincidencia[1]);
  if (!datos) return null;

  const fila = await env.DB.prepare("SELECT nombre FROM usuarios WHERE id = ? AND activo = 1")
    .bind(datos.usuarioId)
    .first<{ nombre: string }>();
  if (!fila) return null;
  return { usuarioId: datos.usuarioId, nombre: fila.nombre };
}
