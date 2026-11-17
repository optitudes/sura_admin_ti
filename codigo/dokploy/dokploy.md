# Plataforma de despliegue Dokploy — SURA EPS

> **Documentación técnica de infraestructura**  
> **Empresa:** SURA EPS (caso de estudio académico)  
> **Área:** Tecnología de la Información / Infraestructura y Operaciones  
> **Servicio:** Dokploy (PaaS) — Portal web interno, base de datos PostgreSQL y HTTPS  
> **Responsable:** Derek Rodríguez Rodríguez  
> **Versión:** 1.0  

---

## 1. Propósito y alcance

Este documento describe cómo se preparó el servidor `dokploy-sura` y cómo se instaló Dokploy, la plataforma con la que SURA EPS despliega sus aplicaciones web internas en contenedores. Sobre esta plataforma se publica el **Portal interno de servicios de TI**, que se conecta a una base de datos PostgreSQL y se sirve por HTTPS.

| Elemento | Valor |
|----------|-------|
| Hipervisor | VMware Workstation Pro 26H1u1 |
| Sistema operativo | Ubuntu Server 24.04.5 LTS |
| Nombre del servidor | `dokploy-sura` |
| Recursos | 2 vCPU · 4 GB RAM · 40 GB de disco |
| Red | Modo puente (adaptador físico Realtek PCIe GbE) |
| IP fija | `192.168.20.86/24` · puerta de enlace `192.168.20.1` |
| Panel de Dokploy | `http://192.168.20.86:3000` (versión v0.31.3) |
| Portal web | `https://sura.192.168.20.86.sslip.io` |

> En los comandos, la IP `192.168.20.86` corresponde a nuestro entorno de pruebas. En otro entorno se reemplaza por la IP del servidor.

---

## 2. Requisitos previos

- Máquina virtual con al menos 2 vCPU, 4 GB de RAM y 40 GB de disco (requisito de la guía del proyecto).
- Red en **modo puente** para que el servidor tenga una IP de la red local.
- Puertos `80`, `443` y `3000` libres en el servidor (los usan Traefik y el panel de Dokploy).
- Acceso a internet para descargar paquetes e imágenes de Docker.

---

## 3. Parte 1 — Creación de la máquina virtual

En VMware se creó la VM `dokploy-sura` con la ISO `ubuntu-24.04.5-live-server-amd64.iso` y los recursos indicados en la tabla del punto 1 (captura `01`).

Durante la instalación se eligieron estas opciones:

| Pantalla del instalador | Opción elegida | Motivo |
|-------------------------|----------------|--------|
| Tipo de instalación | Ubuntu Server (estándar) | Incluye las herramientas básicas de administración |
| Red | DHCP en `ens33` | Se fija la IP después de instalar |
| Almacenamiento | Disco completo, **sin LVM** | Con LVM el instalador solo usa la mitad del disco; Docker necesita el espacio completo para imágenes y volúmenes |
| Perfil | Usuario `derek`, servidor `dokploy-sura` | |
| Ubuntu Pro | Omitido | No es necesario para el proyecto |
| SSH | **OpenSSH Server instalado** | Permite administrar el servidor de forma remota |
| Snaps | Ninguno | Docker lo instala Dokploy |

Capturas `02` a `12`.

---

## 4. Parte 2 — Preparación del servidor

### 4.1 Verificación de la IP y acceso por SSH

```bash
## En el servidor: ver las interfaces de red y la IP asignada
ip a
```

```powershell
## Desde Windows (PowerShell): conexión remota al servidor
ssh derek@192.168.20.86
```

Capturas `13` y `14`.

### 4.2 Actualización del sistema

```bash
## Actualiza la lista de paquetes e instala las actualizaciones
sudo apt update && sudo apt upgrade -y

## Muestra la tabla de rutas para identificar la puerta de enlace (default via)
ip route
```

Captura `15`.

### 4.3 Configuración de IP fija con netplan

Dokploy y los dominios de las aplicaciones apuntan a la IP del servidor, por lo que esta no puede cambiar. Se reemplazó la configuración DHCP por una IP fija.

```bash
## Evita que cloud-init vuelva a escribir la configuración de red en cada arranque
echo "network: {config: disabled}" | sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg

## Respalda la configuración DHCP original
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.bak
```

Contenido de `/etc/netplan/01-ip-fija.yaml` (también en `codigo/dokploy/01-ip-fija.yaml`):

```yaml
network:
  version: 2
  ethernets:
    ens33:
      dhcp4: false
      addresses:
        - 192.168.20.86/24
      routes:
        - to: default
          via: 192.168.20.1
      nameservers:
        addresses: [192.168.20.1, 8.8.8.8, 1.1.1.1]
```

```bash
## Permisos 600: netplan exige que solo root pueda leer el archivo
sudo chmod 600 /etc/netplan/01-ip-fija.yaml

## Aplica la nueva configuración de red
sudo netplan apply

## Verificación: archivo, IP sin "dynamic" y salida a internet
sudo cat /etc/netplan/01-ip-fija.yaml && ip a show ens33 && ping -c 3 google.com
```

**Resultado esperado:** `inet 192.168.20.86/24` con `valid_lft forever` (ya no aparece `dynamic`) y el ping con `3 received, 0% packet loss`. Capturas `16` y `17`.

---

## 5. Parte 3 — Instalación de Dokploy

```bash
## Instala Docker, inicializa Docker Swarm y despliega Dokploy, Traefik, PostgreSQL y Redis internos
## ADVERTISE_ADDR indica la IP por la que Swarm anuncia el nodo
curl -sSL https://dokploy.com/install.sh | sudo ADVERTISE_ADDR=192.168.20.86 sh
```

El script termina con `Congratulations, Dokploy is installed!` (captura `18`). En la captura se difuminó el token de `docker swarm join`, porque permitiría unir otros equipos al clúster.

Luego se abrió `http://192.168.20.86:3000` desde el navegador, se registró la cuenta de administrador y se verificó el acceso al panel (capturas `19` y `20`).

**Componentes que quedan en funcionamiento:**

| Componente | Función |
|------------|---------|
| Docker + Docker Swarm | Ejecuta las aplicaciones como servicios en contenedores |
| Traefik v3 | Proxy inverso: enruta los dominios hacia cada aplicación y gestiona los certificados HTTPS |
| PostgreSQL y Redis internos | Datos y colas del propio Dokploy |
| Panel web (puerto 3000) | Administración de proyectos, aplicaciones, bases de datos y dominios |

---

## 6. Parte 4 — Base de datos PostgreSQL

Desde el panel se creó el proyecto **SURA EPS** y dentro de él el servicio de base de datos:

| Campo | Valor |
|-------|-------|
| Nombre | `sura-db` |
| Motor e imagen | PostgreSQL · `postgres:16` |
| Base de datos | `sura` |
| Usuario | `sura_app` |
| Contraseña | Definida en el panel (no se documenta) |
| Acceso | Solo por la red interna de Docker; no se expone ningún puerto hacia la LAN |

Se presionó **Deploy** y el log terminó con `Deployment completed successfully!` (captura `22`).

Dokploy muestra la **Internal Connection URL**, con el formato `postgresql://sura_app:********@<nombre-interno>:5432/sura`. Esa URL es la que usa la aplicación para conectarse.

---

## 7. Parte 5 — Aplicación web (Portal interno de servicios de TI)

### 7.1 Descripción de la aplicación

Es un portal en **Node.js + Express** (código en `codigo/dokploy/app`) que:

- Muestra el estado del despliegue: contenedor, versión de Node y versión de PostgreSQL.
- Lee de la base de datos las sedes y los servicios de infraestructura del proyecto (NTP, NIS, NFS, CUPS, Samba, Web y BD).
- Permite registrar incidentes de TI y los guarda en PostgreSQL. No pide credenciales ni datos personales.
- Expone `/health` para comprobar la conexión a la base de datos.
- Crea sus tablas y datos de prueba automáticamente al iniciar.
- Muestra una franja que aclara que es un proyecto académico y no un sitio oficial de SURA EPS.

### 7.2 Configuración en Dokploy

Dentro del proyecto **SURA EPS** se creó la aplicación `sura-portal`:

| Campo | Valor |
|-------|-------|
| Provider | Git |
| Repository URL | `https://github.com/optitudes/sura_admin_ti.git` |
| Branch | `main` |
| Build Path | `/codigo/dokploy/app` |
| Build Type | Dockerfile |

Variables de entorno (pestaña *Environment*):

```text
DATABASE_URL=postgresql://sura_app:********@<nombre-interno-de-sura-db>:5432/sura
PORT=3000
```

`Dockerfile` usado:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

Al presionar **Deploy**, Dokploy clonó el repositorio, construyó la imagen (`Docker build completed`, captura `23`) y levantó el contenedor. Los logs confirman la conexión:

```text
Base de datos lista
Portal SURA EPS (académico) escuchando en puerto 3000
```

Captura `24`.

---

## 8. Parte 6 — Dominio y HTTPS

En la pestaña **Domains** de `sura-portal` se agregó el dominio:

| Campo | Valor |
|-------|-------|
| Host | `sura.192.168.20.86.sslip.io` |
| Path | `/` |
| Container Port | `3000` |
| HTTPS | Activado |
| Certificate Provider | None (certificado propio de Traefik) |

**¿Por qué sslip.io?** Es un servicio DNS gratuito que resuelve cualquier nombre con una IP incrustada hacia esa IP. Así, `sura.192.168.20.86.sslip.io` apunta al servidor sin comprar un dominio ni configurar un DNS propio.

**¿Por qué un certificado autofirmado?** El servidor tiene una IP privada, así que Let's Encrypt no puede validarlo desde internet. Traefik genera su propio certificado (`TRAEFIK DEFAULT CERT`, válido por un año). La conexión va cifrada con TLS, pero el navegador muestra "No es seguro" porque el certificado no lo firma una autoridad reconocida. En un entorno de producción con IP pública se cambiaría *Certificate Provider* a **Let's Encrypt**, sin modificar nada más.

Capturas `25` (dominio configurado), `26` (portal abierto por `https://`) y `28` (certificado).

---

## 9. Verificación del funcionamiento

| Prueba | Resultado | Captura |
|--------|-----------|---------|
| Panel de Dokploy accesible en `:3000` | Correcto | `20` |
| Base de datos `sura-db` desplegada | `Deployment completed successfully!` | `22` |
| Construcción de la imagen de la app | `Docker build completed` | `23` |
| Conexión app → PostgreSQL | `Base de datos lista` en los logs | `24` |
| Acceso por dominio con HTTPS | Portal cargado en `https://sura.192.168.20.86.sslip.io` con "Base de datos conectada" | `26` |
| Lectura desde la BD | Tablas de sedes y servicios cargadas desde PostgreSQL | `26` |
| Escritura en la BD | Incidente registrado y listado en la tabla | `27` |
| Certificado TLS | Emitido por `TRAEFIK DEFAULT CERT` | `28` |

También se puede comprobar desde cualquier equipo de la red:

```bash
## -k acepta el certificado autofirmado
curl -k https://sura.192.168.20.86.sslip.io/health
## Respuesta esperada: {"status":"ok","db":"conectada"}
```

---

## 10. Solución de problemas encontrados

| Problema | Causa | Solución |
|----------|-------|----------|
| El instalador mostró `ens33 — autoconfiguration failed` y no obtuvo IP (captura `P1a`) | El puente de VMware estaba en "Automático" y se conectó al adaptador virtual de Hyper-V, no a la tarjeta física | En **Edit → Virtual Network Editor → VMnet0** se cambió *Bridged to* a **Realtek PCIe GbE Family Controller** (captura `P1b`) y se volvió a pedir IP con *Edit IPv4 → Automatic (DHCP)* |
| `cat: /etc/netplan/01-ip-fija.yaml: Permission denied` | El archivo tiene permisos `600` (solo root) | Leerlo con `sudo cat`. Este error confirma que los permisos quedaron correctos |
| En *Domains* aparece en rojo "Domain resolves to 192.168.20.86 but should point to…" | Dokploy compara el dominio con la IP pública del router; el servidor es local y el dominio apunta a propósito a su IP privada | No requiere acción: el portal funciona dentro de la red local (captura `26`). En producción el dominio apuntaría a una IP pública |
| El navegador muestra "No es seguro" | Certificado autofirmado de Traefik (ver punto 8) | Se acepta en *Configuración avanzada → Continuar*. En producción se usaría Let's Encrypt |

---

## 11. Seguridad

- La contraseña del usuario de Ubuntu, la del panel de Dokploy y la de la base de datos son distintas, y no aparecen en este documento ni en las capturas.
- PostgreSQL no publica ningún puerto: solo la aplicación lo alcanza por la red interna de Docker.
- La cadena `DATABASE_URL` se guarda en las variables de entorno de Dokploy, no en el código del repositorio.
- La aplicación usa consultas parametrizadas (protección contra inyección SQL) y escapa el texto que muestra (protección contra XSS).
- El token de unión al Swarm, el correo de la cuenta de administrador y la IP pública del router se difuminaron en las capturas.
- No se actualizó a Ubuntu 26.04: el servidor se mantiene en la versión LTS que pide la guía del proyecto.
