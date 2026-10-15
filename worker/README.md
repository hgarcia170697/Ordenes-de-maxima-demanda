# Worker (API, D1 y R2)

Programa de Cloudflare que atiende la API del sistema de mediciones indirectas. Guarda los datos en D1 y los archivos en R2. El esquema sigue el README principal, sección 7.1.

Estado actual: solo funciona `GET /api/salud`; los demás endpoints responden 501 (`NO_IMPLEMENTADO`).

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

## Despliegue automático

Al hacer push a `main` con cambios en `worker/`, GitHub Actions (`.github/workflows/worker.yml`) aplica las migraciones y despliega. Requiere los secretos del repositorio `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## Migraciones

- `0001_esquema_inicial.sql`: tablas, índices y triggers de inalterabilidad.
- `0002_listas_iniciales.sql`: bobinas, voltajes, tolerancias y tipos de foto. Las zonas y distritos se cargan después (issue #2).
