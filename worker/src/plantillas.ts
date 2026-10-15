// Plantillas de correo (texto y HTML simple, sin fotos). RF-15, RF-25.

export interface PlantillaCorreo {
  asunto: string;
  texto: string;
  html: string;
}

// Escapa los datos antes de ponerlos en HTML.
function esc(valor: string | number): string {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Fecha y hora en hora de Costa Rica (UTC-6, sin horario de verano).
export function fechaHoraCostaRica(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    dateStyle: "short",
    timeStyle: "short",
  }).format(fecha);
}

function envolverHtml(titulo: string, filas: [string, string][], pie: string): string {
  const tabla = filas
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`)
    .join("");
  return (
    `<div style="font-family:Arial,sans-serif;font-size:14px">` +
    `<h2>${esc(titulo)}</h2><table>${tabla}</table><p>${esc(pie)}</p></div>`
  );
}

// (a) Reporte enviado, con el PDF adjunto.
export function plantillaReporte(d: {
  orden: string;
  folio: string;
  cliente: string;
  lider: string;
}): PlantillaCorreo {
  const asunto = `Orden ${d.orden} · ${d.folio} · ${d.cliente}`;
  const pie = "Se adjunta el reporte en PDF.";
  const texto =
    `Reporte de Orden de Máxima Demanda\n\nOrden: ${d.orden}\nFolio: ${d.folio}\n` +
    `Cliente: ${d.cliente}\nLíder de cuadrilla: ${d.lider}\n\n${pie}\n`;
  const html = envolverHtml(
    "Reporte de Orden de Máxima Demanda",
    [
      ["Orden", d.orden],
      ["Folio", d.folio],
      ["Cliente", d.cliente],
      ["Líder de cuadrilla", d.lider],
    ],
    pie,
  );
  return { asunto, texto, html };
}

// (b) Alerta de constante distinta de la esperada.
export function plantillaAlertaConstante(d: {
  orden: string;
  lider: string;
  constanteIngresada: number | string;
  constanteEsperada: number | string;
  fecha?: Date;
}): PlantillaCorreo {
  const cuando = fechaHoraCostaRica(d.fecha);
  const asunto = `ALERTA constante · Orden ${d.orden}`;
  const texto =
    `ALERTA: la constante ingresada no coincide con la esperada.\n\nOrden: ${d.orden}\n` +
    `Líder de cuadrilla: ${d.lider}\nConstante ingresada: ${d.constanteIngresada}\n` +
    `Constante esperada: ${d.constanteEsperada}\nFecha y hora (Costa Rica): ${cuando}\n`;
  const html = envolverHtml(
    "ALERTA: constante distinta de la esperada",
    [
      ["Orden", d.orden],
      ["Líder de cuadrilla", d.lider],
      ["Constante ingresada", String(d.constanteIngresada)],
      ["Constante esperada", String(d.constanteEsperada)],
      ["Fecha y hora (Costa Rica)", cuando],
    ],
    "Revise la orden con la cuadrilla.",
  );
  return { asunto, texto, html };
}
