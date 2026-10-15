# Worker (API, D1 y R2)

Programa de Cloudflare que atiende la API del sistema de mediciones indirectas. Guarda los datos en D1 y los archivos en R2. El esquema sigue el README principal, sección 7.1.

Estado actual: funcionan `GET /api/salud` y el endpoint de prueba del correo (ver "Probar el correo"); los demás endpoints responden 501 (`NO_IMPLEMENTADO`).

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
npx wrangler secret put CLAVE_PRUEBA
```

## Probar el correo

Sirve para comprobar que Gmail envía un PDF de ~3 MB y que el CPU del Worker no pasa de 10 ms (límite del plan gratis; CA-07). Se usa la orden ficticia 58213.

1. Cargue los secretos: `npx wrangler secret put SMTP_USER` (`ordenmaximademanda@gmail.com`), `SMTP_PASSWORD` (contraseña de aplicación de Gmail) y `CLAVE_PRUEBA` (un texto largo inventado).
2. En `wrangler.toml` ponga `MODO_PRUEBA = "1"` (temporal) y despliegue con `npm run deploy`.
3. Llame al endpoint (cambie la URL, la clave y el destino):
   ```
   curl -X POST https://URL-DEL-WORKER/api/pruebas/correo -H "X-Clave-Prueba: LA_CLAVE" -H "Content-Type: application/json" -d '{"para":"destino@ejemplo.com"}'
   ```
   Responde `{"ok":true,"bytes_pdf":...,"tiempo_pared_ms":...}`. Ese tiempo es de pared (incluye la espera de red con Gmail); **no** es el CPU.
4. Lea el CPU real: Cloudflare, Workers, el Worker, Métricas, "CPU time"; o ejecute `npx wrangler tail` y mire el CPU de cada solicitud. Repita 3 o 4 veces.
5. Vuelva a poner `MODO_PRUEBA = "0"` y despliegue otra vez. Sin eso (o con una clave incorrecta) el endpoint responde 404.

**Plan B si pasa de 10 ms:** bajar la calidad de las fotos dentro del PDF (menos bytes que convertir a base64 y enviar), por ejemplo reduciendo el JPEG o la resolución antes de armar el PDF.

## Despliegue automático

Al hacer push a `main` con cambios en `worker/`, GitHub Actions (`.github/workflows/worker.yml`) aplica las migraciones y despliega. Requiere los secretos del repositorio `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## Migraciones

- `0001_esquema_inicial.sql`: tablas, índices y triggers de inalterabilidad.
- `0002_listas_iniciales.sql`: bobinas, voltajes, tolerancias y tipos de foto. Las zonas y distritos se cargan después (issue #2).
