# Órdenes de Máxima Demanda — guía para Claude

## Contexto
- App Android (Capacitor, APK) que reemplaza la hoja física "Órdenes de Máxima Demanda" del Departamento de Medición de Coopeguanacaste R.L. (medición indirecta, BT y MT, Guanacaste). Abre sin señal.
- Usuarios: 2 líderes de cuadrilla (usuario y contraseña propios). Hazel (encargada) no usa la app: solo recibe correos con el PDF y las alertas de constante.
- Servidor: Cloudflare (plan gratuito): Worker en TypeScript, D1 (datos) y R2 (fotos y PDF). Correo por Gmail SMTP con worker-mailer desde `ordenmaximademanda@gmail.com`. Ya no se usa Supabase.
- **Fuente de verdad: `README.md` v1.1** (RF-01..RF-26, RN-01..RN-07, RNF-01..RNF-09, CA-01..CA-14). Contrato de la API: `docs/api.md`. Reglas compartidas cliente/servidor: `shared/reglas.js`.
- `index.html` es el formulario actual (simulacro validado); `roles-y-permisos.sql` es de la etapa Supabase y queda obsoleto.
- Repo: `origin` = github.com/hgarcia170697/Ordenes-de-maxima-demanda. `upstream` = yangnayi/Formularios-Demanda (no hacer push ahí).

## Colaboradores y flujo
- `fabicastroguti-max` (Fabián, practicante): servidor, app y preparación; trabaja con Claude. `Barrett0999`: formulario.
- Trabajo por sprints. El issue índice es el #36. Regla: dentro de un sprint nadie depende del trabajo del otro.
- Una rama por issue: `sprintN/<num>-<tema>` (ej. `sprint1/7-contrato-api`). El PR cierra el issue (`Closes #N`).
- Secretos nunca en el repo ni en commits: `SMTP_USER`, `SMTP_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `RELEASES_TOKEN` (van como secretos de Cloudflare o de GitHub).

## Cómo trabajar
- Responder en español, claro; Fabián es practicante, explicar decisiones técnicas sin jerga.
- **No escribir código hasta que los requerimientos estén aprobados** (v1.1 es borrador). Primero entender, luego proponer, luego construir.
- Cada cambio debe rastrearse a un RF/RN/CA. Si código y README se contradicen, señalarlo y preguntar; no elegir en silencio. Ver pendientes en README 9.3.
- Toda regla de validación va en la tableta **y** en el servidor (Worker), usando `shared/reglas.js`.
- No cambiar configuración real de Cloudflare ni de Gmail sin confirmación explícita.
- No meter datos reales de clientes en el repo (Ley 8968); usar ejemplos ficticios (orden 58213).
- Commits pequeños en español, en imperativo ("Agregar…", "Corregir…").

## Entorno (Windows)
- Git: si `git` no está en el PATH, usar `"C:\Program Files\Git\cmd\git.exe"`.
- El login a GitHub no es interactivo en Claude Code; si `git push` pide credenciales, hacerlo desde una terminal normal.
- Python 3.12 en `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`.
- Comandos para pegar en la terminal del usuario: cortos (las rutas largas se parten al copiar).
