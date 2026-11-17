# Portal interno de servicios de TI — caso de estudio SURA EPS

> **Proyecto académico** (Administración de Infraestructura de TI, Universidad del Quindío).
> No es un sitio oficial de SURA EPS ni está afiliado a la compañía. Todos los datos son de prueba.

Aplicación Node.js + Express desplegada con **Dokploy** y conectada a **PostgreSQL**.

## Endpoints
| Ruta | Descripción |
|---|---|
| `/` | Portal web |
| `/health` | Estado de la app y de la conexión a la BD |
| `/api/estado` | Contenedor, versión de Node y de PostgreSQL |
| `/api/sedes`, `/api/servicios` | Datos de ejemplo almacenados en PostgreSQL |
| `GET/POST /api/incidentes` | Registro de incidentes de TI (sin datos personales) |

## Variables de entorno
- `DATABASE_URL` — cadena de conexión interna a PostgreSQL de Dokploy
- `PORT` — 3000 por defecto

Las tablas y los datos de ejemplo se crean automáticamente al iniciar.
