# Configuración servidor 
## Actualiza la lista de paquetes desde los repositorios de Debian
sudo apt update
## Instala el servidor NFS del kernel (-y responde "sí" automáticamente)
sudo apt install -y nfs-kernel-server
# Grupos, Usuarios y Carpetas
## Crea los grupos con GID fijo
sudo groupadd -g 2001 grp_afiliaciones
sudo groupadd -g 2002 grp_autorizaciones
## Crea los usuarios con UID fijo (-m crea su home, -g su grupo, -c descripción)
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
# Configuracion del NFS
## Configuracion del /etc/exports 
/srv/nfs/afiliaciones     ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
/srv/nfs/autorizaciones   ${ip del usuario}(rw,sync,no_subtree_check,root_squash)
## Aplica la configuración de exportaciones
sudo exportfs -ra

## Muestra lo que se está exportando
sudo exportfs -v

## Inicia NFS ahora y en cada arranque
sudo systemctl enable --now nfs-server

## Verifica que el servicio está activo
sudo systemctl status nfs-server

# Configuracion cliente
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
Este proceso se debe repetiro con cada usuario
## Montaje con fstab
Para lograr un montaje permanente se debe editar el documento /etc/fstab
agregando el montaje necesario

192.168.1.6:/srv/nfs/afiliaciones  /mnt/afiliaciones  nfs4  defaults,_netdev,x-systemd.automount,noatime  0  0
una vez modificado ejecutar lo siguiente para recargar y montar

sudo systemctl daemon-reload
sudo mount -a

