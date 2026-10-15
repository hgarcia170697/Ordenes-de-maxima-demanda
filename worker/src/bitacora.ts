// Bitácora solo-insertar con cadena de hashes (RF-23).
// hash = SHA-256(hash_anterior + fecha + usuario_id + accion + folio + detalle)
// La primera fila usa 'inicio' como hash anterior.

import type { Env } from "./index";

export interface EntradaBitacora {
  usuarioId: number | null;
  accion: string;
  folio?: string | null;
  detalle?: string | null;
}

async function sha256Hex(texto: string): Promise<string> {
  const resumen = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MAX_REINTENTOS = 5;

// Concurrencia: D1 no permite calcular SHA-256 dentro de SQL, así que el hash se
// calcula aquí. Para que dos peticiones simultáneas no bifurquen la cadena, el
// INSERT solo se aplica si la última fila sigue siendo la que leímos (mismo id);
// si no, se relee y se reintenta. Riesgo residual: si se agotan los reintentos
// (muy improbable con 2 usuarios) la entrada se pierde y se lanza un error.
export async function registrarBitacora(env: Env, entrada: EntradaBitacora): Promise<void> {
  const folio = entrada.folio ?? null;
  const detalle = entrada.detalle ?? null;

  for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
    const ultima = await env.DB.prepare("SELECT id, hash FROM bitacora ORDER BY id DESC LIMIT 1").first<{
      id: number;
      hash: string;
    }>();
    const idUltima = ultima?.id ?? 0;
    const hashAnterior = ultima?.hash ?? "inicio";

    const fecha = new Date().toISOString();
    const hash = await sha256Hex(
      `${hashAnterior}${fecha}${entrada.usuarioId ?? ""}${entrada.accion}${folio ?? ""}${detalle ?? ""}`,
    );

    const resultado = await env.DB.prepare(
      `INSERT INTO bitacora (fecha, usuario_id, accion, folio, detalle, hash_anterior, hash)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE COALESCE((SELECT MAX(id) FROM bitacora), 0) = ?`,
    )
      .bind(fecha, entrada.usuarioId, entrada.accion, folio, detalle, hashAnterior, hash, idUltima)
      .run();

    if (resultado.meta.changes > 0) return;
  }
  throw new Error("No se pudo escribir en la bitácora por concurrencia.");
}
