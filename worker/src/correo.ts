// Envío de correo por Gmail SMTP con la librería worker-mailer (RF-15, RF-25).
// Se abre una conexión por correo (smtp.gmail.com:465, TLS) y se cierra al terminar.
// Nunca se escribe la contraseña en los registros.

import { Buffer } from "node:buffer";
import { WorkerMailer } from "worker-mailer";
import type { Env } from "./index";

export interface Adjunto {
  nombre: string;
  contenido: Uint8Array;
  tipo: string; // tipo MIME, ej. "application/pdf"
}

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  adjuntos?: Adjunto[];
}

const NOMBRE_REMITENTE = "Órdenes de Máxima Demanda";

export async function enviarCorreo(env: Env, msg: MensajeCorreo): Promise<void> {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error("Faltan los secretos SMTP_USER y/o SMTP_PASSWORD (cárguelos con 'npx wrangler secret put').");
  }
  if (!msg.para) {
    throw new Error("El correo no tiene destinatario.");
  }

  // worker-mailer espera el contenido del adjunto ya en base64 (no lo codifica).
  // Buffer de node:buffer es nativo (rápido) y gasta poco CPU con PDFs grandes.
  const adjuntos = (msg.adjuntos ?? []).map((a) => ({
    filename: a.nombre,
    content: Buffer.from(a.contenido).toString("base64"),
    mimeType: a.tipo,
  }));

  let mailer: WorkerMailer | undefined;
  try {
    mailer = await WorkerMailer.connect({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      credentials: { username: env.SMTP_USER, password: env.SMTP_PASSWORD },
      authType: "plain",
    });
    await mailer.send({
      from: { name: NOMBRE_REMITENTE, email: env.SMTP_USER },
      to: msg.para,
      subject: msg.asunto,
      text: msg.texto,
      html: msg.html,
      attachments: adjuntos.length > 0 ? adjuntos : undefined,
    });
  } catch (e) {
    // Solo se informa el mensaje del error; nunca las credenciales.
    const detalle = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo enviar el correo por Gmail: ${detalle}`);
  } finally {
    if (mailer) {
      try {
        await mailer.close();
      } catch {
        // Si falla el cierre no importa: el correo ya se envió o ya falló.
      }
    }
  }
}

// Correo de la encargada, guardado en la tabla configuracion (no va en el código).
export async function correoEncargada(env: Env): Promise<string> {
  const fila = await env.DB.prepare("SELECT valor FROM configuracion WHERE clave = 'correo_encargada'").first<{
    valor: string;
  }>();
  const correo = (fila?.valor ?? "").trim();
  if (!correo) {
    throw new Error(
      "El correo de la encargada no está configurado. Complete configuracion.correo_encargada en la base D1.",
    );
  }
  return correo;
}
