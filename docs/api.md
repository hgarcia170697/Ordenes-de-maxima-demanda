# Contrato de la API

Versión del contrato: 1.0 (borrador). Basado en el README v1.1 (fuente de verdad de requerimientos).

Este documento es el acuerdo entre el servidor (Cloudflare Worker) y la app de la tableta. Quien programe la tableta debe poder trabajar solo con este archivo. Si algo no está claro o hay que cambiarlo, se discute en el issue antes de tocar el código.

Todos los datos de ejemplo son ficticios (orden 58213, "Cliente de prueba"). Nunca se ponen datos reales de clientes aquí (Ley 8968).

## 1. Convenciones generales

- **Base**: `https://<worker>.workers.dev` (la URL real se define al desplegar). Todas las rutas empiezan con `/api`. Solo HTTPS.
- **Formato**: JSON en UTF-8, salvo `POST /api/reportes` (multipart) y `PUT .../pdf` (PDF binario).
- **Autenticación**: `Authorization: Bearer <token>` en todo, menos `GET /api/salud` y `POST /api/login`. El token es un JWT firmado con HS256 y dura poco (el campo `expira` del login dice cuándo). Si vence, la respuesta es 401 y la tableta debe pedir login de nuevo (sin perder el borrador ni la cola de envíos).
- **Fechas**: ISO 8601 en UTC, por ejemplo `2026-10-15T16:30:00Z`. La tableta las muestra en hora de Costa Rica (UTC-6).
- **Números**: en JSON van como texto tal como los escribió el líder (`"122.4"`), con punto decimal. El servidor los convierte y valida. La constante y los voltajes se comparan con `shared/reglas.js`, el mismo archivo que usa la tableta.
- **Líder**: el servidor toma el nombre del líder (campo `tecnico` del formulario) del token; la tableta no lo envía. Cada líder solo ve y completa sus propios reportes.

### 1.1 Formato único de error

Toda respuesta con error tiene este cuerpo:

```json
{
  "error": {
    "codigo": "validacion",
    "mensaje": "Hay datos faltantes o que no cuadran.",
    "campos": [
      { "campo": "orden", "mensaje": "Requerido" }
    ]
  }
}
```

`campos` solo aparece en errores 422 (puede omitirse en los demás). `campo` usa las mismas claves del formulario (`orden`, `v3`, `foto_bobinas`...).

| HTTP | `codigo` | Cuándo |
| --- | --- | --- |
| 400 | `peticion_invalida` | JSON mal formado, falta `datos`, cabecera obligatoria ausente |
| 401 | `no_autenticado` | Falta el token, está vencido o es inválido; usuario o contraseña incorrectos |
| 403 | `prohibido` | El recurso es de otro líder (se registra en la bitácora) |
| 404 | `no_encontrado` | El folio no existe |
| 409 | `orden_repetida` / `pdf_ya_subido` | Conflicto (ver cada endpoint) |
| 413 | `demasiado_grande` | Fotos o PDF exceden el límite |
| 422 | `validacion` | Los datos no pasan las reglas RN (trae `campos`) |
| 429 | `demasiados_intentos` | Demasiados intentos (login o alertas); incluye cabecera `Retry-After` en segundos |
| 500 | `error_interno` | Falla del servidor; la tableta reintenta con la misma `Idempotency-Key` |

## 2. Resumen de endpoints

| Método y ruta | Auth | Para qué | Cubre |
| --- | --- | --- | --- |
| `GET /api/salud` | No | Comprobar que el servidor responde y su versión | RNF-06 |
| `POST /api/login` | No | Obtener el token | RF-01, RNF-04, RF-23 |
| `GET /api/listas` | Sí | Descargar listas y tolerancias para usar sin señal | RF-22, RF-10, RN-01 |
| `POST /api/reportes` | Sí | Paso 1: datos y fotos; devuelve folio | RF-11, RF-12, RF-24, RN-01 a RN-06 |
| `PUT /api/reportes/:folio/pdf` | Sí | Paso 2: subir el PDF; bloquea y envía el correo | RF-13, RF-14, RF-15, RN-07 |
| `GET /api/reportes` | Sí | Listar los reportes propios | RF-14 |
| `GET /api/reportes/:folio` | Sí | Ver un reporte propio | RF-14, CA-08 |
| `POST /api/alertas/constante` | Sí | Avisar a la encargada de una constante incorrecta | RF-25, RN-02, CA-10 |

## 3. Endpoints

### 3.1 `GET /api/salud`

Propósito: saber si el Worker está vivo y qué versión corre. No toca D1 ni R2.

Respuesta 200:

```json
{ "ok": true, "version": "1.0.0" }
```

Errores: ninguno esperado (si no responde, no hay conexión o el servicio está caído).

### 3.2 `POST /api/login`

Propósito: entrar con usuario y contraseña propios (RF-01). Queda registrado en la bitácora (RF-23).

Petición:

```json
{ "usuario": "lider1", "contrasena": "********" }
```

Respuesta 200:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nombre": "Líder de prueba",
  "expira": "2026-10-15T22:30:00Z"
}
```

Errores:

- 400 `peticion_invalida`: falta `usuario` o `contrasena`.
- 401 `no_autenticado`: usuario o contraseña incorrectos (el mensaje no dice cuál de los dos).
- 429 `demasiados_intentos`: demasiados intentos fallidos; esperar `Retry-After` segundos.

### 3.3 `GET /api/listas`

Propósito: entregar todo lo que el formulario necesita para filtrar opciones y validar (RN-01, RN-02, RN-03, RF-22). La tableta la descarga después de iniciar sesión y cada vez que abre con señal, la guarda en el equipo y la usa sin señal (RF-10). Cambiar una lista no requiere cambiar la app (RNF-08).

Respuesta 200:

```json
{
  "version": 7,
  "actualizada": "2026-10-15T15:00:00Z",
  "bobinas": {
    "bt": [200, 300, 400, 600, 800, 1000, 2000],
    "mt": [10, 20, 50, 100, 200]
  },
  "tp_mt": "120:1",
  "voltajes": [
    {
      "medicion": "Baja tensión",
      "sistema": "Trifásico",
      "conexion": "Estrella-delta",
      "voltaje": "120/240",
      "fn": [120, 120, 216],
      "entre_fases": [240, 240, 240]
    },
    {
      "medicion": "Baja tensión",
      "sistema": "Monofásico",
      "conexion": "Monofásico",
      "voltaje": "120/240",
      "fn": [120, 120, null],
      "entre_fases": [240, null, null]
    }
  ],
  "tolerancias": { "constante": 0.5, "voltajes": 0.5 },
  "zonas": [
    { "zona": "Zona de prueba", "distritos": ["Distrito A", "Distrito B"] }
  ],
  "fotos": {
    "Cambio": ["bobinas", "fichaTC", "lectRet", "sentido", "conex", "fichaCambio", "volt"],
    "Retiro": ["bobinas", "fichaTC", "lectRet", "sentido", "conex", "volt"],
    "Instalación nueva": ["bobinas", "fichaTC", "sentido", "conex", "volt"],
    "Reinstalación": ["bobinas", "fichaTC", "sentido", "conex", "volt"]
  },
  "max_fotos": 10
}
```
Las tolerancias se entregan en **porcentaje** (0.5 = ±0,5 %). En D1 se guardan como fracción (`0.005`, tabla `listas`, tipo `tolerancia`); el Worker hace la conversión. Los tipos de foto usan los mismos ids del formulario (`bobinas`, `fichaTC`, `sentido`, `conex`, `volt`, `lectRet`, `fichaCambio`).

Notas:

- `tolerancias` están en porcentaje (`0.5` = ±0,5 %).
- `fn` = valores esperados F1-N, F2-N, F3-N; `entre_fases` = F1-F2, F2-F3, F3-F1. `null` significa que no aplica.
- Los tipos de foto son los ids del formulario: `bobinas`, `fichaTC`, `lectRet`, `sentido`, `conex`, `fichaCambio`, `volt`.
- Los valores de ejemplo son ilustrativos. Los pendientes del README 9.3 (F3-N de estrella-delta 120/240, constante de MT, fotos de retiro) pueden cambiar valores sin cambiar el formato.
- La constante esperada se calcula con `shared/reglas.js` a partir de `medicion` y `tc`; no viene en la lista.
- Si la tableta nunca descargó las listas, no puede abrir un formulario nuevo: debe mostrar "Conéctese una vez para descargar las listas".

Errores: 401 `no_autenticado`.

### 3.4 `POST /api/reportes` (paso 1)

Propósito: enviar los datos y las fotos de un reporte. El servidor valida todo otra vez con `shared/reglas.js` (RN-01 a RN-06), asigna el folio `MI-AAAA-0000` con fecha y hora del servidor (RF-12), guarda los datos y las fotos originales (RF-24) y deja el reporte en estado `esperando_pdf`. Todavía no se envía correo.

Cabeceras:

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data` (con boundary; lo pone la librería de HTTP)
- `Idempotency-Key: <uuid v4>`: lo genera la tableta una sola vez por reporte y lo reusa en cada reintento. Si el servidor ya procesó esa clave, devuelve la misma respuesta 201 original sin crear otro reporte.

Partes del multipart:

1. `datos` (texto JSON) con estas claves (las `data-k` de `index.html`). No se envía `tecnico`: sale del token.

| Clave | Contenido |
| --- | --- |
| `tipo` | `Cambio`, `Retiro`, `Instalación nueva` o `Reinstalación` |
| `orden`, `contrato`, `cliente`, `direccion` | Texto. `direccion` (señas) es opcional; `contrato` es obligatorio (ver pendiente en README 9.3) |
| `zona`, `distrito` | Texto; el distrito debe pertenecer a la zona. En `index.html` el campo aún se llama `canton`; la tableta lo envía como `zona` |
| `cliTipo` | `Residencial`, `Comercial` o `Industrial` |
| `acometida` | `Aérea` o `Subterránea` |
| `medicion`, `sistema`, `conexion`, `voltaje` | Texto, según las listas |
| `trafos`, `kva` | Cantidad de transformadores y kVA |
| `macro` | `Sí` o `No`; si es `Sí`, `medAsoc` es obligatorio |
| `medAsoc` | Cantidad de medidores asociados |
| `rNum`, `rMarca`, `rKwh`, `rKw`, `rSello` | Medidor retirado (solo en cambio o retiro) |
| `iNum`, `iMarca`, `iClase`, `iKwh`, `iKw`, `iSello`, `iSelloMD` | Medidor instalado |
| `tc` | Bobina, por ejemplo `"600"` |
| `constante` | Constante calculada por la tableta |
| `constAnt` | Constante anterior (solo en cambio) |
| `v1`, `v2`, `v3` | Voltajes fase-neutro (`v3` solo en trifásico) |
| `f12`, `f23`, `f31` | Voltajes entre fases |
| `a1`, `a2`, `a3` | Amperajes |
| `fp` | Factor de potencia |
| `obs` | Observaciones (obligatorias si la constante nueva difiere de la anterior, RN-04) |
| `decl` | `true`: confirmación del líder |

El TP en media tensión (`120:1`) no se envía: lo deduce el servidor.

2. Archivos `foto_<tipo>_<n>`: JPEG, `n` desde 1. Ejemplos: `foto_bobinas_1`, `foto_volt_2`. Máximo 10 en total (RN-05). La tableta debe reducirlas antes de enviar (por ejemplo, lado mayor de 1600 px, calidad cercana a 0,8) para que el conjunto quede por debajo del límite del servidor. El servidor las guarda en R2 como `58213_Fotos/58213_bobinas_1.jpg`.

Ejemplo (resumido) de `datos`:

```json
{
  "tipo": "Cambio",
  "orden": "58213",
  "contrato": "N/A",
  "cliente": "Cliente de prueba",
  "zona": "Zona de prueba",
  "distrito": "Distrito A",
  "direccion": "Señas de ejemplo",
  "cliTipo": "Industrial",
  "acometida": "Aérea",
  "medicion": "Baja tensión",
  "sistema": "Trifásico",
  "conexion": "Estrella-delta",
  "voltaje": "120/240",
  "trafos": "3",
  "kva": "300",
  "macro": "No",
  "rNum": "771045", "rMarca": "Marca R", "rKwh": "98231.4", "rKw": "86.2", "rSello": "A-31877",
  "iNum": "800192", "iMarca": "Marca I", "iClase": "20", "iKwh": "11548.9", "iKw": "1.54",
  "iSello": "A-55102", "iSelloMD": "A-55103",
  "tc": "600", "constante": "122.4", "constAnt": "163.2",
  "v1": "121.2", "v2": "119.8", "v3": "216.5",
  "f12": "241", "f23": "239.6", "f31": "240.8",
  "a1": "142", "a2": "138", "a3": "151", "fp": "0.93",
  "obs": "Se cambió el TC; la constante pasa de 163.2 a 122.4.",
  "decl": true
}
```

Respuesta 201:

```json
{
  "folio": "MI-2026-0001",
  "numero_orden": "58213",
  "fecha_servidor": "2026-10-15T16:30:12Z"
}
```

Errores:

- 400 `peticion_invalida`: no es multipart, falta `datos`, `datos` no es JSON o falta `Idempotency-Key` (debe ser un UUID).
- 401 `no_autenticado`.
- 409 `orden_repetida`: ya existe un reporte con esa orden (RN-06) y no es un reintento de la misma `Idempotency-Key`.
- 413 `demasiado_grande`: el conjunto de fotos excede el límite del servidor; la tableta recomprime y reintenta.
- 422 `validacion`: con `campos`, por ejemplo:

```json
{
  "error": {
    "codigo": "validacion",
    "mensaje": "Hay datos faltantes o que no cuadran.",
    "campos": [
      { "campo": "orden", "mensaje": "Requerido" },
      { "campo": "constante", "mensaje": "Fuera de ±0,5 % del valor esperado (122.4)" },
      { "campo": "foto_bobinas", "mensaje": "Falta al menos una foto" }
    ]
  }
}
```

Si `constante` falla, la tableta ya debió bloquear antes (ver 3.8); el servidor la rechaza igual como defensa.

### 3.5 `PUT /api/reportes/:folio/pdf` (paso 2)

Propósito: subir el PDF que la tableta armó con el folio (RF-13). El servidor lo guarda en R2 (`58213_PDF/58213.pdf`), calcula el SHA-256 y lo anota en la bitácora (RF-23), marca el reporte como `completo` (inalterable, RF-14, RN-07) y encola el correo a la encargada con el PDF adjunto (RF-15).

Cabeceras: `Authorization`, `Content-Type: application/pdf`. Cuerpo: los bytes del PDF, máximo ~3,5 MB (límite del adjunto).

Respuesta 200:

```json
{ "ok": true, "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" }
```

Este endpoint es idempotente: si el reporte ya está `completo` y el PDF enviado tiene el mismo SHA-256, devuelve 200 con el mismo resultado (sin duplicar el correo). Si el PDF es distinto, responde 409.

El correo sale de forma asíncrona. El éxito de este endpoint no significa que el correo ya llegó: `correo_estado` pasa de `pendiente` a `enviado` o `error`, y los fallos se reintentan solos (RF-15). Se consulta con `GET /api/reportes/:folio`.

Errores:

- 400 `peticion_invalida`: el cuerpo no es un PDF (no empieza con `%PDF-`) o está vacío.
- 401 `no_autenticado`.
- 403 `prohibido`: el folio es de otro líder.
- 404 `no_encontrado`: el folio no existe.
- 409 `pdf_ya_subido`: el reporte ya está `completo` con un PDF distinto.
- 413 `demasiado_grande`: el PDF pasa de ~3,5 MB.

### 3.6 `GET /api/reportes`

Propósito: lista de los reportes propios del líder, solo lectura (RF-14). Orden: más reciente primero. Parámetros opcionales: `limite` (1 a 100, por defecto 50) y `desde` (cursor devuelto antes como `siguiente`).

Respuesta 200:

```json
{
  "reportes": [
    {
      "folio": "MI-2026-0001",
      "numero_orden": "58213",
      "cliente": "Cliente de prueba",
      "tipo": "Cambio",
      "estado": "completo",
      "correo_estado": "enviado",
      "fecha_servidor": "2026-10-15T16:30:12Z"
    }
  ],
  "siguiente": null
}
```

`estado`: `esperando_pdf` o `completo`. `correo_estado`: `pendiente`, `enviado` o `error`.

Errores: 401 `no_autenticado`.

### 3.7 `GET /api/reportes/:folio`

Propósito: ver un reporte propio completo (CA-08). Si el folio es de otro líder, responde 403 y el intento queda en la bitácora.

Respuesta 200:

```json
{
  "folio": "MI-2026-0001",
  "numero_orden": "58213",
  "estado": "completo",
  "correo_estado": "enviado",
  "fecha_servidor": "2026-10-15T16:30:12Z",
  "datos": { "tipo": "Cambio", "orden": "58213", "cliente": "Cliente de prueba", "...": "..." },
  "fotos": [
    { "tipo": "bobinas", "n": 1, "archivo": "58213_bobinas_1.jpg" }
  ],
  "pdf": { "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" }
}
```

`datos` trae las mismas claves del paso 1 (más `tecnico`). `pdf` es `null` mientras el estado sea `esperando_pdf`. En esta versión no hay descarga de fotos ni PDF por la API: la tableta ya los tiene, y los archivos en R2 son privados (RNF-04).

Errores: 401 `no_autenticado`, 403 `prohibido`, 404 `no_encontrado`.

### 3.8 `POST /api/alertas/constante`

Propósito: cuando el líder intenta enviar y la constante queda fuera de ±0,5 % (RN-02), la tableta bloquea el envío y llama a este endpoint para avisar a la encargada (RF-25, CA-10). El servidor no confía en la tableta: recalcula la constante esperada con `shared/reglas.js` y solo envía el correo si de verdad está fuera de tolerancia. Queda en la tabla `alertas_constante` y en la bitácora. Se dispara al intentar enviar, no mientras se escribe.

Petición:

```json
{
  "numero_orden": "58213",
  "constante_ingresada": "120.0",
  "medicion": "Baja tensión",
  "tc": "600"
}
```

Respuesta 202 (aceptada; el correo se envía de forma asíncrona):

```json
{ "ok": true, "enviada": true, "constante_esperada": "122.4" }
```

Si el servidor recalcula y la constante sí está dentro de tolerancia, responde 202 con `"enviada": false` y no manda correo. Esto evita alertas falsas.

Sin señal, la tableta guarda la alerta en cola y la envía al recuperar la conexión. Puede mandar además `fecha_intento` (ISO 8601) para que el correo diga cuándo ocurrió.

Errores: 400 `peticion_invalida`, 401 `no_autenticado`, 422 `validacion` (por ejemplo `tc` que no existe en las listas), 429 `demasiados_intentos` (límite por líder para no saturar a la encargada).

## 4. Flujo de envío en dos pasos

Por qué dos pasos: el folio lo asigna el servidor, pero el PDF debe llevar ese folio y se arma en la tableta (RF-13). Primero se piden folio y validación; después se sube el PDF.

```mermaid
sequenceDiagram
    autonumber
    participant T as Tableta (app)
    participant W as Worker
    participant D as D1
    participant R as R2
    participant G as Gmail SMTP
    Note over T: El líder toca Enviar y la tableta valida (incluida la constante)
    T->>W: POST /api/reportes (datos + fotos, Idempotency-Key)
    W->>W: Valida con shared/reglas.js (RN-01 a RN-06)
    W->>D: Asigna folio (contadores); reporte = esperando_pdf
    W->>R: Guarda fotos (58213_Fotos/...)
    W->>D: Bitácora: envío recibido
    W-->>T: 201 {folio, numero_orden, fecha_servidor}
    Note over T: Arma el PDF con el folio
    T->>W: PUT /api/reportes/MI-2026-0001/pdf (application/pdf)
    W->>R: Guarda PDF (58213_PDF/58213.pdf)
    W->>D: reporte = completo (bloqueado); SHA-256 en bitácora; correo_estado = pendiente
    W-->>T: 200 {ok:true, sha256}
    W->>G: Correo con PDF adjunto a la encargada (asíncrono)
    G-->>W: Resultado
    W->>D: correo_estado = enviado (o error y se reintenta)
```

### 4.1 Qué hace la tableta si se pierde la señal

La tableta guarda en su almacenamiento local, por reporte: los datos, las fotos, la `Idempotency-Key`, el folio (cuando lo recibe) y el PDF generado. Estados locales sugeridos: `borrador` → `pendiente_paso1` → `pendiente_pdf` → `enviado`.

| Situación | Qué hace la tableta |
| --- | --- |
| Sin señal antes del paso 1 | Guarda el reporte en cola (RF-10). Al recuperar señal hace el paso 1 con la misma `Idempotency-Key` |
| Se corta durante el paso 1 y no llegó respuesta | Reintenta el paso 1 con la **misma** `Idempotency-Key`. Si el servidor ya lo había procesado, devuelve el mismo folio con 201; no se duplica el reporte ni se gasta otro folio |
| Llegó el folio y se perdió la señal | Guarda el folio, genera el PDF localmente y lo deja en cola. Al volver la señal hace el paso 2. No repite el paso 1 |
| Se corta durante el paso 2 | Reintenta el `PUT` con el mismo PDF (es idempotente: mismo SHA-256 da 200) |
| Cierran la app entre pasos | Al abrir, la tableta revisa su cola y retoma los que estén en `pendiente_pdf`. Si no tiene el PDF local, lo regenera con los datos y el folio guardados |
| El reporte queda en `esperando_pdf` mucho tiempo | No se envía correo ni se considera enviado. "Mis reportes" lo muestra como "Falta completar" hasta que se suba el PDF |
| 401 en cualquier paso | Pide login de nuevo sin borrar la cola y continúa donde quedó |
| 5xx o timeout | Reintenta con espera creciente (por ejemplo 5 s, 15 s, 45 s, luego cada pocos minutos) |
| 422 | No reintenta: marca los campos y devuelve al líder al formulario |
| 409 `orden_repetida` | No reintenta: avisa que la orden ya existe (RN-06) |

Regla del PDF regenerado: si el PDF nuevo no es idéntico byte a byte al primero (por ejemplo porque cambia la fecha de generación), el servidor lo acepta solo si el reporte todavía está `esperando_pdf`. Si ya estaba `completo`, la tableta no debe volver a subirlo.

## 5. Tablas de D1 que usa la API

Los nombres son los del esquema que se crea en otro issue. Esta tabla solo indica qué endpoint toca qué tabla.

| Tabla | Para qué | La usan |
| --- | --- | --- |
| `usuarios` | Líderes, contraseña cifrada, rol | login |
| `configuracion` | Clave/valor, por ejemplo `correo_encargada` | correos |
| `listas` | Bobinas, voltajes, zonas, distritos, tolerancias | `GET /api/listas` |
| `contadores` | Consecutivo del folio por año | `POST /api/reportes` |
| `reportes` | Datos, `estado` (`esperando_pdf` o `completo`), `correo_estado` (`pendiente`, `enviado` o `error`), folio, líder | todos los de reportes |
| `fotos` | Tipo, archivo en R2, fecha y hora | paso 1 |
| `alertas_constante` | Orden, líder, constante ingresada y esperada, fecha de la alerta y del correo | `POST /api/alertas/constante` |
| `bitacora` | Solo inserción, con cadena de hashes (RF-23) | login, envíos, PDF, alertas, accesos denegados |

## 6. Pendientes de este contrato

- Valores finales de los límites de tamaño del conjunto de fotos (413) y de los intentos de login y alertas (429): se fijan al implementar y se anotan aquí.
- Los pendientes del README 9.3 (constante de MT, F3-N en estrella-delta, contrato, retiro, reportes de corrección) pueden cambiar valores o reglas, no la forma de la API. Si se aprueban reportes de corrección con la misma orden (RN-06), se agregará un campo `folio_original` al paso 1.
- Los valores exactos de `tipo`, `medicion`, `sistema` y `conexion` deben coincidir con `index.html` y con `GET /api/listas`; se confirma al integrar.
