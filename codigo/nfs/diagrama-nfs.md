# Diagrama — NFS (volúmenes de Afiliaciones y Autorizaciones)

> Servicio: **NFS** · puerto `2049` · `${ip del servidor nfs}`  
> Fuente: [`nfs.md`](nfs.md) · Diagrama general: [`../../analisis.md`](../../analisis.md)

```mermaid
graph LR
    S[Servidor NFS srv-admin-ti] --> A["/srv/nfs/afiliaciones · GID 2001"]
    S --> B["/srv/nfs/autorizaciones · GID 2002"]
    A -->|rw sync root_squash 2049| C[Cliente Linux atencion.afiliado]
    B -->|rw sync root_squash 2049| D[Cliente Linux autorizaciones]
    C --> E["/mnt/afiliaciones montaje nfs4 fstab"]
    D --> F["/mnt/autorizaciones montaje nfs4 fstab"]
```

**Lectura del flujo**

1. El servidor exporta dos volúmenes con UID/GID fijos y permisos `770`.
2. Cada cliente crea los mismos usuarios y grupos para mantener la propiedad de los archivos.
3. El montaje se realiza por NFSv4 y se persiste en `/etc/fstab` con `_netdev` y `x-systemd.automount`.
4. `root_squash` impide que el `root` remoto tenga privilegios sobre los exportados.

**Criterio de éxito:** `df -h | grep nfs4` muestra el volumen montado y el usuario del rol puede escribir.
