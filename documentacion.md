# Documentación técnica de infraestructura TI — SURA EPS

> **Documentación técnica — Entregable 4 (Semana 4)**  
> **Empresa:** SURA EPS (caso de estudio académico)  
> **Área:** Tecnología de la Información / Infraestructura y Operaciones  
> **Versión:** 1.1 · **Estado:** Vigente

Este documento reúne los procedimientos de instalación, los comandos de verificación, las capturas de pantalla y la solución de problemas de cada servicio desplegado. El análisis de diseño y la tabla de requisitos se encuentran en [`analisis.md`](analisis.md).

---

## 1. Entorno base y convenciones

Cada servicio se implementó en el laboratorio del integrante responsable (justificación en [`analisis.md`](analisis.md), §1.1):

| Servicio | Equipo | Plataforma y sistema | IP | Usuario administrador |
|----------|--------|----------------------|----|-----------------------|
| Dokploy, web y BD | `dokploy-sura` | VMware Workstation Pro 26H1u1 · Ubuntu Server 24.04.5 LTS · 2 vCPU, 4 GB RAM, 40 GB | `192.168.20.86/24` (gateway `192.168.20.1`) | `derek` |
| NTP y NIS | `ProyectoFinal` y `cliente` | VMs Ubuntu Server 22.04 LTS | `192.168.1.200` / `192.168.1.201` (gateway `192.168.1.1`) | `Sara` |
| NFS | `srvarchivos-armenia` y cliente Linux | Debian | `192.168.1.6` (cliente `192.168.1.4`) | — |
| CUPS y Samba | `srv-admin-ti` | UTM (ARM64 sobre Apple Silicon M4) · Ubuntu Server 24.04 LTS · 2 vCPU, 4 GB RAM, 40 GB | `192.168.43.8` | `saraf` |

Todas las máquinas usan red en modo puente (Bridged) e IP fija.

**Convención de placeholders.** Los comandos siguientes son normativos y no deben modificarse. Los marcadores se reemplazan por los valores reales antes de ejecutar: `${ip del servidor nfs}`, `${ip del usuario}`, `${ip del servidor cups}` y `<IP_SERVIDOR>`. Las IP `192.168.20.86` (Dokploy) y `192.168.1.200` / `192.168.1.201` (NTP y NIS) corresponden a los laboratorios de prueba.

**Regla de gobernanza.** Los bloques de código son normativos (tal como aparecen en las guías de `codigo/`); solo se amplía la documentación explicativa a su alrededor.

---

## 2. Infraestructura base: VM, IP fija y Dokploy

Fuente: [`codigo/dokploy/dokploy.md`](codigo/dokploy/dokploy.md).

### 2.1 Creación de la máquina virtual

Se creó la VM `dokploy-sura` con la ISO `ubuntu-24.04.5-live-server-amd64.iso` y 2 vCPU / 4 GB RAM / 40 GB de disco.

| Pantalla del instalador | Opción elegida | Motivo |
|-------------------------|----------------|--------|
| Tipo de instalación | Ubuntu Server (estándar) | Incluye herramientas básicas de administración |
| Red | DHCP en `ens33` | Se fija la IP después de instalar |
| Almacenamiento | Disco completo, **sin LVM** | Con LVM el instalador usa solo la mitad del disco; Docker necesita el espacio completo |
| Perfil | Usuario `derek`, servidor `dokploy-sura` | — |
| Ubuntu Pro | Omitido | No necesario para el proyecto |
| SSH | **OpenSSH Server instalado** | Permite administración remota |
| Snaps | Ninguno | Docker lo instala Dokploy |

![VM dokploy-sura con su hardware](capturas/dokploy/01_vm_dokploy-sura_hardware.png)

![Almacenamiento en disco completo sin LVM](capturas/dokploy/07_almacenamiento_disco_completo_sin_lvm.png)

### 2.2 Verificación de IP y acceso por SSH

```bash
## En el servidor: ver las interfaces de red y la IP asignada
ip a
```

```powershell
## Desde Windows (PowerShell): conexión remota al servidor
ssh derek@192.168.20.86
```

### 2.3 Actualización del sistema

```bash
sudo apt update && sudo apt upgrade -y

## Muestra la tabla de rutas para identificar la puerta de enlace (default via)
ip route
```

### 2.4 Configuración de IP fija con netplan

Dokploy y los dominios apuntan a la IP del servidor, por lo que esta no puede cambiar.

```bash
## Evita que cloud-init vuelva a escribir la red en cada arranque
echo "network: {config: disabled}" | sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg

## Respalda la configuración DHCP original
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.bak
```

Contenido de `/etc/netplan/01-ip-fija.yaml`:

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

**Resultado esperado:** `inet 192.168.20.86/24` con `valid_lft forever` (ya no aparece `dynamic`) y `3 received, 0% packet loss`.

![Configuración de IP fija](capturas/dokploy/16_netplan_ip_fija_configuracion.png)

![Verificación de IP fija y ping](capturas/dokploy/17_verificacion_ip_fija_ping.png)

### 2.5 Instalación de Dokploy

```bash
## Instala Docker, inicializa Swarm y despliega Dokploy, Traefik, PostgreSQL y Redis internos
## ADVERTISE_ADDR indica la IP por la que Swarm anuncia el nodo
curl -sSL https://dokploy.com/install.sh | sudo ADVERTISE_ADDR=192.168.20.86 sh
```

El instalador termina con `Congratulations, Dokploy is installed!`. El token de `docker swarm join` se difuminó en la captura porque permitiría unir otros equipos al clúster.

![Dokploy instalado](capturas/dokploy/18_dokploy_instalado.png)

Luego se abre `http://192.168.20.86:3000`, se registra la cuenta de administrador y se verifica el acceso al panel.

![Panel de Dokploy proyectos](capturas/dokploy/20_dokploy_panel_projects.png)

**Componentes en funcionamiento:**

| Componente | Función |
|------------|---------|
| Docker + Docker Swarm | Ejecuta las aplicaciones como servicios en contenedores |
| Traefik v3 | Proxy inverso: enruta dominios y gestiona certificados HTTPS |
| PostgreSQL y Redis internos | Datos y colas del propio Dokploy |
| Panel web (puerto 3000) | Administración de proyectos, aplicaciones, bases de datos y dominios |

### 2.6 Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `ens33 — autoconfiguration failed`, sin IP (captura P1a) | El puente de VMware estaba en "Automático" y se conectó al adaptador virtual de Hyper-V, no a la tarjeta física | En **Edit → Virtual Network Editor → VMnet0** cambiar *Bridged to* a **Realtek PCIe GbE Family Controller** (captura P1b) y volver a pedir IP con *Edit IPv4 → Automatic (DHCP)* |
| `cat: /etc/netplan/01-ip-fija.yaml: Permission denied` | El archivo tiene permisos `600` (solo root) | Leerlo con `sudo cat`. Este error confirma que los permisos quedaron correctos |
| En *Domains* aparece en rojo "Domain resolves to 192.168.20.86 but should point to…" | Dokploy compara el dominio con la IP pública del router; el servidor es local y el dominio apunta a propósito a su IP privada | No requiere acción: el portal funciona en la LAN. En producción el dominio apuntaría a una IP pública |
| El navegador muestra "No es seguro" | Certificado autofirmado de Traefik (ver §4.3) | Aceptar en *Configuración avanzada → Continuar*. En producción se usaría Let's Encrypt |

![Error de red autoconfiguration failed](capturas/dokploy/P1a_red_autoconfiguration_failed.png)

![VMnet0 puenteado a la tarjeta Realtek](capturas/dokploy/P1b_vmnet0_puente_realtek.png)

---

## 3. Base de datos PostgreSQL

Fuente: [`codigo/dokploy/dokploy.md`](codigo/dokploy/dokploy.md), parte 4.

Desde el panel se creó el proyecto **SURA EPS** y, dentro de él, el servicio de base de datos:

| Campo | Valor |
|-------|-------|
| Nombre | `sura-db` |
| Motor e imagen | PostgreSQL · `postgres:16` |
| Base de datos | `sura` |
| Usuario | `sura_app` |
| Contraseña | Definida en el panel (no se documenta) |
| Acceso | Solo por la red interna de Docker; ningún puerto expuesto hacia la LAN |

Se presionó **Deploy** y el log terminó con `Deployment completed successfully!`. Dokploy muestra la *Internal Connection URL* con el formato `postgresql://sura_app:********@<nombre-interno>:5432/sura`, que es la que usa la aplicación.

![PostgreSQL sura-db desplegado](capturas/dokploy/22_postgres_sura-db_desplegado.png)

**Verificación:** el endpoint `/health` del portal devuelve `{"status":"ok","db":"conectada"}`.

---

## 4. Servicio Web y HTTPS

Fuente: [`codigo/dokploy/dokploy.md`](codigo/dokploy/dokploy.md), partes 5 y 6; [`codigo/dokploy/app/README.md`](codigo/dokploy/app/README.md).

### 4.1 Aplicación `sura-portal`

Portal en **Node.js + Express** que muestra el estado del despliegue, lee sedes y servicios desde PostgreSQL, registra incidentes de TI y expone `/health`. Crea sus tablas y datos de prueba automáticamente al iniciar.

| Ruta | Descripción |
|------|-------------|
| `/` | Portal web |
| `/health` | Estado de la app y de la conexión a la BD |
| `/api/estado` | Contenedor, versión de Node y de PostgreSQL |
| `/api/sedes`, `/api/servicios` | Datos de ejemplo en PostgreSQL |
| `GET/POST /api/incidentes` | Registro de incidentes (sin datos personales) |

Configuración en Dokploy:

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

Al presionar **Deploy**, Dokploy clonó el repositorio, construyó la imagen y levantó el contenedor. Los logs confirman:

```text
Base de datos lista
Portal SURA EPS (académico) escuchando en puerto 3000
```

![Build de la app exitoso](capturas/dokploy/23_build_app_sura-portal_exitoso.png)

![Logs de conexión a la base de datos](capturas/dokploy/24_logs_app_conectada_bd.png)

### 4.2 Dominio y certificado

En la pestaña **Domains** de `sura-portal`:

| Campo | Valor |
|-------|-------|
| Host | `sura.192.168.20.86.sslip.io` |
| Path | `/` |
| Container Port | `3000` |
| HTTPS | Activado |
| Certificate Provider | None (certificado propio de Traefik) |

**¿Por qué sslip.io?** Servicio DNS gratuito que resuelve cualquier nombre con una IP incrustada hacia esa IP, sin comprar un dominio ni configurar un DNS propio.

**¿Por qué autofirmado?** El servidor tiene IP privada, así que Let's Encrypt no puede validarlo desde internet. Traefik genera su propio certificado (*TRAEFIK DEFAULT CERT*, válido por un año). La conexión va cifrada con TLS, pero el navegador muestra "No es seguro". En producción con IP pública se cambiaría *Certificate Provider* a **Let's Encrypt** sin modificar nada más.

![Dominio HTTPS configurado](capturas/dokploy/25_dominio_https_sslip.png)

![Portal por HTTPS con base de datos conectada](capturas/dokploy/26_portal_https_bd_conectada.png)

![Certificado autofirmado de Traefik](capturas/dokploy/28_certificado_traefik_autofirmado.png)

### 4.3 Verificación del servicio Web

| Prueba | Resultado | Captura |
|--------|-----------|---------|
| Panel de Dokploy accesible en `:3000` | Correcto | `20_dokploy_panel_projects.png` |
| Base de datos `sura-db` desplegada | `Deployment completed successfully!` | `22_postgres_sura-db_desplegado.png` |
| Construcción de imagen | `Docker build completed` | `23_build_app_sura-portal_exitoso.png` |
| Conexión app → PostgreSQL | `Base de datos lista` en logs | `24_logs_app_conectada_bd.png` |
| Acceso por dominio con HTTPS | Portal cargado con "Base de datos conectada" | `26_portal_https_bd_conectada.png` |
| Lectura desde BD | Tablas de sedes y servicios cargadas | `26_portal_https_bd_conectada.png` |
| Escritura en BD | Incidente registrado y listado | `27_registro_incidente_escritura_bd.png` |
| Certificado TLS | Emitido por `TRAEFIK DEFAULT CERT` | `28_certificado_traefik_autofirmado.png` |

```bash
## -k acepta el certificado autofirmado
curl -k https://sura.192.168.20.86.sslip.io/health
## Respuesta esperada: {"status":"ok","db":"conectada"}
```

---

## 5. NFS — volúmenes compartidos

Fuente: [`codigo/nfs/nfs.md`](codigo/nfs/nfs.md).

### 5.1 Instalación y configuración del servidor

```bash
## Actualiza la lista de paquetes desde los repositorios de Debian
sudo apt update

## Instala el servidor NFS del kernel
sudo apt install -y nfs-kernel-server

## Crea los grupos con GID fijo
sudo groupadd -g 2001 grp_afiliaciones
sudo groupadd -g 2002 grp_autorizaciones

## Crea los usuarios con UID fijo
sudo useradd -m -u 2001 -g grp_afiliaciones -c "Atencion al Afiliado" atencion.afiliado
sudo useradd -m -u 2002 -g grp_autorizaciones -c "Autorizaciones y Servicios Medicos" autorizaciones

## Crea las carpetas que se van a compartir
sudo mkdir -p /srv/nfs/afiliaciones /srv/nfs/autorizaciones

## Asigna dueño y grupo a cada carpeta
sudo chown atencion.afiliado:grp_afiliaciones /srv/nfs/afiliaciones
sudo chown autorizaciones:grp_autorizaciones /srv/nfs/autorizaciones

## Permisos 770: solo dueño y grupo acceden
sudo chmod 770 /srv/nfs/afiliaciones /srv/nfs/autorizaciones

## Verifica dueños y permisos
ls -ld /srv/nfs/afiliaciones /srv/nfs/autorizaciones
```

Contenido de `/etc/exports` (reemplazar `${ip del usuario}` por la IP real del cliente):

```text
## Configuracion del /etc/exports
/srv/nfs/afiliaciones     ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
/srv/nfs/autorizaciones   ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
```

| Opción | Significado |
|--------|-------------|
| `rw` | Lectura y escritura habilitadas |
| `sync` | Confirma escritura en disco antes de responder (integridad) |
| `no_subtree_check` | Evita problemas al renombrar o mover archivos en el volumen |
| `root_squash` | Mapea `root` remoto a `nobody`/`nogroup` por seguridad |

```bash
## Aplica la configuración de exportaciones
sudo exportfs -ra

## Muestra lo que se está exportando
sudo exportfs -v

## Inicia NFS ahora y en cada arranque
sudo systemctl enable --now nfs-server

## Verifica que el servicio está activo
sudo systemctl status nfs-server
```

### 5.2 Configuración del cliente

```bash
## Instala el cliente NFS
sudo apt update && sudo apt install -y nfs-common

## Crea el mismo grupo y usuario (mismo GID/UID que en el servidor)
sudo groupadd -g 2001 grp_afiliaciones
sudo useradd -m -u 2001 -g grp_afiliaciones -c "Atencion al Afiliado" atencion.afiliado

## Crea el punto de montaje
sudo mkdir -p /mnt/afiliaciones

## Prueba de conectividad con el servidor
ping -c 3 ${ip del servidor nfs}

## Monta la carpeta del servidor usando su IP
sudo mount -t nfs4 ${ip del servidor nfs}:/srv/nfs/afiliaciones /mnt/afiliaciones

## Prueba de escritura como el usuario del rol
sudo -u atencion.afiliado touch /mnt/afiliaciones/prueba.txt
ls -l /mnt/afiliaciones/prueba.txt
```

> Repetir el procedimiento con GID/UID `2002` y el usuario `autorizaciones` para el otro volumen.

**Montaje usado en la evidencia.** En la prueba (cliente `192.168.1.4`, servidor `192.168.1.6`) el volumen se montó con NFSv3, mostrando el detalle de la negociación con `-v` (captura `03`):

```bash
sudo mount -v -t nfs -o vers=3,noresvport,retry=0 192.168.1.6:/srv/nfs/afiliaciones /mnt/afiliaciones
sudo -u atencion.afiliado touch /mnt/afiliaciones/nueva_afiliacion.txt
```

El archivo creado desde el cliente aparece en `/srv/nfs/afiliaciones` del servidor (captura `05`).

Montaje permanente en `/etc/fstab` (reemplazar `192.168.1.6` por la IP real):

```text
192.168.1.6:/srv/nfs/afiliaciones  /mnt/afiliaciones  nfs4  defaults,_netdev,x-systemd.automount,noatime  0  0
```

| Opción | Significado |
|--------|-------------|
| `_netdev` | El FS depende de la red; se monta tras la disponibilidad de red |
| `x-systemd.automount` | Monta bajo demanda al acceder, evitando demoras en el arranque |
| `noatime` | No actualiza la hora de último acceso (rendimiento) |
| `0 0` | Sin volcado (`dump`) ni chequeo (`fsck`) |

```bash
sudo systemctl daemon-reload
sudo mount -a
```

### 5.3 Comandos de verificación

```bash
## Desde el cliente
df -h | grep nfs4
mount | grep nfs4
showmount -e ${ip del servidor nfs}

## Desde el servidor
sudo exportfs -v
sudo systemctl status nfs-server
```

### 5.4 Solución de problemas

| Problema | Posible causa | Acción recomendada |
|----------|---------------|--------------------|
| `Permission denied` al montar | IP no autorizada en `/etc/exports` o falta `exportfs -ra` | Revisar `/etc/exports`, ejecutar `sudo exportfs -ra` y verificar con `sudo exportfs -v` |
| `Permission denied` al escribir | UID/GID no coinciden o permisos `770` restrictivos | Confirmar mismo UID/GID en cliente y servidor y `chmod 770` |
| Montaje colgado | Servidor no responde o falta `_netdev` | Agregar `_netdev` y `x-systemd.automount`; revisar con `ping` |
| Archivos como `nobody:nogroup` | `root_squash` activo o UID/GID no coinciden | Ajustar UID/GID; `no_root_squash` solo con aprobación de seguridad |
| `mount.nfs: Connection timed out` | Firewall bloqueando 2049 o servidor apagado | Verificar `ping`, estado de `nfs-server` y firewall |
| El log de `nfs-server` muestra `exportfs: can't open /etc/exports for reading` (captura `02`) | El servicio arrancó antes de crear `/etc/exports` | Crear el archivo y ejecutar `sudo exportfs -ra`; `sudo exportfs -v` debe listar los dos volúmenes (captura `01`) |

### 5.5 Evidencias

![Exportaciones NFS activas](capturas/nfs/01_montajes_exportados_nfs.png)

![Servicio NFS funcionando en el servidor](capturas/nfs/02_servicio_nfs_funcionando_lado_servidor.png)

![Montaje NFS en el cliente](capturas/nfs/03_montaje_nfs_cliente.jpeg)

![Creación de documento en el cliente NFS](capturas/nfs/04_creacion_documento_nfs_cliente.jpeg)

![Validación del archivo desde el servidor NFS](capturas/nfs/05_validacion_archivo_afiliado_servidor_nfs.png)

---

## 6. CUPS — servidor de impresión

Fuente: [`codigo/cups/cups.md`](codigo/cups/cups.md).

### 6.1 Instalación y configuración del servidor

```bash
## Habilita el repositorio universe y actualiza la lista de paquetes
sudo add-apt-repository universe -y
sudo apt update

## Instala el demonio CUPS y el controlador virtual PDF
sudo apt install -y cups printer-driver-cups-pdf

## Agrega el usuario administrador al grupo lpadmin
sudo usermod -aG lpadmin saraf
```

Accesso remoto en `/etc/cups/cupsd.conf`:

```bash
## Respalda la configuración original de CUPS
sudo cp /etc/cups/cupsd.conf /etc/cups/cupsd.conf.bak

## Permite acceso remoto, administración externa y compartición de impresoras
sudo cupsctl --remote-admin --remote-any --share-printers

## Agrega ServerAlias * para permitir peticiones HTTP/HTTPS por dirección IP
sudo sed -i '/^Port 631/a ServerAlias *' /etc/cups/cupsd.conf
```

Directivas clave: `Port 631` / `Listen 0.0.0.0:631` (escucha en todas las interfaces), `ServerAlias *` (evita el bloqueo por cabecera Host en CUPS 2.4+) y `Allow all` / `Allow @LOCAL` en `<Location />`, `<Location /admin>` y `<Location /admin/conf>`.

```bash
## Inicia CUPS ahora y lo habilita en cada arranque del sistema
sudo systemctl enable --now cups
sudo systemctl restart cups

## Verifica que el servicio CUPS está activo
sudo systemctl status cups
```

**Alta de la impresora (consola web):**

1. Acceder a `https://${ip del servidor cups}:631/admin` y aceptar el certificado autofirmado; iniciar sesión con `saraf`.
2. **Add Printer** → elegir **CUPS-PDF (Virtual PDF Printer)** → **Continue**.
3. Nombre `Impresora_SURA`, marcar **Share This Printer** y continuar.
4. Marca **Generic**, modelo **Generic CUPS-PDF Printer (w/ options)** → **Add Printer**.

### 6.2 Vinculación desde el cliente

```bash
## Prueba de conectividad ICMP hacia el servidor CUPS
ping -c 3 ${ip del servidor cups}

## Verifica que el puerto 631 (IPP/HTTPS) esté abierto
nc -zv ${ip del servidor cups} 631
```

Criterios: `ping` con 0% de pérdida y `Connection to ${ip del servidor cups} port 631 [tcp/ipp] succeeded!`.

**macOS:** habilitar *Red local* en *Ajustes del Sistema → Privacidad y seguridad*, luego *Impresoras y escáneres → Agregar impresora* y seleccionar `Impresora_SURA` detectada por Bonjour/IPP (o por IP con protocolo IPP y cola `printers/Impresora_SURA`).

**Prueba de impresión:** abrir un documento, `Cmd + P`, seleccionar `Impresora_SURA` y verificar el PDF generado en `~/PDF/` del servidor.

### 6.3 Verificación

```bash
## Estado de la impresora y impresora por defecto
lpstat -p -d

## Estado de la cola activa
lpq -a

## PDFs generados por la cola
ls -la ~/PDF/
```

También se puede revisar `https://${ip del servidor cups}:631/jobs?which_jobs=completed`: los trabajos deben aparecer como `completed`. En la evidencia, `Impresora_SURA-1` e `Impresora_SURA-2` figuran como completados (captura `02`).

### 6.4 Solución de problemas

| Problema | Posible causa | Acción recomendada |
|----------|---------------|--------------------|
| `Package 'cups-pdf' has no installation candidate` | Paquete renombrado en 24.04 o `universe` deshabilitado | `sudo add-apt-repository universe -y && sudo apt update` e instalar `printer-driver-cups-pdf` |
| `403 Forbidden` en `/admin` | Validación estricta de cabecera Host en CUPS 2.4+ | Agregar `ServerAlias *` bajo `Port 631` y `sudo systemctl restart cups` |
| `ERR_ADDRESS_UNREACHABLE` desde macOS | Permiso de Red local desactivado o AP Isolation | Activar Red local y validar con `ping` |
| Trabajos en `stopped` o `held` | PPD incompatible o impresora pausada | Usar *Generic CUPS-PDF Printer (w/ options)* y `sudo cupsenable Impresora_SURA` |
| `ls -la ~/PDF/` responde `No such file or directory` (captura `03`) | Los trabajos llegan desde macOS con usuario "Retenido" (no existe en el servidor) y CUPS-PDF los guarda como anónimos | Buscar los PDF en la carpeta de trabajos anónimos definida en `/etc/cups/cups-pdf.conf` (directiva `AnonDirName`, por defecto `/var/spool/cups-pdf/ANONYMOUS`) |

### 6.5 Evidencias

![Impresora SURA activa](capturas/cups/01_cups_impresora_activa.png)

![Trabajo de impresión completado](capturas/cups/02_cups_trabajo_completado.png)

![Terminal del servidor CUPS](capturas/cups/03_cups_terminal_servidor.png)

![Configuración final de CUPS](<capturas/cups/04_ cups_configuracion_final.png>)

---

## 7. Samba — compartición multiplataforma

Fuente: [`codigo/samba/samba.md`](codigo/samba/samba.md).

### 7.1 Instalación, usuarios y permisos

```bash
sudo apt update && sudo apt install samba smbclient -y

sudo groupadd sambausers
sudo usermod -aG sambausers saraf

sudo mkdir -p /srv/samba/sura

sudo chown -R root:sambausers /srv/samba/sura
sudo chmod -R 2775 /srv/samba/sura
```

El modo **2775** aplica el bit SGID: todos los archivos y subdirectorios creados heredan el grupo `sambausers`, preservando la consistencia de permisos sin intervención manual.

### 7.2 Credenciales SMB

Samba no consulta `/etc/shadow`, sino su base cifrada `passdb.tdb`:

```bash
sudo smbpasswd -a saraf
sudo smbpasswd -e saraf
```

### 7.3 Configuración del recurso compartido

```bash
sudo cp /etc/samba/smb.conf /etc/samba/smb.conf.bak
```

Agregar al final de `/etc/samba/smb.conf`:

```ini
[sura]
   comment = Carpeta Compartida Sura
   path = /srv/samba/sura
   browseable = yes
   writable = yes
   guest ok = no
   valid users = @sambausers
   create mask = 0664
   directory mask = 0775
```

```bash
testparm -s
sudo systemctl enable --now smbd nmbd
sudo systemctl restart smbd nmbd
```

### 7.4 Verificación y pruebas

```bash
## Estado de los demonios SMB y NMB
sudo systemctl status smbd nmbd

## Validación sintáctica
testparm -s

## Conexión local por CLI
smbclient //localhost/sura -U saraf
```

Criterios: `smbd` en `active (running)`; `testparm -s` carga sin errores las directivas globales y la sección `[sura]`; `smbclient` muestra el prompt `smb: \>`. `nmbd` solo se usa para el descubrimiento por nombres NetBIOS: en la evidencia aparece omitido (ver §7.5) y el acceso por `smb://IP/sura` funciona igual.

**Desde macOS (Finder):**

1. `Cmd + K` para abrir *Conectarse al servidor*.
2. URI: `smb://<IP_SERVIDOR>/sura`.
3. Autenticarse con *Usuario registrado* y las credenciales de `saraf`.
4. Crear carpetas y archivos; verificar en el servidor los permisos `0664` y `0775`.

### 7.5 Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `Access Denied` con usuario existente en el SO | Samba usa `passdb.tdb`, no `/etc/shadow` | `sudo smbpasswd -a saraf` y `sudo smbpasswd -e saraf` |
| `ERR_ADDRESS_UNREACHABLE` desde macOS (timeout al mapear) | Permisos de Red local o tethering móvil sin enrutamiento | Activar Red local, `ping <IP_SERVIDOR>` y `nc -zv <IP_SERVIDOR> 445` |
| `nmbd.service` aparece `inactive (dead)` con `start condition unmet` (captura `03`) | El script de Ubuntu `/usr/share/samba/is-configured nmb` indicó que NetBIOS no está configurado y systemd omitió `nmbd` | No afecta el recurso: los clientes se conectan por IP al puerto 445 (`smbd`). Solo se necesitaría `nmbd` para ver el servidor por nombre NetBIOS en el "Entorno de red" de Windows |

### 7.6 Evidencias

![Finder de macOS conectado a smb://<IP_SERVIDOR>/sura](capturas/samba/01_samba_finder_mac.png)

![Permisos del directorio en el servidor](capturas/samba/02_samba_permisos_servidor.png)

![Servicios smbd y nmbd activos](capturas/samba/03_samba_servicios_activos.png)

![Configuración final de Samba](capturas/samba/04_samba_configuracion_final.png)

---

## 8. NTP — sincronización horaria

Fuentes: [`codigo/Ntp/ntp.md`](codigo/Ntp/ntp.md) y [`codigo/red/red.md`](codigo/red/red.md).

| Elemento | Valor |
|----------|-------|
| Servidor | `ProyectoFinal` · `192.168.1.200` (`proyectofinal.empresa.local`) |
| Cliente | `cliente` · `192.168.1.201` (clon del servidor) |
| Software | chrony |
| Puerto | `123/UDP` |
| Zona horaria | `America/Bogota` |

### 8.1 Red de las VMs

Ambas VMs usan IP fija en `/etc/netplan/50-cloud-init.yaml` (interfaz `enp0s3`, gateway `192.168.1.1`, DNS `8.8.8.8` y `1.1.1.1`) y el servidor se registra en `/etc/hosts`:

```text
192.168.1.200   proyectofinal.empresa.local   proyectofinal
```

```bash
## Aplica la red y verifica dirección, gateway y salida a internet
sudo netplan apply
ip -br a
ping -c 3 192.168.1.1
ping -c 3 pool.ntp.org
```

![netplan con IP fija](<capturas/ntp/Configuración/1. netplan.png>)

![/etc/hosts del servidor](<capturas/ntp/Configuración/2. hosts.png>)

![Verificación de direcciones y conectividad](<capturas/ntp/Configuración/3. Verificar direcciones.png>)

### 8.2 Instalación y configuración del servidor

```bash
## Zona horaria
sudo timedatectl set-timezone America/Bogota
timedatectl

## Instala chrony y desactiva systemd-timesyncd (queda "masked": es lo esperado)
sudo apt update
sudo apt install chrony -y
sudo systemctl disable --now systemd-timesyncd
```

![Zona horaria](<capturas/ntp/Servidor/1. Zona horaria.png>)

![systemd-timesyncd enmascarado](<capturas/ntp/Servidor/3. Quitar Tiempo Cliente.png>)

Líneas agregadas al final de `/etc/chrony/chrony.conf` (archivo de referencia: [`codigo/Ntp/chrony-servidor.conf`](codigo/Ntp/chrony-servidor.conf)):

```conf
# Fuente adicional
pool pool.ntp.org iburst

# Permitir que la red local use este servidor
allow 192.168.1.0/24

# Seguir sirviendo hora si se pierde internet
local stratum 10
```

| Directiva | Función |
|-----------|---------|
| `pool` | Fuente externa adicional de tiempo |
| `allow` | Autoriza a la red `192.168.1.0/24` a consultar el servidor |
| `local stratum 10` | Sigue entregando hora aunque se pierda internet |

![Configuración de chrony](<capturas/ntp/Servidor/4. Configurar chrony.png>)

```bash
## Reinicia, habilita y verifica el servicio
sudo systemctl restart chrony
sudo systemctl enable chrony
systemctl status chrony

## Firewall: UFW inactivo, no bloquea 123/udp (si se activa: sudo ufw allow 123/udp)
sudo ufw status
```

![chrony activo](<capturas/ntp/Servidor/5. Reiniciar y activar.png>)

![Estado de UFW](<capturas/ntp/Servidor/6. Firewall.png>)

### 8.3 Configuración del cliente

El cliente es un clon del servidor, así que se dejan comentadas las líneas `pool`, `allow` y `local` y se usa el servidor como única fuente (archivo de referencia: [`codigo/Ntp/chrony-cliente.conf`](codigo/Ntp/chrony-cliente.conf)):

```bash
sudo cp /etc/chrony/chrony.conf /etc/chrony/chrony.conf.bak
sudo sed -i -E 's/^(pool|allow|local)/#\1/' /etc/chrony/chrony.conf
echo "server 192.168.1.200 iburst" | sudo tee -a /etc/chrony/chrony.conf
grep -E "^(server|pool|allow|local)" /etc/chrony/chrony.conf
sudo systemctl restart chrony
```

Cliente Windows (opcional):

```text
w32tm /config /manualpeerlist:"192.168.1.200" /syncfromflags:manual /update
w32tm /resync
w32tm /query /status
```

### 8.4 Comandos de verificación y pruebas

```bash
## Servidor
chronyc sources -v
chronyc tracking
timedatectl
sudo ss -ulnp | grep 123
sudo chronyc clients

## Cliente
chronyc sources -v
chronyc tracking

## Prueba de desajuste en el cliente
sudo systemctl stop chrony
sudo date -s "2026-01-01 10:00:00"
sudo systemctl start chrony
sudo chronyc makestep
sleep 3
date
```

| Prueba | Resultado | Captura |
|--------|-----------|---------|
| Fuentes del servidor | Varias fuentes públicas; `^*` en `0.co.ntp.edgeuno.com`, `Leap status: Normal` | `Servidor/7. Verificar.png` |
| Hora y puerto del servidor | `System clock synchronized: yes`, `NTP service: active`, `chronyd` en `0.0.0.0:123` | `Servidor/8. Verificar.png` |
| Cliente sincronizado | Única fuente `^* proyectofinal.empresa.local`, `Reference ID C0A801C8` (= `192.168.1.200`), estrato 3 | `Cliente/1. Reiniciar chrony.png` |
| Prueba de desajuste | La fecha pasa de `Thu Jan 1 2026` a la hora real `Wed Nov 18 2026` | `Cliente/2. Cambiar fecha y hora.png` |

![chronyc sources y tracking en el servidor](<capturas/ntp/Servidor/7. Verificar.png>)

![timedatectl y puerto 123](<capturas/ntp/Servidor/8. Verificar.png>)

![Cliente sincronizado con el servidor](<capturas/ntp/Cliente/1. Reiniciar chrony.png>)

![Prueba de desajuste de hora](<capturas/ntp/Cliente/2. Cambiar fecha y hora.png>)

### 8.5 Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `Unit systemd-timesyncd.service is masked, ignoring` | chrony reemplaza a `systemd-timesyncd` al instalarse | No requiere acción |
| `chronyc sources` muestra `^?` los primeros segundos | La fuente aún no responde | Esperar 10–30 s y repetir |
| El cliente no ve al servidor | Falta `allow`, firewall o error de red | Revisar `allow 192.168.1.0/24`, `ufw status` y `ping 192.168.1.200` |
| El cliente (clon) tenía la configuración del servidor | El clon heredó `pool`, `allow` y `local stratum` | Comentarlas con `sed` y dejar solo `server 192.168.1.200 iburst` |
| Diferencia de hora grande | chrony no corrige saltos grandes de inmediato | `sudo chronyc makestep` |
| `Destination Host Unreachable` al probar el cliente | El servidor estaba apagado | Encender el servidor y repetir |

---

## 9. NIS — autenticación centralizada

Fuente: [`codigo/Nis/nis.md`](codigo/Nis/nis.md).

| Elemento | Valor |
|----------|-------|
| Servidor maestro | `ProyectoFinal` · `192.168.1.200` |
| Cliente | `cliente` · `192.168.1.201` |
| Dominio NIS | `empresa.local` |
| Usuarios de prueba | `usuario1` (UID 1001) y `usuario2` (UID 1002) |
| Puertos | `111` (rpcbind) y puertos dinámicos de `ypserv`, `ypbind`, `yppasswdd` y `ypxfrd` |

> **Seguridad:** NIS transmite la información de cuentas (incluidos los hashes) sin cifrar. Se usa solo en la red local y se restringe con `ypserv.securenets`. Los hashes están ocultos en las capturas. Alternativas más seguras: LDAP o FreeIPA.

### 9.1 Instalación y configuración del servidor

```bash
## 1. El nombre del servidor debe resolverse (ypinit falla si no)
grep proyectofinal /etc/hosts
ping -c 1 proyectofinal

## 2. Instala NIS (dominio: empresa.local) y guarda el dominio
sudo apt update
sudo apt install nis -y
echo "empresa.local" | sudo tee /etc/defaultdomain

## 3. Servidor maestro
sudo sed -i 's/^NISSERVER=.*/NISSERVER=master/' /etc/default/nis
grep NISSERVER /etc/default/nis
```

![Resolución del nombre del servidor](<capturas/nis/Servidor/1. Comprobar nombre del servidor.png>)

![Instalación de NIS](<capturas/nis/Servidor/2. Instalar NIS.png>)

![Dominio NIS guardado](<capturas/nis/Servidor/2.1. Instalar NIS.png>)

![NISSERVER=master](<capturas/nis/Servidor/3. Configurar el servidor como maestro.png>)

```bash
## 4. Solo el propio equipo y la red local pueden consultar el servidor
sudo tee /etc/ypserv.securenets > /dev/null <<'EOF'
255.0.0.0       127.0.0.0
255.255.255.0   192.168.1.0
EOF

## 5. El servidor se consulta a sí mismo
echo "ypserver 127.0.0.1" | sudo tee -a /etc/yp.conf

## 6. Publicar solo UID/GID >= 1001 y distribuir contraseñas y grupos
sudo sed -i -E 's/^MINUID=.*/MINUID=1001/; s/^MINGID=.*/MINGID=1001/' /var/yp/Makefile
sudo sed -i -E 's/^MERGE_PASSWD=.*/MERGE_PASSWD=true/; s/^MERGE_GROUP=.*/MERGE_GROUP=true/' /var/yp/Makefile
grep -E "^(MINUID|MINGID|MERGE_PASSWD|MERGE_GROUP)" /var/yp/Makefile
```

![ypserv.securenets](<capturas/nis/Servidor/4. Restringe el acceso a la red.png>)

![yp.conf del servidor](<capturas/nis/Servidor/5. Indicar al servidor autoconsulta.png>)

![Makefile de NIS](<capturas/nis/Servidor/6. Ajustar los usuarios.png>)

```bash
## 7. Usuarios de prueba (antes de generar los mapas)
sudo adduser --gecos "" usuario1
sudo adduser --gecos "" usuario2
id usuario1

## 8. Inicializa la base NIS (Ctrl+D y "y" al pedir otros servidores)
sudo domainname empresa.local
sudo /usr/lib/yp/ypinit -m

## 9. Inicia y habilita los servicios y regenera los mapas
sudo systemctl restart rpcbind ypserv yppasswdd ypxfrd ypbind
sudo systemctl enable rpcbind ypserv yppasswdd ypxfrd ypbind
sudo make -C /var/yp
```

![Usuarios de prueba](<capturas/nis/Servidor/7. Creaar los usuarios.png>)

![ypinit](<capturas/nis/Servidor/8. Inicializa la base NIS.png>)

![Servicios NIS](<capturas/nis/Servidor/9. Iniciar los servicios.png>)

> Cada vez que se crea, modifica o elimina un usuario hay que ejecutar `sudo make -C /var/yp` **en el servidor**.

### 9.2 Configuración del cliente

Resumen de archivos: [`codigo/Nis/cliente-nis.conf`](codigo/Nis/cliente-nis.conf).

```bash
## 1. Instala NIS (dominio: empresa.local) y fija el dominio
sudo apt update
sudo apt install nis -y
echo "empresa.local" | sudo tee /etc/defaultdomain
sudo domainname empresa.local

## 2. Indica el servidor NIS
echo "domain empresa.local server 192.168.1.200" | sudo tee -a /etc/yp.conf

## 3. Consulta NIS para usuarios y grupos
sudo sed -i -E '/^(passwd|group|shadow):/ s/$/ nis/' /etc/nsswitch.conf

## 4. Crea el directorio personal en el primer inicio de sesión
echo "session optional pam_mkhomedir.so skel=/etc/skel umask=077" | sudo tee -a /etc/pam.d/common-session

## 5. Inicia el servicio
sudo systemctl restart rpcbind ypbind
sudo systemctl enable ypbind
```

![Instalación de NIS en el cliente](<capturas/nis/Cliente/1. Instalar NIS.png>)

![Dominio en el cliente](<capturas/nis/Cliente/2. Fijar el dominio.png>)

![yp.conf del cliente](<capturas/nis/Cliente/3. Indicar el servidor NIS.png>)

![nsswitch.conf del cliente](<capturas/nis/Cliente/4. Consultar NIS para usuarios y grupos.png>)

![pam_mkhomedir](<capturas/nis/Cliente/5. Crear directorio.png>)

![ypbind habilitado](<capturas/nis/Cliente/6. Iniciar el servicio.png>)

### 9.3 Comandos de verificación y pruebas

```bash
## Servidor
domainname
rpcinfo -p localhost | grep yp
ypwhich
ypcat passwd

## Cliente
ypwhich
ypcat passwd | cut -d: -f1,3
getent passwd usuario1
su - usuario1

## Pruebas adicionales
ssh usuario2@192.168.1.201     # inicio de sesión remoto con un usuario que solo existe en NIS
yppasswd                       # cambio de contraseña desde el cliente
```

| Prueba | Resultado | Captura |
|--------|-----------|---------|
| Dominio y servicios del servidor | `empresa.local`; `ypserv`, `ypbind`, `yppasswdd` y `ypxfrd` registrados en `rpcinfo` | `Servidor/10. Verificar.png` |
| Mapas del servidor | `ypcat passwd` publica `usuario1` y `usuario2`; la cuenta local `Sara` no se publica | `Servidor/10. Verificar.png` |
| Enlace del cliente | `ypwhich` → `192.168.1.200` | `Cliente/7. Verificar.png` |
| Autenticación centralizada | `getent passwd usuario1` resuelve por NIS (UID 1001) y `su - usuario1` abre sesión y crea `/home/usuario1` | `Cliente/7. Verificar.png` |

![Verificación del servidor NIS](<capturas/nis/Servidor/10. Verificar.png>)

![Verificación e inicio de sesión en el cliente](<capturas/nis/Cliente/7. Verificar.png>)

### 9.4 Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `ypinit`: *The local host's domain name hasn't been set* | `domainname` mostraba `(none)` | `sudo domainname empresa.local` y repetir `ypinit -m` |
| `cat: /etc/defaultdomain: No such file or directory` | La instalación no guardó el dominio | `echo "empresa.local" \| sudo tee /etc/defaultdomain` |
| `MERGE_PASSWD=false` y `MERGE_GROUP=false` | Valores por defecto del `Makefile` | Cambiarlos a `true` y ejecutar `make -C /var/yp` |
| `RPC: Program not registered` durante `ypinit` | `ypserv` aún no estaba iniciado | Iniciar los servicios y ejecutar `sudo make -C /var/yp` |
| `make -C /var/yp` falla en el cliente | Solo el servidor construye los mapas | No ejecutarlo en el cliente |
| La cuenta `Sara` (UID 1000) chocaría con la cuenta local | `MINUID` por defecto es 1000 | `MINUID=1001` y `MINGID=1001` |
| `ypwhich` no responde en el cliente | Dominio distinto, `ypbind` detenido o servidor inaccesible | Revisar `domainname`, `/etc/yp.conf`, `systemctl status ypbind` y `ping 192.168.1.200` |
| El usuario aparece en `ypcat` pero no en `getent passwd` | Falta `nis` en `/etc/nsswitch.conf` | Agregar `nis` a `passwd`, `group` y `shadow` |
| El usuario entra pero no tiene directorio personal | Falta `pam_mkhomedir` | Agregar la línea en `/etc/pam.d/common-session` |
| Un usuario nuevo no aparece en el cliente | No se regeneraron los mapas | `sudo make -C /var/yp` en el servidor |

---

## 10. Matriz de verificación y criterios de éxito

| # | Servicio | Comando / prueba principal | Resultado esperado | Estado |
|---|----------|----------------------------|--------------------|--------|
| 1 | Web | `curl -k https://sura.192.168.20.86.sslip.io/health` | `{"status":"ok","db":"conectada"}` | ✅ |
| 2 | NTP | `chronyc sources -v` en cliente | `^* proyectofinal.empresa.local` (`192.168.1.200`) | ✅ |
| 3 | NFS | `df -h \| grep nfs` en cliente | Volumen `/mnt/afiliaciones` montado y escritura permitida | ✅ |
| 4 | NIS | `ypwhich`, `getent passwd usuario1` y `su - usuario1` en cliente | Usuario de NIS inicia sesión sin cuenta local | ✅ |
| 5 | CUPS | `lpstat -p -d` / `lpq -a` | `Impresora_SURA` activa, trabajos `completed` | ✅ |
| 6 | Samba | `smbclient //localhost/sura -U saraf` | Prompt `smb: \>` y escritura permitida | ✅ |
| 7 | Base de datos | Logs de `sura-portal` | `Base de datos lista` | ✅ |

**Leyenda:** ✅ implementado y verificado con evidencia en `capturas/`.

---

## 11. Anexo — inventario de evidencias

| Servicio | Ruta | Capturas |
|----------|------|----------|
| Dokploy / infraestructura base | `capturas/dokploy/` | `01`–`28` (VM, instalación, IP fija, panel, BD, build, logs, dominio, portal, certificado), `P1a`, `P1b` (problemas) |
| NFS | `capturas/nfs/` | `01` exportaciones, `02` servicio en servidor, `03` montaje en cliente, `04` creación de documento, `05` validación en servidor |
| CUPS | `capturas/cups/` | `01` impresora activa, `02` trabajo completado, `03` terminal del servidor, `04` configuración final |
| Samba | `capturas/samba/` | `01` Finder macOS, `02` permisos, `03` servicios activos, `04` configuración final |
| NTP | `capturas/ntp/` | `Configuración/` (netplan, hosts, verificación de red), `Servidor/` (zona horaria, timesyncd, chrony.conf, servicio, UFW, verificaciones), `Cliente/` (sincronización y prueba de desajuste) |
| NIS | `capturas/nis/` | `Servidor/` `1`–`10` (nombre, instalación, dominio, maestro, securenets, yp.conf, Makefile, usuarios, ypinit, servicios, verificación) y `Cliente/` `1`–`7` (instalación, dominio, yp.conf, nsswitch, mkhomedir, ypbind, verificación e inicio de sesión) |

**Notas de seguridad aplicadas en todo el despliegue:** contraseñas distintas para Ubuntu, panel de Dokploy y base de datos (ninguna aparece en documentos ni capturas); hashes de NIS ocultos en las capturas; PostgreSQL sin puertos expuestos a la LAN; `DATABASE_URL` almacenada solo en variables de entorno; consultas parametrizadas y escapado de HTML en la app; token de Swarm, correo de administrador e IP pública del router difuminados en las capturas.
