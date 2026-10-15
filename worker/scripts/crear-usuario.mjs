// Crea el comando SQL para dar de alta un usuario (líder) en D1.
// Uso, desde la carpeta worker/:  node scripts/crear-usuario.mjs
//
// Pide usuario, nombre y contraseña, genera sal e hash (PBKDF2-SHA256, los mismos
// parámetros que src/auth.ts) e IMPRIME el comando de wrangler para que usted lo
// copie y lo ejecute. No guarda nada en archivos: ni la contraseña ni el hash.

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

// Debe coincidir con ITERACIONES_POR_DEFECTO de src/auth.ts.
const ITERACIONES = 50000;

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

// Pregunta mostrando lo que se escribe, o sin eco cuando es una contraseña.
function preguntar(texto, oculto = false) {
  return new Promise((resolver) => {
    const escribirOriginal = rl._writeToOutput;
    if (oculto) {
      rl._writeToOutput = (cadena) => {
        // Deja pasar solo el texto de la pregunta y el salto de línea final.
        if (cadena.includes(texto) || cadena.includes("\n") || cadena.includes("\r")) {
          escribirOriginal.call(rl, cadena);
        }
      };
    }
    rl.question(texto, (respuesta) => {
      rl._writeToOutput = escribirOriginal;
      resolver(respuesta);
    });
  });
}

const usuario = (await preguntar("Usuario (ej. lider1): ")).trim().toLowerCase();
const nombre = (await preguntar("Nombre completo: ")).trim();
const contrasena = await preguntar("Contraseña: ", true);
const repetida = await preguntar("Repita la contraseña: ", true);
rl.close();

if (!usuario || !nombre || !contrasena) {
  console.error("Usuario, nombre y contraseña son obligatorios.");
  process.exit(1);
}
if (contrasena !== repetida) {
  console.error("Las contraseñas no coinciden.");
  process.exit(1);
}
if (contrasena.length < 10) {
  console.error("Use una contraseña de al menos 10 caracteres.");
  process.exit(1);
}
// Se evitan caracteres que romperían el comando de la consola.
if (/["'`$\\;]/.test(usuario) || /["'`$\\;]/.test(nombre)) {
  console.error("El usuario y el nombre no pueden llevar comillas, $, \\ ni ;.");
  process.exit(1);
}

const sal = randomBytes(16);
const hash = pbkdf2Sync(contrasena, sal, ITERACIONES, 32, "sha256");

const sql =
  "INSERT INTO usuarios (usuario, nombre, hash, sal, iteraciones) VALUES " +
  `('${usuario}', '${nombre}', '${hash.toString("base64")}', '${sal.toString("base64")}', ${ITERACIONES})`;

console.log("\nCopie y ejecute este comando (desde la carpeta worker/):\n");
console.log(`npx wrangler d1 execute ordenes-db --remote --command "${sql}"`);
console.log("\nNo guarde este comando en ningún archivo ni lo suba al repositorio.");
