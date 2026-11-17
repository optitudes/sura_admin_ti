#!/usr/bin/env bash
# Instalación de Dokploy en Ubuntu Server 24.04 (VM dokploy-sura)
# ADVERTISE_ADDR = IP fija de la VM en la LAN
curl -sSL https://dokploy.com/install.sh | sudo ADVERTISE_ADDR=192.168.20.86 sh

# Verificación
docker --version
sudo docker service ls
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
