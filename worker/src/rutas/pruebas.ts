// Endpoint de prueba del correo y del consumo de CPU (issue #12, CA-07).
// POST /api/pruebas/correo  { "para": "alguien@ejemplo.com" }
// Solo existe si MODO_PRUEBA = "1" y la cabecera X-Clave-Prueba coincide con el
// secreto CLAVE_PRUEBA; en cualquier otro caso responde 404 como si no existiera.

import type { Env } from "../index";
import { enviarCorreo } from "../correo";
import { plantillaReporte } from "../plantillas";

// Compara sin cortar en la primera diferencia (evita adivinar la clave por tiempos).
function clavesIguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    dif |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return dif === 0;
}

// PDF mínimo válido (una página con texto) más un objeto de relleno hasta ~3 MB.
function generarPdfDePrueba(bytesRelleno = 3 * 1024 * 1024): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let largo = 0;
  const poner = (b: Uint8Array) => {
    partes.push(b);
    largo += b.length;
  };
  const texto = (s: string) => poner(enc.encode(s));
  const objeto = (n: number, cuerpo: string) => {
    offsets[n] = largo;
    texto(`${n} 0 obj\n${cuerpo}\nendobj\n`);
  };

  texto("%PDF-1.4\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  const contenido = "BT /F1 18 Tf 72 700 Td (PDF de prueba - orden ficticia 58213) Tj ET";
  objeto(4, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
  objeto(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  // Objeto de relleno (no lo usa ninguna página) para llegar al tamaño pedido.
  offsets[6] = largo;
  texto(`6 0 obj\n<< /Length ${bytesRelleno} >>\nstream\n`);
  const relleno = new Uint8Array(bytesRelleno);
  for (let i = 0; i < relleno.length; i++) relleno[i] = 65 + (i % 26);
  poner(relleno);
  texto("\nendstream\nendobj\n");

  const inicioXref = largo;
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  texto(xref + `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

  const pdf = new Uint8Array(largo);
  let pos = 0;
  for (const p of partes) {
    pdf.set(p, pos);
    pos += p.length;
  }
  return pdf;
}

function json(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function pruebaCorreo(request: Request, env: Env): Promise<Response> {
  const clave = request.headers.get("X-Clave-Prueba") ?? "";
  if (env.MODO_PRUEBA !== "1" || !env.CLAVE_PRUEBA || !clavesIguales(clave, env.CLAVE_PRUEBA)) {
    return json({ error: { codigo: "NO_ENCONTRADO", mensaje: "La ruta solicitada no existe." } }, 404);
  }

  let para = "";
  try {
    const cuerpo = (await request.json()) as { para?: unknown };
    if (typeof cuerpo.para === "string") para = cuerpo.para.trim();
  } catch {
    // cuerpo inválido: se responde abajo
  }
  if (!para.includes("@")) {
    return json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "Envíe un JSON con el campo 'para' (correo destino)." } }, 400);
  }

  const inicio = Date.now();
  const pdf = generarPdfDePrueba();
  const plantilla = plantillaReporte({ orden: "58213", folio: "PRUEBA-0001", cliente: "Cliente de prueba", lider: "Líder de prueba" });
  try {
    await enviarCorreo(env, {
      para,
      asunto: plantilla.asunto,
      texto: plantilla.texto,
      html: plantilla.html,
      adjuntos: [{ nombre: "prueba-58213.pdf", contenido: pdf, tipo: "application/pdf" }],
    });
  } catch (e) {
    return json({ error: { codigo: "CORREO_FALLIDO", mensaje: e instanceof Error ? e.message : "Error desconocido." } }, 502);
  }

  // Tiempo de pared (incluye la espera de red con Gmail). NO es el tiempo de CPU:
  // el CPU real se ve en Cloudflare > Workers > el Worker > Métricas (CPU time)
  // o con "npx wrangler tail". El límite del plan gratis es 10 ms de CPU.
  return json({ ok: true, bytes_pdf: pdf.length, tiempo_pared_ms: Date.now() - inicio }, 200);
}
