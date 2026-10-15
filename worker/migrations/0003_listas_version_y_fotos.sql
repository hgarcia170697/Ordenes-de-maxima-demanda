-- Complementos para GET /api/listas (issue #16). No modifica 0001 ni 0002, solo agrega y ajusta datos.

-- 1) Versión de las listas: sube sola cada vez que alguien cambia la tabla "listas"
--    (así nadie tiene que acordarse de subirla a mano al editar desde la consola).
INSERT INTO configuracion (clave, valor) VALUES
  ('listas_version', '1'),
  ('listas_actualizada', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('max_fotos', '10');   -- RN-05

CREATE TRIGGER listas_version_insert AFTER INSERT ON listas
BEGIN
  UPDATE configuracion SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'listas_version';
  UPDATE configuracion SET valor = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE clave = 'listas_actualizada';
END;

CREATE TRIGGER listas_version_update AFTER UPDATE ON listas
BEGIN
  UPDATE configuracion SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'listas_version';
  UPDATE configuracion SET valor = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE clave = 'listas_actualizada';
END;

CREATE TRIGGER listas_version_delete AFTER DELETE ON listas
BEGIN
  UPDATE configuracion SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'listas_version';
  UPDATE configuracion SET valor = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE clave = 'listas_actualizada';
END;

-- 2) Fotos por tipo de orden. En 0002, "padre" solo decía 'siempre' o 'cambio', y no alcanza:
--    el contrato da lectRet también a Retiro. Desde ahora "padre" es 'siempre' o una lista
--    de tipos de orden separados por coma: cambio, retiro, instalacion, reinstalacion.
--    También se ordena como en docs/api.md.
UPDATE listas SET padre = 'cambio,retiro', orden = 3 WHERE tipo = 'tipo_foto' AND valor = 'lectRet';
UPDATE listas SET padre = 'cambio',        orden = 6 WHERE tipo = 'tipo_foto' AND valor = 'fichaCambio';
UPDATE listas SET orden = 4 WHERE tipo = 'tipo_foto' AND valor = 'sentido';
UPDATE listas SET orden = 5 WHERE tipo = 'tipo_foto' AND valor = 'conex';
UPDATE listas SET orden = 7 WHERE tipo = 'tipo_foto' AND valor = 'volt';
