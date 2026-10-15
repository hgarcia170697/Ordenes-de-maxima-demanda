// POST /api/login (docs/api.md §3.2)

import { ErrorConfiguracion, firmarToken, ITERACIONES_POR_DEFECTO, verificarContrasena } from "../auth";
import { registrarBitacora } from "../bitacora";
import { responderError, responderJson } from "../http";
import type { Env } from "../index";

const MAX_FALLOS = 5;
const VENTANA_MINUTOS = 15;

interface FilaUsuario {
  id: number;
  nombre: string;
  hash: string;
  sal: string;
  iteraciones: number;
  activo: number;
}

// Hash (32 bytes) y sal (16 bytes) falsos para gastar el mismo tiempo cuando el usuario no existe.
const HASH_FALSO = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const SAL_FALSA = "AAAAAAAAAAAAAAAAAAAAAA==";

export async function login(request: Request, env: Env): Promise<Response> {
  let cuerpo: { usuario?: unknown; contrasena?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return responderError(request, 400, "peticion_invalida", "El cuerpo debe ser JSON válido.");
  }
  if (
    typeof cuerpo?.usuario !== "string" ||
    typeof cuerpo?.contrasena !== "string" ||
    cuerpo.usuario.trim() === "" ||
    cuerpo.contrasena === ""
  ) {
    return responderError(request, 400, "peticion_invalida", "Faltan el usuario o la contraseña.");
  }

  // Se limita el largo para que nadie llene la tabla de intentos con textos enormes.
  const nombreUsuario = cuerpo.usuario.trim().toLowerCase().slice(0, 100);
  const contrasena = cuerpo.contrasena.slice(0, 200);

  try {
    // 1. ¿Demasiados fallos recientes? (los aciertos no borran filas; solo cuentan los de la ventana)
    const recientes = await env.DB.prepare(
      `SELECT COUNT(*) AS n,
              CAST(strftime('%s', MIN(fecha)) AS INTEGER) + ? - CAST(strftime('%s', 'now') AS INTEGER) AS espera
         FROM intentos_login
        WHERE usuario = ? AND fecha > datetime('now', ?)`,
    )
      .bind(VENTANA_MINUTOS * 60, nombreUsuario, `-${VENTANA_MINUTOS} minutes`)
      .first<{ n: number; espera: number | null }>();

    const usuario = await env.DB.prepare(
      "SELECT id, nombre, hash, sal, iteraciones, activo FROM usuarios WHERE usuario = ?",
    )
      .bind(nombreUsuario)
      .first<FilaUsuario>();

    if ((recientes?.n ?? 0) >= MAX_FALLOS) {
      await registrarBitacora(env, {
        usuarioId: usuario?.id ?? null,
        accion: "login_bloqueado",
        detalle: `usuario: ${nombreUsuario}`,
      });
      const espera = Math.max(1, recientes?.espera ?? VENTANA_MINUTOS * 60);
      return responderError(
        request,
        429,
        "demasiados_intentos",
        "Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.",
        { "Retry-After": String(espera) },
      );
    }

    // 2. Verificar la contraseña (siempre se calcula un hash, exista o no el usuario).
    const existe = usuario !== null && usuario.activo === 1;
    const correcta = await verificarContrasena(
      contrasena,
      existe ? usuario.hash : HASH_FALSO,
      existe ? usuario.sal : SAL_FALSA,
      existe ? usuario.iteraciones : ITERACIONES_POR_DEFECTO,
    );

    if (!usuario || !existe || !correcta) {
      await env.DB.prepare("INSERT INTO intentos_login (usuario) VALUES (?)").bind(nombreUsuario).run();
      await registrarBitacora(env, {
        usuarioId: usuario?.id ?? null,
        accion: "login_fallido",
        detalle: `usuario: ${nombreUsuario}`,
      });
      // Mismo mensaje para "no existe" y "contraseña incorrecta".
      return responderError(request, 401, "no_autenticado", "Usuario o contraseña incorrectos.");
    }

    // 3. Acierto.
    const { token, expira } = await firmarToken(env, { id: usuario.id, nombre: usuario.nombre });
    await registrarBitacora(env, { usuarioId: usuario.id, accion: "login_ok" });
    return responderJson(request, { token, nombre: usuario.nombre, expira });
  } catch (error) {
    if (error instanceof ErrorConfiguracion) {
      return responderError(
        request,
        500,
        "error_interno",
        "El servidor no está configurado: falta TOKEN_SECRET. Avise a quien administra el sistema.",
      );
    }
    console.error("Error en login:", error);
    return responderError(request, 500, "error_interno", "Falla del servidor. Intente de nuevo.");
  }
}
