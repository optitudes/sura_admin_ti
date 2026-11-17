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

## 6. Solución de problemas encontrados

| Problema | Causa | Solución |
|----------|-------|----------|
| El instalador mostró `ens33 — autoconfiguration failed` y no obtuvo IP (captura `P1a`) | El puente de VMware estaba en "Automático" y se conectó al adaptador virtual de Hyper-V, no a la tarjeta física | En **Edit → Virtual Network Editor → VMnet0** se cambió *Bridged to* a **Realtek PCIe GbE Family Controller** (captura `P1b`) y se volvió a pedir IP con *Edit IPv4 → Automatic (DHCP)* |
| `cat: /etc/netplan/01-ip-fija.yaml: Permission denied` | El archivo tiene permisos `600` (solo root) | Leerlo con `sudo cat`. Este error confirma que los permisos quedaron correctos |

---

## 7. Seguridad

- La contraseña del usuario de Ubuntu y la del panel de Dokploy son distintas, y no aparecen en este documento ni en las capturas.
- El token de unión al Swarm y el correo de la cuenta de administrador se difuminaron en las capturas.
- No se actualizó a Ubuntu 26.04: el servidor se mantiene en la versión LTS que pide la guía del proyecto.
