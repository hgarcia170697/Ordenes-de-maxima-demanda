-- Esquema inicial (SQLite / Cloudflare D1). Sigue el README §7.1.
-- Los reportes no se borran ni se sobrescriben; las listas se desactivan, no se borran.

CREATE TABLE usuarios (
  id           INTEGER PRIMARY KEY,
  usuario      TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL,
  hash         TEXT NOT NULL,      -- contraseña derivada (PBKDF2), nunca en claro
  sal          TEXT NOT NULL,
  iteraciones  INTEGER NOT NULL,
  activo       INTEGER NOT NULL DEFAULT 1,
  creado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Para limitar los intentos fallidos de inicio de sesión.
CREATE TABLE intentos_login (
  usuario  TEXT NOT NULL,
  fecha    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_intentos_login_usuario ON intentos_login (usuario, fecha);

CREATE TABLE configuracion (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);
-- El correo de la encargada se llena después (no va en el código).
INSERT INTO configuracion (clave, valor) VALUES ('correo_encargada', '');

CREATE TABLE listas (
  id      INTEGER PRIMARY KEY,
  tipo    TEXT NOT NULL,
  valor   TEXT NOT NULL,
  padre   TEXT,            -- p. ej. la zona de un distrito
  orden   INTEGER,
  activo  INTEGER DEFAULT 1
);
CREATE INDEX idx_listas_tipo ON listas (tipo, activo, orden);

-- Contador del folio MI-AAAA-0000: un valor por año.
CREATE TABLE contadores (
  anio   INTEGER PRIMARY KEY,
  valor  INTEGER NOT NULL
);

-- NOTA: UNIQUE(numero_orden) aplica la regla RN-06 (orden no repetida).
-- Puede cambiar según lo que decida Hazel sobre las correcciones (issue #1).
CREATE TABLE reportes (
  folio            TEXT PRIMARY KEY,
  numero_orden     TEXT NOT NULL UNIQUE,
  usuario_id       INTEGER NOT NULL REFERENCES usuarios (id),
  tipo_orden       TEXT NOT NULL,
  datos            TEXT NOT NULL,            -- JSON con el formulario completo
  fecha_servidor   TEXT NOT NULL,
  idempotency_key  TEXT UNIQUE,
  estado           TEXT NOT NULL CHECK (estado IN ('esperando_pdf', 'completo')),
  pdf_ruta         TEXT,
  pdf_sha256       TEXT,
  correo_estado    TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (correo_estado IN ('pendiente', 'enviado', 'error')),
  correo_intentos  INTEGER NOT NULL DEFAULT 0,
  folio_original   TEXT                      -- si es una corrección
);
CREATE INDEX idx_reportes_usuario ON reportes (usuario_id);

CREATE TABLE fotos (
  id         INTEGER PRIMARY KEY,
  folio      TEXT NOT NULL REFERENCES reportes (folio),
  tipo       TEXT NOT NULL,
  numero     INTEGER NOT NULL,
  ruta       TEXT NOT NULL,
  bytes      INTEGER,
  creado_en  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_fotos_folio ON fotos (folio);

CREATE TABLE alertas_constante (
  id                  INTEGER PRIMARY KEY,
  numero_orden        TEXT NOT NULL,
  usuario_id          INTEGER REFERENCES usuarios (id),
  medicion            TEXT,
  tc                  TEXT,
  constante_ingresada REAL,
  constante_esperada  REAL,
  fecha               TEXT NOT NULL DEFAULT (datetime('now')),
  correo_estado       TEXT NOT NULL DEFAULT 'pendiente'
);

-- Bitácora solo-insertar con cadena de hashes (RF-23).
CREATE TABLE bitacora (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha          TEXT NOT NULL DEFAULT (datetime('now')),
  usuario_id     INTEGER,
  accion         TEXT NOT NULL,
  folio          TEXT,
  detalle        TEXT,
  hash_anterior  TEXT,
  hash           TEXT NOT NULL
);
CREATE INDEX idx_bitacora_folio ON bitacora (folio);

-- ---------------------------------------------------------------
-- Triggers de inalterabilidad (RF-14, RF-23, RNF-05)
-- ---------------------------------------------------------------

CREATE TRIGGER bitacora_sin_update BEFORE UPDATE ON bitacora
BEGIN
  SELECT RAISE(ABORT, 'bitacora inalterable');
END;

CREATE TRIGGER bitacora_sin_delete BEFORE DELETE ON bitacora
BEGIN
  SELECT RAISE(ABORT, 'bitacora inalterable');
END;

CREATE TRIGGER reportes_sin_delete BEFORE DELETE ON reportes
BEGIN
  SELECT RAISE(ABORT, 'los reportes no se borran');
END;

-- Un reporte 'completo' solo admite cambios en correo_estado y correo_intentos.
CREATE TRIGGER reportes_completo_inalterable BEFORE UPDATE ON reportes
WHEN OLD.estado = 'completo'
 AND (   NEW.folio            IS NOT OLD.folio
      OR NEW.numero_orden     IS NOT OLD.numero_orden
      OR NEW.usuario_id       IS NOT OLD.usuario_id
      OR NEW.tipo_orden       IS NOT OLD.tipo_orden
      OR NEW.datos            IS NOT OLD.datos
      OR NEW.fecha_servidor   IS NOT OLD.fecha_servidor
      OR NEW.idempotency_key  IS NOT OLD.idempotency_key
      OR NEW.estado           IS NOT OLD.estado
      OR NEW.pdf_ruta         IS NOT OLD.pdf_ruta
      OR NEW.pdf_sha256       IS NOT OLD.pdf_sha256
      OR NEW.folio_original   IS NOT OLD.folio_original)
BEGIN
  SELECT RAISE(ABORT, 'reporte completo inalterable');
END;

CREATE TRIGGER fotos_sin_update BEFORE UPDATE ON fotos
BEGIN
  SELECT RAISE(ABORT, 'las fotos no se modifican');
END;

CREATE TRIGGER fotos_sin_delete BEFORE DELETE ON fotos
BEGIN
  SELECT RAISE(ABORT, 'las fotos no se borran');
END;
