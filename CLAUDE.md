# Órdenes de Máxima Demanda — guía para Claude

## Contexto
- Formulario web que reemplaza la hoja física "Órdenes de Máxima Demanda" del Departamento de Medición de Coopeguanacaste R.L. (medición indirecta, BT y MT, Guanacaste).
- Usuarios: técnicos en tableta (llenan y envían), Hazel = encargada del proceso (revisa: Conforme / Observado), TI = administrador.
- **Fuente de verdad de los requerimientos: `README.md`** (v1.0 aprobada, 12-oct-2026): RF-01..RF-24, RN-01..RN-07, RNF-01..RNF-09, CA-01..CA-09.
- Código actual: `index.html` (todo el front en un archivo, supabase-js por CDN) + `roles-y-permisos.sql` (tabla `roles_usuarios` y políticas RLS). Backend: Supabase (proyecto `wujjamamzetenmhlacku`; la clave del HTML es la *publishable*, va en el cliente a propósito).
- Repos: `origin` = github.com/hgarcia170697/Ordenes-de-maxima-demanda (aquí se sube todo). `upstream` = github.com/yangnayi/Formularios-Demanda (de donde se copió; no hacer push ahí).

## Cómo trabajar
- Responder en español. El usuario (Fabián) es practicante; explicar decisiones técnicas en lenguaje claro.
- **No escribir código hasta que el análisis y los requerimientos estén cerrados y el usuario lo apruebe.** Primero entender, luego proponer, luego construir.
- Antes de cambiar algo, comparar contra el README: cada cambio debe poder rastrearse a un RF/RN/CA. Si el código y el README se contradicen, señalarlo y preguntar; no elegir en silencio.
- Toda regla de validación va en el cliente **y** en el servidor (RN: "se valida en la tableta y otra vez en el servidor").
- No ejecutar SQL ni cambiar configuración en el Supabase real sin confirmación explícita: es compartido con el equipo.
- No meter datos reales de clientes en el repo (Ley 8968).
- Commits pequeños con mensaje en español, en imperativo ("Agregar…", "Corregir…"), como el historial existente.

## Entorno (Windows)
- Git: si `git` no está en el PATH, usar `"C:\Program Files\Git\cmd\git.exe"`.
- El login a GitHub no funciona desde Claude Code (no hay interactividad); ya quedó guardado en el Credential Manager, así que `git push` debería funcionar. Si pide credenciales, el usuario debe hacer push desde una terminal normal.
- Python 3.12 disponible en `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` (openpyxl, pandas, python-docx instalados).
- Al darle comandos al usuario para pegar en su terminal: mantenerlos cortos (las rutas largas se parten al copiar).

## Puntos ya detectados para verificar
- README pide login con cuenta institucional Microsoft 365 / Entra ID (RF-01, RNF-04); el código usa email + contraseña de Supabase.
- El envío por correo a la encargada (RF-15, CA-07) aparece como "todavía no está configurado" en el código.
- Revisar estado real de: folio MI-AAAA-0000 con hora del servidor (RF-12), PDF institucional con logo (RF-13), carpetas `<orden>_Fotos` / `<orden>_PDF` (RF-24), bitácora inalterable (RF-23), listas editables sin programar (RF-22), borrador sin señal (RF-10), validación en servidor.
- Último cambio en código: "Corregir formula de constante para media tension" — confirmar contra la tabla 5.1 del README (MT: 120 × bobina).
