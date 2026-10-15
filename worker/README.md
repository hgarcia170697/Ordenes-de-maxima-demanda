# Worker (API, D1 y R2)

Programa de Cloudflare que atiende la API del sistema de mediciones indirectas. Guarda los datos en D1 y los archivos en R2. El esquema sigue el README principal, sección 7.1.

Estado actual: funcionan `GET /api/salud` y `POST /api/login`; los demás endpoints responden 501 (`NO_IMPLEMENTADO`).

## Comandos (desde la carpeta `worker/`)

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala las dependencias |
| `npm run dev` | Corre el Worker en local |
| `npm run migrar:local` | Aplica las migraciones a la base local |
| `npm run migrar:remoto` | Aplica las migraciones a la base real |
| `npm run tipos` | Revisa los tipos de TypeScript |
| `npm run deploy` | Despliega a Cloudflare |

## Crear la base D1 (una sola vez)

1. `npx wrangler d1 create ordenes-db`
2. Copie el `database_id` que aparece y péguelo en `wrangler.toml`, en lugar de `REEMPLAZAR_CON_ID`.
3. Cree el bucket: `npx wrangler r2 bucket create ordenes-archivos`

## Secretos

Se cargan uno por uno (pide el valor por pantalla; nunca van en el código):

```
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASSWORD
npx wrangler secret put TOKEN_SECRET
```

`TOKEN_SECRET` firma las sesiones (JWT). Genere un valor aleatorio largo y péguelo cuando `wrangler` se lo pida:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Si no está cargado, el login responde 500 con un mensaje claro. Si lo cambia, todas las sesiones abiertas dejan de valer.

## Crear los usuarios (los 2 líderes)

No hay pantalla de registro: cada usuario se crea una vez, a mano. Desde `worker/`:

1. `node scripts/crear-usuario.mjs` (pide usuario, nombre y contraseña; la contraseña no se ve al escribirla).
2. El script **imprime** un comando `npx wrangler d1 execute ordenes-db --remote --command "INSERT ..."`. Cópielo y ejecútelo.
3. Repita para el segundo líder.

El script no guarda nada en archivos. No pegue el comando impreso en el repositorio, en correos ni en chats: contiene el hash de la contraseña. Para desactivar a alguien: `UPDATE usuarios SET activo = 0 WHERE usuario = '...'`.

Parámetros: PBKDF2-SHA256, sal de 16 bytes y 50 000 iteraciones (guardadas por usuario). El plan gratis de Workers da unos 10 ms de CPU por petición: mida el login real y, si se excede, baje las iteraciones en `src/auth.ts` y en el script, y vuelva a crear los usuarios.

Login: 5 intentos fallidos en 15 minutos por usuario bloquean con 429 (`Retry-After`). Todo intento queda en la bitácora (`login_ok`, `login_fallido`, `login_bloqueado`).

## Despliegue automático

Al hacer push a `main` con cambios en `worker/`, GitHub Actions (`.github/workflows/worker.yml`) aplica las migraciones y despliega. Requiere los secretos del repositorio `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## Migraciones

- `0001_esquema_inicial.sql`: tablas, índices y triggers de inalterabilidad.
- `0002_listas_iniciales.sql`: bobinas, voltajes, tolerancias y tipos de foto. Las zonas y distritos se cargan después (issue #2).
