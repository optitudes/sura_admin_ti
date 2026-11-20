# Proyecto final — Administración de Infraestructura de TI · SURA EPS

> **Curso:** Administración de Infraestructura de TI · Universidad del Quindío — Facultad de Ingeniería de Sistemas y Computación  
> **Empresa analizada:** SURA EPS (caso de estudio académico; no es un sitio ni un sistema oficial de la compañía)  
> **Enfoque:** servicios de infraestructura con **Dokploy** (PaaS) y servicios Linux tradicionales

## Resumen

Como equipo de infraestructura contratado por SURA EPS, diseñamos e implementamos los servicios que la organización necesita para centralizar web, archivos, impresión, hora, autenticación y acceso compartido:

- **Dokploy** sobre Ubuntu Server publica el **portal interno de servicios de TI** (Node.js + Express) por **HTTPS**, conectado a una base de datos **PostgreSQL**.
- **Servicios Linux:** NTP (chrony), NFS, NIS, CUPS y Samba, cada uno con su guía de instalación, pruebas y capturas.

Los 7 servicios que pide la guía están implementados y tienen evidencia en `capturas/`.

| # | Servicio | Estado | Guía | Evidencias |
|---|----------|--------|------|------------|
| 1 | Web (portal en Dokploy, HTTPS) | ✅ Implementado | [`codigo/dokploy/dokploy.md`](codigo/dokploy/dokploy.md) | `capturas/dokploy/` |
| 2 | NTP (chrony) | ✅ Implementado | [`codigo/Ntp/ntp.md`](codigo/Ntp/ntp.md) | `capturas/ntp/` |
| 3 | NFS | ✅ Implementado | [`codigo/nfs/nfs.md`](codigo/nfs/nfs.md) | `capturas/nfs/` |
| 4 | NIS | ✅ Implementado | [`codigo/Nis/nis.md`](codigo/Nis/nis.md) | `capturas/nis/` |
| 5 | CUPS | ✅ Implementado | [`codigo/cups/cups.md`](codigo/cups/cups.md) | `capturas/cups/` |
| 6 | Samba | ✅ Implementado | [`codigo/samba/samba.md`](codigo/samba/samba.md) | `capturas/samba/` |
| 7 | Base de datos (PostgreSQL en Dokploy) | ✅ Implementado | [`codigo/dokploy/dokploy.md`](codigo/dokploy/dokploy.md) | `capturas/dokploy/22`–`27` |

## Integrantes y responsabilidades

| Integrante | Servicios |
|------------|-----------|
| Derek Rodríguez Rodríguez | Dokploy, portal web, PostgreSQL, dominio y HTTPS |
| Sara María Otero Echeverry | NTP y NIS |
| Juan Sebastián Rojas García | NFS |
| Sara Juliana Faustino Trujillo | CUPS y Samba |

## Estructura del repositorio

```text
.
├── analisis.md        # Análisis de necesidades, justificación, tabla de requisitos y costo-beneficio
├── diagrama.mmd       # Diagrama de arquitectura (Mermaid)
├── documentacion.md   # Documentación técnica completa: instalación, pruebas, capturas y problemas
├── README.md          # Este archivo
├── capturas/          # Evidencias de cada servicio funcionando
│   ├── dokploy/  nfs/  ntp/  nis/  cups/  samba/
└── codigo/            # Guías, configuraciones y scripts propios por servicio
    ├── dokploy/       # Guía, IP fija (netplan), script de instalación y app web (app/)
    ├── red/           # Red de las VMs de NTP y NIS
    ├── Ntp/  Nis/  nfs/  cups/  samba/
```

> La carpeta `codigo/dokploy/app` es la que Dokploy construye (Build Path `/codigo/dokploy/app`). No se debe mover ni renombrar.

## Cómo revisar el proyecto

1. **Diseño:** leer [`analisis.md`](analisis.md) (justificación, tabla de requisitos, diagrama y costo-beneficio) y ver [`diagrama.mmd`](diagrama.mmd).
2. **Implementación:** seguir [`documentacion.md`](documentacion.md), que reúne el procedimiento de cada servicio en este orden: infraestructura base (VM, IP fija, Dokploy) → base de datos → web y HTTPS → NFS → CUPS → Samba → NTP → NIS.
3. **Detalle por servicio:** cada carpeta de `codigo/` tiene la guía original y su diagrama (`diagrama-<servicio>.md`).
4. **Evidencias:** las capturas están agrupadas por servicio en `capturas/`.

### Verificación rápida

Reemplazar los marcadores por las IP reales del entorno (ver `analisis.md`, §5).

```bash
# Web + base de datos (desde cualquier equipo de la red)
curl -k https://sura.192.168.20.86.sslip.io/health      # {"status":"ok","db":"conectada"}

# NTP (en el cliente)
chronyc sources -v                                      # fuente ^* = 192.168.1.200

# NIS (en el cliente)
ypwhich && getent passwd usuario1                       # 192.168.1.200 y usuario resuelto por NIS

# NFS (en el cliente)
df -h | grep nfs                                        # /mnt/afiliaciones montado

# CUPS (en el servidor)
lpstat -p -d                                            # Impresora_SURA aceptando trabajos

# Samba (en el servidor)
smbclient //localhost/sura -U saraf                     # prompt smb: \>
```

### Desplegar el portal en Dokploy

| Campo | Valor |
|-------|-------|
| Repository URL | `https://github.com/optitudes/sura_admin_ti.git` |
| Branch | `main` |
| Build Path | `/codigo/dokploy/app` |
| Build Type | Dockerfile |
| Variables | `DATABASE_URL=postgresql://sura_app:<contraseña>@<host-interno>:5432/sura` y `PORT=3000` |
| Dominio | `sura.<IP>.sslip.io`, puerto 3000, HTTPS activado |

## Entorno de laboratorio

Cada servicio se implementó y probó en el laboratorio del integrante responsable. El detalle está en `analisis.md`, §1.1.

| Servicio | Equipo | Sistema | IP |
|----------|--------|---------|----|
| Dokploy, web y BD | VM `dokploy-sura` (VMware Workstation) | Ubuntu Server 24.04 LTS | `192.168.20.86` |
| NTP y NIS | VMs `ProyectoFinal` (servidor) y `cliente` | Ubuntu Server 22.04 LTS | `192.168.1.200` / `192.168.1.201` |
| NFS | Servidor `srvarchivos-armenia` | Debian | `192.168.1.6` |
| CUPS y Samba | VM `srv-admin-ti` (UTM, Apple Silicon) | Ubuntu Server 24.04 LTS | `192.168.43.8` |

## Seguridad

- Ninguna contraseña aparece en el repositorio ni en las capturas; los hashes de NIS se ocultaron en las capturas.
- PostgreSQL no expone puertos a la red: la app lo usa por la red interna de Docker.
- `DATABASE_URL` vive solo en las variables de entorno de Dokploy.
- NFS usa `root_squash`; NIS se restringe a la red local con `ypserv.securenets`; Samba exige usuarios del grupo `sambausers`.

## Entregas

| Semana | Entregable | Archivos |
|--------|------------|----------|
| 1 | Análisis y diseño | `analisis.md`, `diagrama.mmd` |
| 2 | Infraestructura base: Dokploy, NTP, DNS y SSL | `codigo/dokploy/`, `codigo/Ntp/`, `capturas/dokploy/`, `capturas/ntp/` |
| 3 | Servicios: NFS, NIS, CUPS, Samba y BD | `codigo/*`, `capturas/*` |
| 4 | Documentación y presentación | `documentacion.md` |
