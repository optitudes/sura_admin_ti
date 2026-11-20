# Configuración de Volúmenes NFS — SURA EPS

> **Documentación técnica de infraestructura**  
> **Empresa:** SURA EPS  
> **Área:** Tecnología de la Información / Infraestructura y Operaciones  
> **Servicio:** NFS (Network File System) — Volúmenes compartidos de Afiliaciones y Autorizaciones  
> **Versión:** 1.0  
> **Estado:** Vigente  

---

## 1. Propósito y alcance

Este documento estandariza la instalación, configuración y operación de un servidor NFS y sus clientes en el entorno de SURA EPS, permitiendo el acceso compartido y seguro a dos volúmenes de negocio:

| Volumen | Ruta del servidor | Grupo propietario | Usuario asociado | Uso empresarial |
|---------|-------------------|-------------------|------------------|-----------------|
| Afiliaciones | `/srv/nfs/afiliaciones` | `grp_afiliaciones` | `atencion.afiliado` | Atención al Afiliado — gestión de datos de afiliados |
| Autorizaciones | `/srv/nfs/autorizaciones` | `grp_autorizaciones` | `autorizaciones` | Autorizaciones y Servicios Médicos — gestión de autorizaciones de servicios |

Los usuarios y grupos se crean con **UID y GID fijos** para garantizar la coherencia de permisos entre el servidor NFS y las estaciones de cliente de la empresa, evitando desajustes de propiedad de archivos en entornos multiagente.

> **Regla de gobernanza:** Los comandos y bloques de código de este documento son normativos y **no deben modificarse**. Solo se amplía la documentación explicativa a su alrededor. Los marcadores `${...}` son placeholders que deben reemplazarse con los valores reales del entorno de SURA EPS antes de ejecutar.

---

## 2. Roles y responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| Administrador de Infraestructura | Ejecuta la instalación del servidor, configura `/etc/exports`, gestiona servicios y verifica exportaciones. |
| Administrador de Sistemas Cliente | Instala paquetes cliente, crea usuarios/grupos con UID/GID idénticos al servidor, configura montajes persistentes en `/etc/fstab`. |
| Seguridad de la Información | Valida reglas de firewall (puerto 2049), opciones de exportación (`root_squash`) y permisos de directorio (`770`). |
| Mesa de Servicio | Recibe solicitudes de montaje, verificaciones de conectividad y escalamiento de incidentes NFS. |

---

## 3. Requisitos previos

- Dos o más equipos con Debian o derivado (uno designado como servidor NFS, los restantes como clientes de SURA EPS).
- Usuario con privilegios `sudo` o `root` en todos los equipos.
- Conectividad de red IP entre servidor y clientes (se recomienda direccionamiento estático dentro de la red corporativa).
- Puerto `2049` (NFS) habilitado en el firewall entre servidor y clientes.
- Los valores `${ip del usuario}`, `${ip del servidor nfs}` y `192.168.1.6` deben reemplazarse por las IPs reales de la red de SURA EPS.

---

## 4. Parte 1 — Configuración del servidor NFS (Sede corporativa)

En esta sección se prepara el servidor que aloja los volúmenes compartidos de SURA EPS.

### 4.1 Actualización del repositorio de paquetes

```text
## Actualiza la lista de paquetes desde los repositorios de Debian
sudo apt update
```

### 4.2 Instalación del servidor NFS del kernel

```text
## Instala el servidor NFS del kernel (-y responde "sí" automáticamente)
sudo apt install -y nfs-kernel-server
```

### 4.3 Creación de grupos y usuarios corporativos

Se crean los grupos y usuarios con GID/UID fijos para que los permisos coincidan exactamente entre el servidor y los clientes de SURA EPS.

#### Grupos con GID fijo

```text
## Crea los grupos con GID fijo
sudo groupadd -g 2001 grp_afiliaciones
sudo groupadd -g 2002 grp_autorizaciones
```

#### Usuarios con UID fijo

`-m` crea el directorio personal, `-g` asigna el grupo primario y `-c` registra la descripción del rol dentro de la empresa.

```text
## Crea los usuarios con UID fijo (-m crea su home, -g su grupo, -c descripción)
sudo useradd -m -u 2001 -g grp_afiliaciones -c "Atencion al Afiliado" atencion.afiliado
sudo useradd -m -u 2002 -g grp_autorizaciones -c "Autorizaciones y Servicios Medicos" autorizaciones
```

### 4.4 Preparación de los directorios compartidos

```text
## Crea las carpetas que se van a compartir
sudo mkdir -p /srv/nfs/afiliaciones /srv/nfs/autorizaciones
```

### 4.5 Asignación de propietario y grupo

```text
## Asigna dueño y grupo a cada carpeta
sudo chown atencion.afiliado:grp_afiliaciones /srv/nfs/afiliaciones
sudo chown autorizaciones:grp_autorizaciones /srv/nfs/autorizaciones
```

### 4.6 Aplicación de permisos corporativos

Permisos `770`: solo el dueño y el grupo acceden (lectura, escritura y ejecución). Ningún acceso para otros.

```text
## Permisos 770: solo dueño y grupo acceden
sudo chmod 770 /srv/nfs/afiliaciones /srv/nfs/autorizaciones
```

### 4.7 Verificación de dueños y permisos

```text
## Verifica dueños y permisos
ls -ld /srv/nfs/afiliaciones /srv/nfs/autorizaciones
```

### 4.8 Configuración de exportaciones en `/etc/exports`

Define los directorios compartidos, los clientes autorizados y las opciones de exportación. Reemplaza `${ip del usuario}` por la IP real del cliente de SURA EPS (o la red autorizada).

```text
## Configuracion del /etc/exports 
/srv/nfs/afiliaciones     ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
/srv/nfs/autorizaciones   ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
```

Archivo de referencia: [`exports`](exports). En las pruebas el cliente autorizado fue `192.168.1.4` (captura `01`).

**Opciones de exportación aplicadas:**

- `rw`: lectura y escritura habilitadas.
- `sync`: confirma escritura en disco antes de responder al cliente (integridad de datos).
- `no_subtree_check`: desactiva la verificación de subárboles; previene problemas al renombrar o mover archivos dentro del volumen.
- `root_squash`: mapea peticiones de `root` remoto al usuario `nobody`/`nogroup` por seguridad corporativa.

### 4.9 Aplicación de la configuración de exportaciones

```text
## Aplica la configuración de exportaciones
sudo exportfs -ra
```

### 4.10 Visualización de exportaciones activas

```text
## Muestra lo que se está exportando
sudo exportfs -v
```

### 4.11 Inicio del servicio NFS y habilitación al arranque

```text
## Inicia NFS ahora y en cada arranque
sudo systemctl enable --now nfs-server
```

### 4.12 Verificación del estado del servicio

```text
## Verifica que el servicio está activo
sudo systemctl status nfs-server
```

El servicio debe reportar `active (running)`.

---

## 5. Parte 2 — Configuración del cliente NFS (Estaciones de SURA EPS)

En esta sección se prepara cada cliente corporativo para montar los volúmenes de Afiliaciones y Autorizaciones.

### 5.1 Instalación del cliente NFS

```text
## Instala el cliente NFS
sudo apt update && sudo apt install -y nfs-common
```

### 5.2 Creación del grupo y usuario en el cliente

Es obligatorio que el cliente tenga el mismo UID/GID que el servidor para que los archivos mantengan su propietario correcto y no haya conflictos de permisos.

```text
## Crea el mismo grupo y usuario (mismo GID/UID que en el servidor)
sudo groupadd -g 2001 grp_afiliaciones
sudo useradd -m -u 2001 -g grp_afiliaciones -c "Atencion al Afiliado" atencion.afiliado
```

> Si el cliente también accederá al volumen de Autorizaciones, repita el paso con GID/UID `2002` y el usuario `autorizaciones` antes de montar ese recurso.

### 5.3 Creación del punto de montaje

```text
## Crea el punto de montaje
sudo mkdir -p /mnt/afiliaciones
```

### 5.4 Prueba de conectividad con el servidor NFS

Valida que el cliente alcanza al servidor antes de intentar el montaje.

```text
## Prueba de conectividad con el servidor
ping -c 3 ${ip del servidor nfs}
```

### 5.5 Montaje del volumen compartido

Monta el volumen de Afiliaciones usando NFSv4 y la IP del servidor.

```text
## Monta la carpeta del servidor usando su IP
sudo mount -t nfs4 ${ip del servidor nfs}:/srv/nfs/afiliaciones /mnt/afiliaciones
```

### 5.6 Prueba de escritura como usuario del rol

Valida que el usuario corporativo puede escribir en el volumen montado.

```text
## Prueba de escritura como el usuario del rol
sudo -u atencion.afiliado touch /mnt/afiliaciones/prueba.txt
ls -l /mnt/afiliaciones/prueba.txt
```

> Este procedimiento debe repetirse para cada usuario y cada volumen (Afiliaciones y Autorizaciones) que requiera el cliente de SURA EPS.

**Montaje usado en la evidencia.** En la prueba (servidor `srvarchivos-armenia`, `192.168.1.6`) el volumen se montó con NFSv3 y salida detallada (`-v`), y luego se creó un archivo como el usuario del rol (capturas `03` y `04`):

```text
sudo mount -v -t nfs -o vers=3,noresvport,retry=0 192.168.1.6:/srv/nfs/afiliaciones /mnt/afiliaciones
sudo -u atencion.afiliado touch /mnt/afiliaciones/nueva_afiliacion.txt
```

El archivo `nueva_afiliacion.txt` aparece en `/srv/nfs/afiliaciones` del servidor (captura `05`).

### 5.7 Montaje permanente mediante `/etc/fstab`

Para que el montaje sobreviva a reinicios, edite `/etc/fstab` y agregue la entrada correspondiente. Reemplace `192.168.1.6` por la IP real del servidor NFS de SURA EPS.

```text
## Montaje con fstab
Para lograr un montaje permanente se debe editar el documento /etc/fstab
agregando el montaje necesario

192.168.1.6:/srv/nfs/afiliaciones  /mnt/afiliaciones  nfs4  defaults,_netdev,x-systemd.automount,noatime  0  0
```

Archivo de referencia: [`fstab`](fstab).

**Opciones de montaje persistente:**

- `defaults`: opciones por defecto.
- `_netdev`: indica que el sistema de archivos depende de la red; se monta tras la disponibilidad de red.
- `x-systemd.automount`: monta bajo demanda al acceder al punto de montaje, evitando demoras en el arranque si el servidor no responde.
- `noatime`: no actualiza la hora de último acceso al leer archivos (mejora de rendimiento).
- `0 0`: sin volcado (`dump`) y sin chequeo de sistema de archivos (`fsck`).

### 5.8 Recarga de systemd y montaje de sistemas de archivos

```text
una vez modificado ejecutar lo siguiente para recargar y montar

sudo systemctl daemon-reload
sudo mount -a
```

---

## 6. Verificación del funcionamiento

Desde el cliente, confirme que el recurso NFS está montado:

```bash
df -h | grep nfs4
# o
mount | grep nfs4
```

Desde el servidor, confirme los directorios exportados y los clientes autorizados con `sudo exportfs -v` (ya ejecutado en el paso 4.10 del servidor).

Desde el cliente, consulte las exportaciones disponibles del servidor:

```bash
showmount -e ${ip del servidor nfs}
```

---

## 7. Política de seguridad y cumplimiento (SURA EPS)

- **UID/GID consistentes:** Los usuarios que accedan a los volúmenes NFS deben tener el mismo UID y GID en servidor y cliente; de lo contrario, los archivos pueden mostrarse con propietarios numéricos sin nombre o con permisos inesperados.
- **Firewall:** NFS utiliza el puerto `2049` (TCP/UDP). Habilite el tráfico únicamente entre las IPs autorizadas de SURA EPS.
- **root_squash:** Por seguridad, el usuario `root` remoto no tiene privilegios de root sobre los exportados; se le mapea a `nobody`/`nogroup`. El uso de `no_root_squash` queda restringido a entornos de confianza y requiere autorización de Seguridad de la Información.
- **Placeholders:** No ejecute comandos con `${ip del usuario}` ni `${ip del servidor nfs}` literales. Reemplácelos por las IPs reales de la red corporativa antes de ejecutar.
- **Montaje persistente:** Las opciones `_netdev` y `x-systemd.automount` evitan que el arranque del cliente se bloquee si el servidor NFS no está disponible al iniciar.

---

## 8. Solución de problemas comunes

| Problema | Posible causa | Acción recomendada |
|----------|---------------|--------------------|
| `Permission denied` al montar | IP del cliente no autorizada en `/etc/exports` o falta `exportfs -ra` | Revise `/etc/exports`, ejecute `sudo exportfs -ra` y verifique con `sudo exportfs -v`. |
| `Permission denied` al escribir | UID/GID no coinciden o permisos `770` restrictivos | Confirme que el usuario existe con el mismo UID/GID en cliente y servidor y que la carpeta tiene `chmod 770`. |
| Montaje se queda colgado | Servidor no responde o falta `_netdev` en `/etc/fstab` | Agregue `_netdev` y `x-systemd.automount`; revise conectividad con `ping`. |
| Archivos aparecen como `nobody:nogroup` | `root_squash` activo o UID/GID no coinciden | Ajuste UID/GID; evalúe `no_root_squash` solo si es estrictamente necesario y con aprobación de seguridad. |
| `mount.nfs: Connection timed out` | Firewall bloqueando puerto 2049 o servidor apagado | Verifique `ping`, estado de `nfs-server` y reglas de firewall corporativo. |

---

## 9. Soporte y escalamiento

Para incidentes relacionados con los volúmenes NFS de SURA EPS, contacte a la Mesa de Servicio de Tecnología de la Información indicando:

- Equipo afectado y rol (servidor o cliente).
- Volumen involucrado (`/srv/nfs/afiliaciones` o `/srv/nfs/autorizaciones`).
- Mensaje de error exacto y salida de `sudo systemctl status nfs-server` o `sudo exportfs -v`, según corresponda.
