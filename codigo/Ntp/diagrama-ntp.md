# Diagrama — NTP (sincronización horaria)

> Servicio: **NTP** · puerto `123/UDP` · IP pendiente de definir  
> **Estado: pendiente de implementar** — sin guía de instalación ni evidencias en `capturas/`.

```mermaid
graph LR
    R[Fuente de tiempo de referencia] -.pendiente.-> S[Servidor NTP]
    S -.123 UDP pendiente.-> C1[Cliente Linux]
    S -.123 UDP pendiente.-> C2[Cliente Windows/Mac]
    C1 --> L[Logs y certificados con hora coherente]
    C2 --> L
```

**Flujo previsto**

1. El servidor NTP tomará el tiempo de una fuente de referencia y lo servirá a la red local.
2. Los clientes sincronizarán su reloj contra el servidor por el puerto 123/UDP.
3. Esto permitirá correlacionar logs, trazabilidad de incidentes y validez de certificados.

**Criterio de éxito pendiente:** los clientes sincronizan con el servidor (`timedatectl` / `chronyc sources`).
