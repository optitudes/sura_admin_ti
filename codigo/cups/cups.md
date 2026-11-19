Configuración de Servidor de Impresión CUPS — SURA EPS
Documentación técnica de infraestructura
Empresa: SURA EPS
Área: Tecnología de la Información / Infraestructura y OperacionesServicio: CUPS (Common Unix Printing System) — Impresión Centralizada y Cola Virtual PDFVersión: 1.0
Estado: Vigente
1. Propósito y alcance
Este documento estandariza la instalación, configuración y operación de un servidor de impresión centralizado basado en CUPS y la vinculación de estaciones cliente en el entorno de SURA EPS, permitiendo la gestión unificada de colas de impresión y generación documental mediante protocolo IPP/HTTPS:

Recurso / Cola
Ruta / URI del servidor
Grupo administrador
Usuario asociado
Uso empresarial
Impresora Corporativa
/printers/Impresora_SURA
lpadmin
saraf
Gestión centralizada de impresión y generación de comprobantes PDF en red local


La administración centralizada de controladores (PPD) y colas de impresión en el servidor Ubuntu Server (srv-admin-ti) evita la instalación manual de drivers en cada estación de trabajo, garantizando trazabilidad de trabajos (Jobs) y control de acceso administrativo.Regla de gobernanza: Los comandos y bloques de código de este documento son normativos y no deben modificarse. Solo se amplía la documentación explicativa a su alrededor. Los marcadores ${...} son placeholders que deben reemplazarse con los valores reales del entorno de SURA EPS antes de ejecutar.
2. Roles y responsabilidades
Rol
Responsabilidad
Administrador de Infraestructura
Ejecuta la instalación de CUPS, configura /etc/cups/cupsd.conf, registra impresoras compartidas y verifica colas.
Administrador de Sistemas Cliente
Vincula la impresora compartida vía IPP/Bonjour en estaciones macOS, Windows o Linux y valida la salida de impresión.
Seguridad de la Información
Valida reglas de firewall (puerto 631 TCP), cifrado TLS/HTTPS y pertenencia al grupo lpadmin.
Mesa de Servicio
Atiende solicitudes de vinculación de impresoras, reinicio de colas bloqueadas y escalamiento de incidentes CUPS.

3. Requisitos previos
Servidor con Ubuntu Server 24.04 LTS (srv-admin-ti) y una o más estaciones cliente en la red local de SURA EPS.
Usuario con privilegios sudo o root en el servidor.
Conectividad de red IP entre servidor y clientes (interfaz en modo Bridged o red corporativa).
Puerto 631 (TCP - IPP/HTTPS) habilitado en el firewall entre servidor y clientes.
El marcador ${ip del servidor cups} debe reemplazarse por la IP real del servidor en la red de SURA EPS (ej. 192.168.43.8).
4. Parte 1 — Configuración del servidor CUPS (Sede corporativa)
En esta sección se prepara el servidor Linux que aloja el servicio de impresión centralizada de SURA EPS.
4.1 Habilitación del repositorio universe y actualización de paquetes
En Ubuntu Server 24.04 LTS, los controladores virtuales PDF se encuentran en el componente universe, el cual debe activarse antes de instalar.

## Habilita el repositorio universe y actualiza la lista de paquetes
sudo add-apt-repository universe -y
sudo apt update
4.2 Instalación del servicio CUPS y controlador virtual PDF
## Instala el demonio CUPS y el controlador virtual PDF (-y responde "sí" automáticamente)
sudo apt install -y cups printer-driver-cups-pdf
4.3 Asignación de usuario al grupo de administración de impresión
Se incorpora el usuario administrador al grupo lpadmin para autorizar la gestión de impresoras desde la interfaz web y línea de comandos.

## Agrega el usuario administrador al grupo lpadmin
sudo usermod -aG lpadmin saraf


### 4.4 Configuración de acceso remoto en `/etc/cups/cupsd.conf`

Para habilitar la administración e impresión desde las estaciones cliente de la red local, se actualiza `/etc/cups/cupsd.conf` permitiendo la escucha en todas las interfaces y aceptando peticiones dirigidas a la IP del servidor.

```text
## Respalda la configuración original de CUPS
sudo cp /etc/cups/cupsd.conf /etc/cups/cupsd.conf.bak

## Permite acceso remoto, administración externa y compartición de impresoras
sudo cupsctl --remote-admin --remote-any --share-printers

## Agrega ServerAlias * para permitir peticiones HTTP/HTTPS por dirección IP
sudo sed -i '/^Port 631/a ServerAlias *' /etc/cups/cupsd.conf

Directivas clave aplicadas en /etc/cups/cupsd.conf:

Port 631 / Listen 0.0.0.0:631: habilita la escucha del servicio IPP/HTTPS en todas las interfaces de red del servidor.
ServerAlias *: desactiva el bloqueo por validación estricta de cabecera Host en CUPS 2.4+ cuando los clientes acceden mediante dirección IP.
Allow all / Allow @LOCAL dentro de <Location />, <Location /admin> y <Location /admin/conf>: autoriza el acceso de administración y consulta desde la red corporativa.
4.5 Inicio del servicio CUPS y habilitación al arranque
## Inicia CUPS ahora y lo habilita en cada arranque del sistema
sudo systemctl enable --now cups
sudo systemctl restart cups
4.6 Verificación del estado del servicio
## Verifica que el servicio CUPS está activo
sudo systemctl status cups

El servicio debe reportar active (running).
4.7 Alta de la impresora compartida en consola web
Abrir un navegador web y acceder a https://${ip del servidor cups}:631/admin.
Aceptar el certificado autofirmado del servidor e iniciar sesión con las credenciales del usuario saraf.
Seleccionar Add Printer > elegir CUPS-PDF (Virtual PDF Printer) > Continue.
Asignar el nombre Impresora_SURA, marcar obligatoriamente la casilla Share This Printer y continuar.
Seleccionar marca Generic y modelo Generic CUPS-PDF Printer (w/ options) > Add Printer.
5. Parte 2 — Configuración del cliente CUPS (Estaciones de SURA EPS)
En esta sección se prepara cada estación cliente corporativa (macOS / Linux) para imprimir hacia la cola centralizada.
5.1 Prueba de conectividad y descubrimiento IPP con el servidor de impresión
Valida que la estación cliente alcanza el servidor por red y responde en el puerto 631 antes de vincular la impresora.


## Prueba de conectividad ICMP hacia el servidor CUPS
ping -c 3 ${ip del servidor cups}

## Verifica que el puerto 631 (IPP/HTTPS) esté abierto y accesible desde el cliente
nc -zv ${ip del servidor cups} 631

Criterios de verificación de conectividad:
El comando ping debe devolver respuesta sin pérdida de paquetes (0% packet loss).
El comando nc (Netcat) debe confirmar Connection to ${ip del servidor cups} port 631 [tcp/ipp] succeeded!, garantizando que no existan bloqueos de firewall ni aislamiento de red local.

### 5.2 Vinculación en estación cliente macOS

1. En macOS, habilitar el permiso de **Red local** para el navegador y servicios de impresión en **Ajustes del Sistema > Privacidad y seguridad > Red local**.
2. Abrir **Ajustes del Sistema > Impresoras y escáneres** y hacer clic en **Agregar impresora, escáner o fax...**.
3. Seleccionar `Impresora_SURA` detectada automáticamente vía Bonjour/IPP (o añadir por IP usando protocolo **IPP** y cola `printers/Impresora_SURA`).
4. Hacer clic en **Agregar**.

### 5.3 Prueba de impresión desde estación cliente

1. Abrir cualquier documento en la estación cliente, presionar `Cmd + P`, seleccionar `Impresora_SURA` y enviar a imprimir.
2. Verificar en el servidor que el documento PDF se haya generado en el directorio de salida del usuario (`~/PDF/`):

```text
## Verifica los archivos PDF generados por la cola de impresión en el servidor
ls -la ~/PDF/
6. Verificación del funcionamiento
Desde el servidor, confirme que la impresora está activa y aceptando trabajos:

lpstat -p -d

Verifique el estado de la cola de impresión activa:

lpq -a

Verifique desde la interfaz web (https://${ip del servidor cups}:631/jobs?which_jobs=completed) que los trabajos enviados aparezcan con estado completed.
7. Política de seguridad y cumplimiento (SURA EPS)
Control administrativo (lpadmin): Únicamente los usuarios pertenecientes al grupo lpadmin pueden agregar, pausar o eliminar impresoras y colas en el servidor.
Cifrado en tránsito (HTTPS/IPP): La administración remota a través del puerto 631 exige cifrado TLS (https://) para proteger las credenciales de autenticación básica.
Firewall: CUPS utiliza el puerto 631 (TCP/UDP para IPP y descubrimiento). Habilite el tráfico únicamente dentro de la subred autorizada de SURA EPS (sudo ufw allow 631/tcp).
Placeholders: No ejecute comandos con ${ip del servidor cups} literal; reemplácelo por la dirección IP real del servidor antes de ejecutar.
8. Solución de problemas comunes
Problema
Posible causa
Acción recomendada
Package 'cups-pdf' has no installation candidate
Renombramiento del paquete en Ubuntu 24.04 LTS o repositorio universe deshabilitado
Ejecute sudo add-apt-repository universe -y && sudo apt update e instale printer-driver-cups-pdf.
403 Forbidden (You cannot access this page) en /admin
Validación estricta de cabecera Host en CUPS 2.4+ al acceder por IP
Agregue ServerAlias * bajo Port 631 en /etc/cups/cupsd.conf y ejecute sudo systemctl restart cups.
ERR_ADDRESS_UNREACHABLE desde navegador macOS
Permiso de Red local desactivado en macOS o aislamiento de red Wi-Fi (AP Isolation)
Active el permiso de Red local en Ajustes del Sistema > Privacidad y seguridad y valide conectividad con ping.
Trabajos quedan en estado stopped o held
Controlador PPD incompatible (no options) o impresora pausada
Use Generic CUPS-PDF Printer (w/ options) y habilite la cola con sudo cupsenable Impresora_SURA.

9. Soporte y escalamiento
Para incidentes relacionados con el servidor de impresión CUPS de SURA EPS, contacte a la Mesa de Servicio de Tecnología de la Información indicando:

Equipo afectado y dirección IP del cliente.
Nombre de la cola involucrada (Impresora_SURA).
Mensaje de error exacto y salida de sudo systemctl status cups y lpstat -p -d.

