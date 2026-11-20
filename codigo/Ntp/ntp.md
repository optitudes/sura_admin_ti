# Servicio NTP (servidor de tiempo)

Servidor de tiempo para la red local, implementado con **chrony** sobre Ubuntu Server 22.04. El servidor se sincroniza con servidores NTP públicos y ofrece la hora a los clientes de la red `192.168.1.0/24`.

| Elemento | Valor |
|---|---|
| Servidor | `ProyectoFinal` (`192.168.1.200`) |
| Cliente | `cliente` (`192.168.1.201`) |
| Software | chrony |
| Puerto | `123/udp` |
| Zona horaria | `America/Bogota` |

> Requisito previo: la red de las dos VMs ya configurada ([red.md](../red/red.md)).

---

## Parte 1. Servidor

### Paso 1. Zona horaria

```bash
sudo timedatectl set-timezone America/Bogota
timedatectl
```

Debe mostrar `Time zone: America/Bogota (-05, -0500)`.

![Zona horaria](../../capturas/ntp/01-zona-horaria.png)

### Paso 2. Instalar chrony

```bash
sudo apt update
sudo apt install chrony -y
sudo systemctl disable --now systemd-timesyncd
```

Al instalar chrony, Ubuntu retira `systemd-timesyncd` para evitar conflictos entre dos servicios de hora. Por eso `disable` responde que la unidad está enmascarada (*masked*); es el comportamiento esperado.

![Instalación de chrony](../../capturas/ntp/02-instalar-chrony.png)

![systemd-timesyncd enmascarado](../../capturas/ntp/03-timesyncd-masked.png)

### Paso 3. Configurar chrony

```bash
sudo nano /etc/chrony/chrony.conf
```

Se agregan al final del archivo, sin borrar lo existente:

```conf
# Fuente adicional
pool pool.ntp.org iburst

# Permitir que la red local use este servidor
allow 192.168.1.0/24

# Seguir sirviendo hora si se pierde internet
local stratum 10
```

- `pool`: fuente externa adicional de tiempo.
- `allow`: autoriza a los equipos de la red local a consultar el servidor.
- `local stratum 10`: el servidor sigue entregando hora aunque pierda la conexión a internet.

![Configuración de chrony](../../capturas/ntp/04-chrony-conf.png)

### Paso 4. Reiniciar y habilitar el servicio

```bash
sudo systemctl restart chrony
sudo systemctl enable chrony
systemctl status chrony
```

Debe aparecer `active (running)`.

![Servicio chrony activo](../../capturas/ntp/05-chrony-activo.png)

### Paso 5. Firewall

```bash
sudo ufw status
```

UFW está `inactive`, por lo que no hay reglas que bloqueen el puerto 123/udp. Si se activara, habría que permitirlo con `sudo ufw allow 123/udp`.

![Estado de UFW](../../capturas/ntp/06-ufw-inactivo.png)

### Paso 6. Verificación del servidor

```bash
chronyc sources -v
chronyc tracking
timedatectl
sudo ss -ulnp | grep 123
```

Resultados:

- `chronyc sources -v`: varias fuentes externas; la marcada con `^*` (`0.co.ntp.edgeuno.com`) es la que usa el servidor.
- `chronyc tracking`: `Leap status : Normal`, desfase de unos pocos milisegundos y estrato 3.
- `timedatectl`: `System clock synchronized: yes` y `NTP service: active`.
- `ss`: `chronyd` escuchando en `0.0.0.0:123`.

![chronyc sources y tracking](../../capturas/ntp/07-chronyc-sources-tracking.png)

![timedatectl y puerto 123](../../capturas/ntp/08-timedatectl-puerto-123.png)

---

## Parte 2. Cliente Linux

En el cliente, que es un clon del servidor, chrony ya está instalado con la configuración del servidor. Se deja como cliente puro, usando solo el servidor de la red.

```bash
# Copia de seguridad y desactivar pool, allow y local
sudo cp /etc/chrony/chrony.conf /etc/chrony/chrony.conf.bak
sudo sed -i -E 's/^(pool|allow|local)/#\1/' /etc/chrony/chrony.conf

# Usar el servidor de la red como única fuente
echo "server 192.168.1.200 iburst" | sudo tee -a /etc/chrony/chrony.conf

# Revisar que no queden otras fuentes
grep -E "^(server|pool|allow|local)" /etc/chrony/chrony.conf
ls /etc/chrony/sources.d/

sudo systemctl restart chrony
sleep 10
chronyc sources -v
chronyc tracking
```

Resultados:

- `chronyc sources -v`: una única fuente, `proyectofinal.empresa.local` (`192.168.1.200`), marcada con `^*`.
- `chronyc tracking`: `Reference ID : C0A801C8` (la IP `192.168.1.200` en hexadecimal), estrato 3 (uno más que el servidor) y desfase de microsegundos.

![Cliente sincronizado con el servidor](../../capturas/ntp/09-cliente-sources-tracking.png)

### Prueba de sincronización

Se desajusta la hora a propósito y se comprueba que el cliente la corrige con el servidor:

```bash
sudo systemctl stop chrony
sudo date -s "2026-01-01 10:00:00"
date
sudo systemctl start chrony
sudo chronyc makestep
sleep 3
date
```

La hora pasa de `Thu Jan 1 2026` (incorrecta) a la hora real `Wed Nov 18 2026`.

![Prueba de desajuste de hora](../../capturas/ntp/10-cliente-prueba-desajuste.png)

### Verificación en el servidor (opcional)

```bash
sudo chronyc clients
```

Debe aparecer `192.168.1.201` con solicitudes registradas.

---

## Cliente Windows (opcional)

```
w32tm /config /manualpeerlist:"192.168.1.200" /syncfromflags:manual /update
w32tm /resync
w32tm /query /status
```

---

## Solución de problemas

| Problema | Causa | Solución |
|---|---|---|
| `Unit systemd-timesyncd.service is masked, ignoring` | chrony reemplaza a `systemd-timesyncd` al instalarse | No requiere acción; es el comportamiento esperado |
| `chronyc sources` muestra `^?` los primeros segundos | La fuente aún no responde | Esperar de 10 a 30 segundos y repetir el comando |
| El cliente no ve al servidor | Falta la directiva `allow`, el firewall bloquea el puerto o hay un error de red | Revisar `allow 192.168.1.0/24`, `ufw status` y `ping 192.168.1.200` |
| El cliente (clon) mostraba la configuración del servidor | El clon heredó `pool`, `allow` y `local stratum` | Comentar esas líneas con `sed` y dejar solo `server 192.168.1.200 iburst` |
| Diferencia de hora grande | chrony no corrige saltos grandes de forma inmediata | Ejecutar `sudo chronyc makestep` |
| `Command 'slepp' not found` | Error de escritura al teclear `sleep` | Repetir con `sleep 3` |
| `Destination Host Unreachable` al probar el cliente | El servidor estaba apagado | Encender el servidor y repetir la prueba |
