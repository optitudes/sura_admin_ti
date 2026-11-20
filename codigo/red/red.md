# Red de las VMs de NTP y NIS

Configuración de red previa a los servicios NTP ([`../Ntp/ntp.md`](../Ntp/ntp.md)) y NIS ([`../Nis/nis.md`](../Nis/nis.md)). Las dos máquinas virtuales usan IP fija en la red `192.168.1.0/24` para que los clientes siempre encuentren al servidor.

| Equipo | Rol | Interfaz | IP | Sistema |
|---|---|---|---|---|
| `ProyectoFinal` | Servidor NTP y NIS | `enp0s3` | `192.168.1.200/24` | Ubuntu Server 22.04 LTS |
| `cliente` | Cliente NTP y NIS (clon del servidor) | `enp0s3` | `192.168.1.201/24` | Ubuntu Server 22.04 LTS |

Puerta de enlace: `192.168.1.1` · DNS: `8.8.8.8` y `1.1.1.1` · Nombre del servidor: `proyectofinal.empresa.local`.

---

## Paso 1. IP fija con netplan

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: false
      addresses:
        - 192.168.1.200/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

```bash
sudo netplan apply
```

En el cliente se usa el mismo archivo con la dirección `192.168.1.201/24`. Como el cliente es un clon del servidor, también se le cambia el nombre a `cliente` para que no se confunda con el servidor.

![netplan con IP fija](<../../capturas/ntp/Configuración/1. netplan.png>)

Archivo de referencia: [`50-cloud-init.yaml`](50-cloud-init.yaml).

## Paso 2. Nombre del servidor en `/etc/hosts`

NIS (`ypinit`) necesita que el nombre del servidor se resuelva. Se agrega la línea:

```text
192.168.1.200   proyectofinal.empresa.local   proyectofinal
```

El cliente, al ser un clon, hereda esta línea; por eso `chronyc sources` muestra el nombre `proyectofinal.empresa.local` en lugar de la IP.

![/etc/hosts](<../../capturas/ntp/Configuración/2. hosts.png>)

## Paso 3. Verificación

```bash
ip -br a
ping -c 3 192.168.1.1
ping -c 3 pool.ntp.org
```

Resultados:

- `ip -br a`: `enp0s3` en estado `UP` con `192.168.1.200/24`.
- `ping 192.168.1.1`: 3 paquetes recibidos, 0% de pérdida (la puerta de enlace responde).
- `ping pool.ntp.org`: 0% de pérdida; el servidor tiene salida a internet y resuelve nombres, requisito para sincronizarse con los servidores NTP públicos.

![Verificación de direcciones](<../../capturas/ntp/Configuración/3. Verificar direcciones.png>)

## Solución de problemas

| Problema | Causa | Solución |
|---|---|---|
| El cliente clonado tiene la misma IP que el servidor | El clon copia el archivo de netplan | Cambiar la dirección a `192.168.1.201/24` y ejecutar `sudo netplan apply` |
| `ypinit` falla porque no encuentra el nombre del equipo | Falta la línea del servidor en `/etc/hosts` | Agregar `192.168.1.200 proyectofinal.empresa.local proyectofinal` |
| No hay salida a internet | Puerta de enlace o DNS incorrectos | Revisar `ip route` y la sección `nameservers` de netplan |
