Servicio de Compartición de Archivos (Samba)
Curso: Administración de Infraestructura de TI
Institución: Universidad del Quindío — Facultad de Ingeniería de Sistemas y Computación
Servidor: Ubuntu Server 24.04 LTS (srv-admin-ti)
Cliente de Pruebas: macOS (Apple Silicon M4)


1. Análisis y Diseño
1.1 Justificación del Servicio
La implementación del servicio Samba mediante el protocolo SMB/CIFS responde a la necesidad de disponer de un repositorio centralizado de almacenamiento de archivos en el directorio /srv/samba/sura. Este servicio proporciona compatibilidad e interoperabilidad nativa entre entornos de red heterogéneos, permitiendo el acceso concurrente y transparente desde clientes con sistemas operativos macOS y Microsoft Windows.

La arquitectura de seguridad y control de acceso se fundamenta en tres pilares principales:

Control de acceso granular: Restricción del recurso exclusivo para usuarios pertenecientes al grupo del sistema @sambausers.
Base de credenciales independiente: Uso de la base de datos de contraseñas TDB (passdb.tdb) de Samba, desacoplando la autenticación de red del archivo del sistema /etc/shadow.
Herencia de permisos colaborativos: Configuración del bit SGID (2775) en el directorio base. Esto garantiza que todos los archivos y subdirectorios creados hereden automáticamente el grupo propietario sambausers, preservando la consistencia de los permisos colaborativos sin requerir intervención manual administrativa.
1.2 Tabla de Requisitos de Red
Servicio
Protocolo
Puerto(s)
Tipo de Servicio
Recurso / Ruta
Criterio de Éxito
Samba (SMB/CIFS)
TCP / UDP
139, 445 (TCP)137, 138 (UDP)
Compartición de Archivos Multiplataforma
//<IP_SERVIDOR>/sura(/srv/samba/sura)
Carpeta compartida accesible con permisos de lectura y escritura desde clientes macOS/Windows mediante credenciales válidas.



2. Procedimiento de Instalación y Configuración
2.1 Entorno Base
La plataforma sobre la cual se desplegó el servicio cumple con las siguientes especificaciones técnicas y parámetros de infraestructura:

Hipervisor: UTM (Arquitectura ARM64 sobre Apple Silicon M4).
Sistema Operativo: Ubuntu Server 24.04 LTS.
Nombre de Host (Hostname): srv-admin-ti.
Usuario Administrador: saraf.
Recursos Asignados: 2 vCPUs, 4 GB de memoria RAM, 40 GB de disco virtual.
Configuración de Red: Interfaz en modo puente (Bridged), identificada como enp0s1.
2.2 Instalación y Estructura de Directorios con Permisos
Instalación de paquetes: Actualización de los repositorios del sistema e instalación del servidor Samba y el cliente CLI para pruebas locales.

sudo apt update && sudo apt install samba smbclient -y

Gestión de grupos y usuarios: Creación del grupo dedicado para el servicio y vinculación del usuario de administración.

sudo groupadd sambausers
sudo usermod -aG sambausers saraf

Creación del directorio del recurso: Preparación del punto de montaje local.

sudo mkdir -p /srv/samba/sura

Asignación de propiedad y permisos POSIX/SGID: Establecimiento de root:sambausers como propietarios y aplicación del modo 2775 (SGID + rwxrwxr-x).

sudo chown -R root:sambausers /srv/samba/sura
sudo chmod -R 2775 /srv/samba/sura
2.3 Gestión de Credenciales SMB
Debido al aislamiento entre las contraseñas del sistema Linux y la base TDB de Samba, se procedió a dar de alta y activar la cuenta del usuario en el servicio:

sudo smbpasswd -a saraf
sudo smbpasswd -e saraf
2.4 Configuración del Recurso Compartido (/etc/samba/smb.conf)
Respaldo de la configuración de fábrica:

sudo cp /etc/samba/smb.conf /etc/samba/smb.conf.bak

Edición del archivo de configuración: Inclusión del bloque [sura] al final del archivo /etc/samba/smb.conf:

[sura]
   comment = Carpeta Compartida Sura
   path = /srv/samba/sura
   browseable = yes
   writable = yes
   guest ok = no
   valid users = @sambausers
   create mask = 0664
   directory mask = 0775

Validación sintáctica y reinicio de servicios:

testparm -s
sudo systemctl enable --now smbd nmbd
sudo systemctl restart smbd nmbd


3. Comandos de Verificación y Pruebas
Para corroborar la correcta operatividad y disponibilidad del servicio compartida, se ejecutaron los siguientes procedimientos de validación:
3.1 Estado de los Servicios del Sistema
Verificación del estado de ejecución de los demonios SMB (transferencia de archivos) y NMB (resolución de nombres NetBIOS):

sudo systemctl status smbd nmbd

Criterio de aceptación: Ambos servicios deben reportar el estado active (running).
3.2 Validación de la Sintaxis de Samba
Confirmación de la lectura de parámetros sin errores en el archivo de configuración:

testparm -s

Criterio de aceptación: La salida del comando muestra la carga limpia de las directivas globales y la sección [sura].
3.3 Prueba de Conexión Local mediante CLI
Conexión de prueba en el propio servidor para verificar la autenticación del usuario y la validez de los permisos de acceso:

smbclient //localhost/sura -U saraf

Criterio de aceptación: Ingreso exitoso tras suministrar la contraseña del usuario saraf, desplegando el prompt interactivo smb: \>.
3.4 Prueba de Integración desde Cliente macOS
Abrir la aplicación Finder en la estación de trabajo macOS.
Presionar la combinación de teclas Cmd + K para abrir la ventana Conectarse al servidor.
Ingresar la URI del recurso: smb://<IP_SERVIDOR>/sura.
Autenticarse seleccionando Usuario registrado e introduciendo las credenciales del usuario saraf.
Probar la creación de carpetas y archivos desde el entorno gráfico.
Verificar desde la consola del servidor (srv-admin-ti) la aplicación de los permisos esperados (0664 para archivos y 0775 para directorios).


4. Solución de Problemas Encontrados (Troubleshooting)
Durante el proceso de despliegue y validación se identificaron las siguientes incidencias, junto a sus respectivas soluciones técnicas:
Problema 1: Separación de autenticación entre el SO Linux y Samba
Sintoma: Rechazo de autenticación (Access Denied) al intentar conectar clientes remotos o locales, a pesar de usar un usuario existente en el sistema operativo.
Causa Raíz: Samba no consulta el archivo /etc/shadow por defecto para validar contraseñas de red, sino que mantiene una base de datos local cifrada (passdb.tdb).
Resolución: Registrar e inicializar formalmente la cuenta dentro del esquema de Samba mediante los comandos sudo smbpasswd -a saraf para definir la clave y sudo smbpasswd -e saraf para habilitar el usuario.
Problema 2: Aislamiento de red local en el cliente macOS (ERR_ADDRESS_UNREACHABLE)
Síntoma: Error de conexión por tiempo de espera o dirección inalcanzable al intentar mapear smb://<IP_SERVIDOR>/sura desde macOS.
Causa Raíz: Restricciones de privacidad introducidas en macOS para acceso a la red local por parte de aplicaciones del sistema, o falta de enrutamiento adecuado cuando la máquina anfitriona utiliza conexiones compartidas (ej. Tethering móvil).
Resolución:
Habilitar explícitamente los permisos de red en Ajustes del Sistema > Privacidad y seguridad > Red local.
Verificar la conectividad mediante ping <IP_SERVIDOR> desde la Terminal de macOS.
Comprobar la visibilidad de los puertos requeridos usando nc -zv <IP_SERVIDOR> 445.


5. Evidencias para el Repositorio Git
A continuación se detalla la estructura y descripción de los artefactos generados que forman parte del repositorio del proyecto (capturas/ y codigo/):
Estrcutura de la carpeta capturas/
01_samba_finder_mac.png: Captura de pantalla de la ventana del Finder en macOS conectada exitosamente a smb://<IP_SERVIDOR>/sura, mostrando la estructura de archivos y directorios creados durante las pruebas de escritura.
02_samba_terminal_status.png: Captura de la consola del servidor mostrando la ejecución consecutiva de:
sudo systemctl status smbd nmbd (confirmando estado active).
testparm -s (demostrando validez del archivo de configuración).
ls -ld /srv/samba/sura (comprobando permisos drwxrwsr-x y grupo sambausers).
Estructura de la carpeta codigo/
smb.conf: Copia de respaldo del archivo de configuración final de /etc/samba/smb.conf, incluyendo las directivas globales del servidor y la definición formal del recurso compartido [sura].

