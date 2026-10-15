// GET /api/listas (RF-22, RNF-08). Arma el JSON de docs/api.md §3.3 a partir de la tabla "listas".
// Cambiar una lista en D1 cambia la respuesta sin tocar este código (ver docs/listas.md).

import type { Env } from "../index";
import { responderError, responderJson } from "../http";
import { verificarSesion } from "../auth";

interface FilaLista {
  tipo: string;
  valor: string;
  padre: string | null;
}

// Nombres de D1 -> nombres que usa el formulario (index.html).
const CONEXIONES: Record<string, string> = {
  "estrella-estrella": "Estrella-estrella",
  "estrella-delta": "Estrella-delta",
  monofasico: "Monofásico",
};
const TIPOS_ORDEN: Record<string, string> = {
  cambio: "Cambio",
  retiro: "Retiro",
  instalacion: "Instalación nueva",
  reinstalacion: "Reinstalación",
};

// El TP de media tensión es fijo (RN-03); no está en D1.
const TP_MT = "120:1";

// "120" -> 120 ; "-" -> null
function numeroONulo(texto: string): number | null {
  return texto === "-" ? null : Number(texto);
}

// D1 guarda la tolerancia como fracción (0.005); la API la entrega en porcentaje (0.5).
function aPorcentaje(fraccion: string): number {
  return Math.round(Number(fraccion) * 100 * 1e6) / 1e6;
}

// Voltajes esperados: padre "estrella-delta 120/240", valor "F1N|F2N|F3N|entre fases".
function armarVoltajes(filas: FilaLista[]) {
  return filas.map((f) => {
    const [conexionD1, voltaje] = (f.padre ?? "").split(" ");
    const [f1, f2, f3, ff] = f.valor.split("|").map(numeroONulo);
    const monofasico = conexionD1 === "monofasico";
    return {
      medicion: "Baja tensión",
      sistema: monofasico ? "Monofásico" : "Trifásico",
      conexion: CONEXIONES[conexionD1] ?? conexionD1,
      voltaje,
      fn: [f1, f2, f3],
      // Trifásico: F1-F2, F2-F3 y F3-F1 valen lo mismo. Monofásico: solo hay una medida entre fases.
      entre_fases: monofasico ? [ff, null, null] : [ff, ff, ff],
    };
  });
}

// "padre" de un tipo de foto: 'siempre' o tipos de orden separados por coma.
function armarFotos(filas: FilaLista[]) {
  const fotos: Record<string, string[]> = {};
  for (const [clave, nombre] of Object.entries(TIPOS_ORDEN)) {
    fotos[nombre] = filas
      .filter((f) => f.padre === "siempre" || (f.padre ?? "").split(",").includes(clave))
      .map((f) => f.valor);
  }
  return fotos;
}

export async function manejarListas(request: Request, env: Env): Promise<Response> {
  const sesion = await verificarSesion(request, env);
  if (!sesion) {
    return responderError(request, 401, "no_autenticado", "Debe iniciar sesión.");
  }

  // Solo valores activos, en el orden definido ("id" desempata).
  const { results } = await env.DB.prepare(
    "SELECT tipo, valor, padre FROM listas WHERE activo = 1 ORDER BY orden, id",
  ).all<FilaLista>();
  const de = (tipo: string) => results.filter((f) => f.tipo === tipo);

  const config = await env.DB.prepare(
    "SELECT clave, valor FROM configuracion WHERE clave IN ('listas_version','listas_actualizada','max_fotos')",
  ).all<{ clave: string; valor: string }>();
  const cfg = Object.fromEntries(config.results.map((c) => [c.clave, c.valor]));

  const tolerancia = (padre: string) => {
    const fila = de("tolerancia").find((f) => f.padre === padre);
    return fila ? aPorcentaje(fila.valor) : null;
  };

  const distritos = de("distrito");
  const zonas = de("zona").map((z) => ({
    zona: z.valor,
    distritos: distritos.filter((d) => d.padre === z.valor).map((d) => d.valor),
  }));

  const cuerpo = {
    version: Number(cfg.listas_version ?? 1),
    actualizada: cfg.listas_actualizada ?? null,
    bobinas: {
      bt: de("bobina").filter((f) => f.padre === "BT").map((f) => Number(f.valor)),
      mt: de("bobina").filter((f) => f.padre === "MT").map((f) => Number(f.valor)),
    },
    tp_mt: TP_MT,
    voltajes: armarVoltajes(de("voltaje_esperado")),
    tolerancias: { constante: tolerancia("constante"), voltajes: tolerancia("voltaje") },
    zonas,
    fotos: armarFotos(de("tipo_foto")),
    max_fotos: Number(cfg.max_fotos ?? 10),
  };

  const respuesta = responderJson(request, cuerpo);
  // La tableta guarda su propia copia; nadie más debe guardar otra.
  respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}
