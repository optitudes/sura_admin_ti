# Servicio NIS (autenticación centralizada de usuarios)

NIS permite administrar las cuentas de usuario desde un solo servidor. Un usuario creado en el servidor puede iniciar sesión en el cliente sin tener una cuenta local en él.

| Elemento | Valor |
|---|---|
| Servidor NIS (maestro) | `ProyectoFinal` (`192.168.1.200`) |
| Cliente NIS | `cliente` (`192.168.1.201`) |
| Dominio NIS | `empresa.local` |
| Usuarios de prueba | `usuario1` (UID 1001) y `usuario2` (UID 1002) |
| Puertos | `111` (rpcbind) y puertos dinámicos de `ypserv`, `ypbind` y `yppasswdd` |

> Requisito previo: la red de las dos VMs ya configurada ([red.md](../red/red.md)).

> **Nota de seguridad:** NIS transmite la información de las cuentas, incluidos los hashes de contraseñas, sin cifrar por la red. Se usa solo en una red local de confianza y se restringe por red con `ypserv.securenets`. Las capturas de este documento tienen los hashes ocultados. Alternativas más seguras: LDAP o FreeIPA.

---

## Parte 1. Servidor

### Paso 1. Comprobar que el nombre del servidor se resuelve

`ypinit` falla si el nombre del equipo no se resuelve.

```bash
grep proyectofinal /etc/hosts
ping -c 1 proyectofinal
```

![Resolución del nombre del servidor](<../../capturas/nis/Servidor/1. Comprobar nombre del servidor.png>)

### Paso 2. Instalar NIS y definir el dominio

```bash
sudo apt update
sudo apt install nis -y
```

Durante la instalación se solicita el dominio NIS: `empresa.local`.

![Instalación de NIS](<../../capturas/nis/Servidor/2. Instalar NIS.png>)

La instalación no dejó el dominio guardado (`/etc/defaultdomain` no existía), así que se definió a mano:

```bash
cat /etc/defaultdomain
echo "empresa.local" | sudo tee /etc/defaultdomain
cat /etc/defaultdomain
```

![Dominio NIS guardado](<../../capturas/nis/Servidor/2.1. Instalar NIS.png>)

### Paso 3. Configurar el servidor como maestro

```bash
sudo sed -i 's/^NISSERVER=.*/NISSERVER=master/' /etc/default/nis
grep NISSERVER /etc/default/nis
```

Debe mostrar `NISSERVER=master`.

![NISSERVER=master](<../../capturas/nis/Servidor/3. Configurar el servidor como maestro.png>)

### Paso 4. Restringir el acceso a la red local

```bash
sudo tee /etc/ypserv.securenets > /dev/null <<'EOF'
255.0.0.0       127.0.0.0
255.255.255.0   192.168.1.0
EOF
```

Solo pueden consultar el servidor el propio equipo (`127.0.0.0`) y la red `192.168.1.0/24`. Archivo de referencia: [`ypserv.securenets`](ypserv.securenets).

![ypserv.securenets](<../../capturas/nis/Servidor/4. Restringe el acceso a la red.png>)

### Paso 5. Indicar que el servidor se consulta a sí mismo

```bash
echo "ypserver 127.0.0.1" | sudo tee -a /etc/yp.conf
```

![yp.conf del servidor](<../../capturas/nis/Servidor/5. Indicar al servidor autoconsulta.png>)

### Paso 6. Definir qué usuarios se publican

La cuenta `Sara` existe como usuario local con UID 1000 tanto en el servidor como en el cliente. Para que NIS no la publique ni la pise, solo se publican usuarios con UID y GID **1001 o superior** (`MINUID` y `MINGID`). También se activa la fusión de contraseñas y grupos (`MERGE_PASSWD` y `MERGE_GROUP`), necesaria para que las contraseñas se distribuyan por NIS:

```bash
sudo sed -i -E 's/^MINUID=.*/MINUID=1001/; s/^MINGID=.*/MINGID=1001/' /var/yp/Makefile
grep -E "^(MINUID|MINGID|MERGE_PASSWD|MERGE_GROUP)" /var/yp/Makefile
# Estaban en false: se cambian a true
sudo sed -i -E 's/^MERGE_PASSWD=.*/MERGE_PASSWD=true/; s/^MERGE_GROUP=.*/MERGE_GROUP=true/' /var/yp/Makefile
grep -E "^(MINUID|MINGID|MERGE_PASSWD|MERGE_GROUP)" /var/yp/Makefile
```

Resultado final: `MINUID=1001`, `MINGID=1001`, `MERGE_PASSWD=true`, `MERGE_GROUP=true`.

![Makefile de NIS](<../../capturas/nis/Servidor/6. Ajustar los usuarios.png>)

### Paso 7. Crear los usuarios de prueba

Se crean **antes** de generar los mapas:

```bash
sudo adduser --gecos "" usuario1
sudo adduser --gecos "" usuario2
id usuario1
```

![Usuarios de prueba](<../../capturas/nis/Servidor/7. Creaar los usuarios.png>)

### Paso 8. Inicializar la base de datos NIS

```bash
sudo /usr/lib/yp/ypinit -m
```

Cuando pregunta por otros servidores, se presiona `Ctrl+D` y se confirma con `y`. La primera ejecución falló porque el dominio no estaba activo en el sistema (`domainname` mostraba `(none)`). Se activó y se repitió:

```bash
sudo domainname empresa.local
domainname
sudo /usr/lib/yp/ypinit -m
```

![ypinit](<../../capturas/nis/Servidor/8. Inicializa la base NIS.png>)

Los mapas se generaron antes de que `ypserv` estuviera corriendo, por lo que `ypinit` mostró mensajes `RPC: Program not registered`. Una vez iniciados los servicios (paso siguiente), se regeneran los mapas y ya no hay errores:

```bash
sudo make -C /var/yp
```

### Paso 9. Iniciar y habilitar los servicios

```bash
sudo systemctl restart rpcbind ypserv yppasswdd ypxfrd ypbind
sudo systemctl enable rpcbind ypserv yppasswdd ypxfrd ypbind
```

![Servicios NIS](<../../capturas/nis/Servidor/9. Iniciar los servicios.png>)

### Paso 10. Verificación del servidor

```bash
domainname
rpcinfo -p localhost | grep yp
ypwhich
ypcat passwd
```

Resultados:

- `domainname`: `empresa.local`
- `rpcinfo`: `ypserv`, `ypbind`, `yppasswdd` y `ypxfrd` registrados
- `ypwhich`: `127.0.0.1`
- `ypcat passwd`: `usuario1` (1001) y `usuario2` (1002); la cuenta `Sara` no se publica

![Verificación del servidor NIS](<../../capturas/nis/Servidor/10. Verificar.png>)

> Cada vez que se cree, modifique o elimine un usuario en el servidor hay que regenerar los mapas con `sudo make -C /var/yp`. Este comando se ejecuta **solo en el servidor**.

---

## Parte 2. Cliente

Los archivos que quedan configurados en el cliente están resumidos en [`cliente-nis.conf`](cliente-nis.conf).

### Paso 1. Instalar NIS

```bash
sudo apt update
sudo apt install nis -y
```

Cuando pida el dominio, escribir `empresa.local`.

![Instalación de NIS en el cliente](<../../capturas/nis/Cliente/1. Instalar NIS.png>)

### Paso 2. Fijar el dominio

```bash
echo "empresa.local" | sudo tee /etc/defaultdomain
sudo domainname empresa.local
domainname
```

![Dominio en el cliente](<../../capturas/nis/Cliente/2. Fijar el dominio.png>)

### Paso 3. Indicar el servidor NIS

```bash
echo "domain empresa.local server 192.168.1.200" | sudo tee -a /etc/yp.conf
```

![yp.conf del cliente](<../../capturas/nis/Cliente/3. Indicar el servidor NIS.png>)

### Paso 4. Consultar NIS para usuarios y grupos

```bash
sudo sed -i -E '/^(passwd|group|shadow):/ s/$/ nis/' /etc/nsswitch.conf
grep -E "^(passwd|group|shadow):" /etc/nsswitch.conf
```

Cada línea debe terminar en `nis`.

![nsswitch.conf del cliente](<../../capturas/nis/Cliente/4. Consultar NIS para usuarios y grupos.png>)

### Paso 5. Crear el directorio personal en el primer inicio de sesión

```bash
echo "session optional pam_mkhomedir.so skel=/etc/skel umask=077" | sudo tee -a /etc/pam.d/common-session
```

![pam_mkhomedir](<../../capturas/nis/Cliente/5. Crear directorio.png>)

### Paso 6. Iniciar el servicio

```bash
sudo systemctl restart rpcbind ypbind
sudo systemctl enable ypbind
```

![ypbind habilitado](<../../capturas/nis/Cliente/6. Iniciar el servicio.png>)

### Paso 7. Verificación en el cliente

```bash
ypwhich
ypcat passwd | cut -d: -f1,3
getent passwd usuario1
su - usuario1
```

Resultados:

- `ypwhich`: `192.168.1.200`
- `ypcat`: `usuario2:1002`, `usuario1:1001` y `nobody:65534`
- `getent passwd usuario1`: el usuario se resuelve vía NIS (UID 1001)
- `su - usuario1`: el sistema pide la contraseña definida en el servidor, crea `/home/usuario1` y abre la sesión como `usuario1@cliente`. La cuenta no existe en el cliente, solo en el servidor NIS.

![Verificación y login en el cliente](<../../capturas/nis/Cliente/7. Verificar.png>)

### Pruebas adicionales

```bash
# Inicio de sesión por SSH con un usuario que solo existe en NIS (desde otro equipo)
ssh usuario2@192.168.1.201

# Cambio de contraseña desde el cliente (se actualiza en el servidor)
su - usuario1
yppasswd
```

---

## Solución de problemas

| Problema | Causa | Solución |
|---|---|---|
| `ypinit`: *The local host's domain name hasn't been set* | `/etc/defaultdomain` tiene el dominio, pero `domainname` mostraba `(none)` | `sudo domainname empresa.local` y repetir `ypinit -m` |
| `cat: /etc/defaultdomain: No such file or directory` | La instalación de `nis` no guardó el dominio | `echo "empresa.local" \| sudo tee /etc/defaultdomain` |
| `MERGE_PASSWD=false` y `MERGE_GROUP=false` | Valores por defecto del `Makefile` | Cambiarlos a `true` con `sed` y regenerar los mapas con `make -C /var/yp` |
| `failed to send 'clear' to local ypserv: RPC: Program not registered` durante `ypinit` | `ypserv` aún no estaba iniciado cuando se generaron los mapas | Iniciar los servicios y ejecutar `sudo make -C /var/yp` |
| `make -C /var/yp` falla en el cliente (`cannot create directory`, `No rule to make target`) | Ese comando solo se ejecuta en el servidor, que es quien construye los mapas | No ejecutarlo en el cliente |
| La cuenta `Sara` (UID 1000) aparecería en NIS y chocaría con la cuenta local | `MINUID` por defecto es 1000 | Fijar `MINUID=1001` y `MINGID=1001` |
| `ypwhich` no responde en el cliente | Dominio distinto, `ypbind` detenido o servidor inaccesible | Revisar `domainname`, `/etc/yp.conf`, `systemctl status ypbind` y `ping 192.168.1.200` |
| El usuario se ve en `ypcat` pero no en `getent passwd` | Falta `nis` en `/etc/nsswitch.conf` | Agregar `nis` a `passwd`, `group` y `shadow` |
| El usuario inicia sesión pero no tiene directorio personal | Falta `pam_mkhomedir` | Agregar la línea en `/etc/pam.d/common-session` |
| Un usuario nuevo no aparece en el cliente | No se regeneraron los mapas | `sudo make -C /var/yp` en el servidor |
