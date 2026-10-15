-- Listas iniciales según README §5.1 y §5.2.
-- NO incluye zonas de concesión ni distritos: llegan en un documento Word (issue #2)
-- y se cargarán en una migración posterior.
-- Convenciones: "padre" indica a qué medición/conexión pertenece el valor;
-- los voltajes esperados se guardan como "F1N|F2N|F3N|entre fases" ('-' = no aplica).

-- Bobinas de TC (/5)
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('bobina', '200',  'BT', 1),
  ('bobina', '300',  'BT', 2),
  ('bobina', '400',  'BT', 3),
  ('bobina', '600',  'BT', 4),
  ('bobina', '800',  'BT', 5),
  ('bobina', '1000', 'BT', 6),
  ('bobina', '2000', 'BT', 7),
  ('bobina', '10',   'MT', 1),
  ('bobina', '20',   'MT', 2),
  ('bobina', '50',   'MT', 3),
  ('bobina', '100',  'MT', 4),
  ('bobina', '200',  'MT', 5);

-- Voltajes de servicio disponibles por conexión
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('voltaje_servicio', '120/208',       'estrella-estrella', 1),
  ('voltaje_servicio', '277/480',       'estrella-estrella', 2),
  ('voltaje_servicio', '120/240',       'estrella-delta',    1),
  ('voltaje_servicio', '240/480',       'estrella-delta',    2),
  ('voltaje_servicio', '120/240',       'monofasico',        1),
  ('voltaje_servicio', '240/480',       'monofasico',        2),
  ('voltaje_servicio', '14400/24900',   'MT',                1);

-- Voltajes esperados en baja tensión (§5.2): F1-N|F2-N|F3-N|entre fases
-- Pendiente (9.3): en estrella-delta 120/240 el F3-N podría ser 208 en lugar de 216.
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('voltaje_esperado', '120|120|120|208', 'estrella-estrella 120/208', 1),
  ('voltaje_esperado', '277|277|277|480', 'estrella-estrella 277/480', 2),
  ('voltaje_esperado', '120|120|216|240', 'estrella-delta 120/240',    3),
  ('voltaje_esperado', '240|240|416|480', 'estrella-delta 240/480',    4),
  ('voltaje_esperado', '120|120|-|240',   'monofasico 120/240',        5),
  ('voltaje_esperado', '240|240|-|480',   'monofasico 240/480',        6);

-- Tolerancias (±0,5 % = 0.005)
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('tolerancia', '0.005', 'constante', 1),
  ('tolerancia', '0.005', 'voltaje',   2);

-- Tipos de foto (RF-07). "padre" = 'siempre' o 'cambio' (solo cuando es cambio o retiro).
INSERT INTO listas (tipo, valor, padre, orden) VALUES
  ('tipo_foto', 'bobinas',                         'siempre', 1),
  ('tipo_foto', 'ficha tecnica del TC',            'siempre', 2),
  ('tipo_foto', 'medidores con sentido de corriente', 'siempre', 3),
  ('tipo_foto', 'conexion del transformador',      'siempre', 4),
  ('tipo_foto', 'voltajes del medidor',            'siempre', 5),
  ('tipo_foto', 'lectura del medidor retirado',    'cambio',  6),
  ('tipo_foto', 'ficha del cambio',                'cambio',  7);
