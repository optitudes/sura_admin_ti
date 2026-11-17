// Portal interno de servicios de TI — caso de estudio SURA EPS
// Proyecto académico (Administración de Infraestructura de TI, UdeQ). No es un sitio oficial de SURA EPS.
const express = require('express');
const os = require('os');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.static('public'));

// Crea las tablas y datos de ejemplo si no existen
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sedes (
      id SERIAL PRIMARY KEY,
      ciudad TEXT NOT NULL,
      nombre TEXT NOT NULL,
      equipos INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS servicios (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT NOT NULL,
      responsable TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS incidentes (
      id SERIAL PRIMARY KEY,
      sede_id INT REFERENCES sedes(id),
      servicio TEXT NOT NULL,
      descripcion TEXT NOT NULL CHECK (char_length(descripcion) <= 300),
      prioridad TEXT NOT NULL CHECK (prioridad IN ('Baja','Media','Alta')),
      estado TEXT NOT NULL DEFAULT 'Abierto',
      creado TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM sedes');
  if (rows[0].n === 0) {
    await pool.query(`INSERT INTO sedes (ciudad, nombre, equipos) VALUES
      ('Medellín','Sede principal',120),('Bogotá','Oficina regional centro',85),
      ('Cali','Oficina regional occidente',60),('Armenia','Punto de atención Eje Cafetero',25)`);
    await pool.query(`INSERT INTO servicios (nombre, descripcion, responsable) VALUES
      ('Web (Dokploy)','Portal interno desplegado como contenedor con HTTPS','Derek Rodríguez'),
      ('Base de datos','PostgreSQL gestionado por Dokploy','Derek Rodríguez'),
      ('NTP','Sincronización horaria de todos los servidores','Equipo NTP/NIS'),
      ('NIS','Directorio centralizado de usuarios Linux','Equipo NTP/NIS'),
      ('NFS','Volúmenes compartidos de Afiliaciones y Autorizaciones','Equipo NFS'),
      ('CUPS','Servidor de impresión centralizado','Equipo CUPS/Samba'),
      ('Samba','Carpetas compartidas para equipos Windows','Equipo CUPS/Samba')
      ON CONFLICT (nombre) DO NOTHING`);
  }
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', db: 'conectada' }); }
  catch (e) { res.status(503).json({ status: 'error', db: 'sin conexión' }); }
});

app.get('/api/estado', async (_req, res) => {
  try {
    const v = await pool.query('SELECT version() AS v, now() AS ahora, current_database() AS db');
    res.json({
      contenedor: os.hostname(),
      node: process.version,
      postgres: v.rows[0].v.split(' on ')[0],
      base_de_datos: v.rows[0].db,
      hora_servidor_bd: v.rows[0].ahora
    });
  } catch (e) { res.status(503).json({ error: 'Base de datos no disponible' }); }
});

app.get('/api/sedes', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM sedes ORDER BY id');
  res.json(rows);
});

app.get('/api/servicios', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM servicios ORDER BY id');
  res.json(rows);
});

app.get('/api/incidentes', async (_req, res) => {
  const { rows } = await pool.query(`SELECT i.id, s.ciudad, i.servicio, i.descripcion, i.prioridad, i.estado, i.creado
    FROM incidentes i LEFT JOIN sedes s ON s.id = i.sede_id ORDER BY i.id DESC LIMIT 20`);
  res.json(rows);
});

app.post('/api/incidentes', async (req, res) => {
  const { sede_id, servicio, descripcion, prioridad } = req.body || {};
  if (!sede_id || !servicio || !descripcion || !['Baja','Media','Alta'].includes(prioridad))
    return res.status(400).json({ error: 'Datos incompletos' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO incidentes (sede_id, servicio, descripcion, prioridad) VALUES ($1,$2,$3,$4) RETURNING *',
      [sede_id, String(servicio).slice(0, 50), String(descripcion).slice(0, 300), prioridad]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: 'No se pudo registrar' }); }
});

(async function start() {
  for (let i = 1; i <= 10; i++) {
    try { await initDB(); console.log('Base de datos lista'); break; }
    catch (e) { console.log(`Esperando base de datos (intento ${i}/10): ${e.message}`); await new Promise(r => setTimeout(r, 3000)); }
  }
  app.listen(PORT, () => console.log(`Portal SURA EPS (académico) escuchando en puerto ${PORT}`));
})();
