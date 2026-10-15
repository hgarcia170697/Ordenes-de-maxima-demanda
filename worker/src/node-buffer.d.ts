// Tipos mínimos de node:buffer (disponible en el Worker gracias a nodejs_compat).
// Se declaran aquí para no mezclar todos los tipos de Node con los de Workers.
declare module "node:buffer" {
  export const Buffer: {
    from(datos: Uint8Array | ArrayBuffer | string, codificacion?: string): { toString(codificacion: "base64"): string };
  };
}
