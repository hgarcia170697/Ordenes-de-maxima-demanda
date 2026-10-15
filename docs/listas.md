# Cómo editar las listas (catálogos)

Las listas viven en la tabla `listas` de D1 y salen en `GET /api/listas`. Cambiarlas **no requiere tocar el código ni publicar la app** (RF-22, RNF-08): la tableta recibe la lista nueva la próxima vez que abre con señal.

Regla de oro: **nunca se borra, se desactiva** (`activo = 0`). Así los reportes viejos siguen teniendo sentido.

La versión (`listas_version`) y la fecha (`listas_actualizada`) suben solas con cualquier cambio.

## Dónde ejecutar el SQL

- Panel de Cloudflare: Storage y bases de datos > D1 > `ordenes-db` > pestaña Console.
- O desde una terminal en la carpeta `worker`:
  `npx wrangler d1 execute ordenes-db --remote --command "SELECT * FROM listas"`

## Columnas por tipo

Columnas: `tipo`, `valor`, `padre`, `orden` (número; define el orden en pantalla), `activo` (1 = se usa, 0 = oculto).

| `tipo` | `valor` | `padre` |
| --- | --- | --- |
| `bobina` | amperaje primario, ej. `600` | `BT` o `MT` |
| `voltaje_servicio` | ej. `120/240` | conexión: `estrella-estrella`, `estrella-delta`, `monofasico`, `MT` (informativo; la API no lo usa todavía) |
| `voltaje_esperado` | `F1-N\|F2-N\|F3-N\|entre fases`, ej. `120\|120\|216\|240`; `-` = no aplica | conexión y voltaje, ej. `estrella-delta 120/240` |
| `tolerancia` | **fracción**, `0.005` = 0,5 % (la API la entrega como 0.5) | `constante` o `voltaje` |
| `tipo_foto` | id de la foto: `bobinas`, `fichaTC`, `sentido`, `conex`, `volt`, `lectRet`, `fichaCambio` | `siempre`, o tipos de orden separados por coma: `cambio`, `retiro`, `instalacion`, `reinstalacion` |
| `zona` | nombre de la zona | vacío |
| `distrito` | nombre del distrito | nombre **exacto** de su zona |

Otros valores (máximo de fotos, versión) están en la tabla `configuracion`: `max_fotos`, `listas_version`, `listas_actualizada`. El TP de media tensión (`120:1`) es fijo en el código.

## Ejemplos

Agregar una bobina de baja tensión (la 1500, después de la 1000):

```sql
INSERT INTO listas (tipo, valor, padre, orden) VALUES ('bobina', '1500', 'BT', 7);
```

Cambiar la tolerancia de constante a ±1 %:

```sql
UPDATE listas SET valor = '0.01' WHERE tipo = 'tolerancia' AND padre = 'constante';
```

Cargar una zona con sus distritos (nombres de ejemplo):

```sql
INSERT INTO listas (tipo, valor, padre, orden) VALUES ('zona', 'Zona de prueba', NULL, 1);
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('distrito', 'Distrito A', 'Zona de prueba', 1),
  ('distrito', 'Distrito B', 'Zona de prueba', 2);
```

Desactivar un valor (por ejemplo, la bobina 300 de BT):

```sql
UPDATE listas SET activo = 0 WHERE tipo = 'bobina' AND valor = '300' AND padre = 'BT';
```

Para reactivarlo: la misma instrucción con `activo = 1`.

## Revisar el resultado

Después de un cambio, `GET /api/listas` (con sesión iniciada) debe mostrar el valor nuevo y una `version` mayor. Para ver qué hay cargado:

```sql
SELECT id, tipo, valor, padre, orden, activo FROM listas ORDER BY tipo, orden;
```

Cuidado con las tildes y mayúsculas al escribir zonas y distritos: el distrito solo aparece si su `padre` es idéntico al `valor` de la zona.
