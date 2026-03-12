#!/bin/bash
# =============================================================
# DeliverEats — Script de despliegue en Kubernetes (Minikube)
# =============================================================
#
# USO:
#   bash k8s/deploy.sh
#
# PREREQUISITOS:
#   - minikube instalado y con driver Docker
#   - kubectl instalado
#   - Docker instalado y corriendo

# "set -e" hace que el script se detenga inmediatamente si cualquier
# comando falla (retorna código de error distinto de 0).
set -e

# Obtiene la ruta absoluta de la carpeta k8s/ (donde vive este script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# La carpeta raíz del proyecto es el nivel superior a k8s/
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================="
echo "  DeliverEats — Despliegue en Kubernetes"
echo "================================================="
echo ""

# ============================================================
# PASO 1: Verificar prerequisitos
# ============================================================
echo "[1/5] Verificando prerequisitos..."

# Comprueba que el binario de minikube existe en el PATH
if ! command -v minikube &>/dev/null; then
    echo "ERROR: minikube no está instalado."
    exit 1
fi

# Comprueba que kubectl existe en el PATH
if ! command -v kubectl &>/dev/null; then
    echo "ERROR: kubectl no está instalado."
    exit 1
fi

# Consulta el estado de minikube; si no está Running, lo inicia
if ! minikube status 2>/dev/null | grep -q "host: Running"; then
    echo "Minikube no está corriendo. Iniciando con 4 CPUs y 3.8GB RAM..."
    # --cpus y --memory: recursos asignados al nodo
    # --driver=docker: usa Docker como hipervisor (lo más común en Windows/Mac/Linux con Docker Desktop)
    minikube start --cpus=4 --memory=3800 --driver=docker
fi

# Habilita el addon "ingress" (controlador nginx de Kubernetes que expone servicios vía HTTP)
# Si ya está habilitado, el comando simplemente no hace nada dañino
if ! minikube addons list | grep -q "ingress.*enabled"; then
    echo "Habilitando addon ingress..."
    minikube addons enable ingress
fi

echo "  Prerequisitos OK"

# ============================================================
# PASO 2: Construir imágenes Docker DENTRO de Minikube
# ============================================================
# Minikube tiene su propio daemon de Docker separado del Docker del host.
# "eval $(minikube docker-env)" redirige los comandos "docker build/run/..."
# al daemon interno de Minikube, de modo que las imágenes quedan
# disponibles directamente para Kubernetes sin necesidad de un registry.
echo ""
echo "[2/5] Configurando contexto Docker de Minikube y construyendo imágenes..."
echo "      (Esto puede tardar varios minutos la primera vez)"
eval "$(minikube docker-env)"

# Construye cada imagen con la etiqueta que referencian los manifiestos YAML.
# El argumento final es la ruta al directorio que contiene el Dockerfile.
docker build -t delivereats/auth-service:latest         "$PROJECT_DIR/auth-service"              && echo "  [OK] auth-service"
docker build -t delivereats/catalog-service:latest      "$PROJECT_DIR/restaurant-catalog-service" && echo "  [OK] catalog-service"
docker build -t delivereats/order-service:latest        "$PROJECT_DIR/order-service"              && echo "  [OK] order-service"
docker build -t delivereats/delivery-service:latest     "$PROJECT_DIR/delivery-service"           && echo "  [OK] delivery-service"
docker build -t delivereats/fx-service:latest           "$PROJECT_DIR/fx-service"                 && echo "  [OK] fx-service"
docker build -t delivereats/payment-service:latest      "$PROJECT_DIR/payment-service"            && echo "  [OK] payment-service"
docker build -t delivereats/notification-service:latest "$PROJECT_DIR/notification-service"       && echo "  [OK] notification-service"
docker build -t delivereats/api-gateway:latest          "$PROJECT_DIR/api-gateway"                && echo "  [OK] api-gateway"
docker build -t delivereats/frontend:latest             "$PROJECT_DIR/frontend"                   && echo "  [OK] frontend"

# ============================================================
# PASO 3: Aplicar manifiestos de Kubernetes
# ============================================================
# "kubectl apply -f" lee el YAML y crea/actualiza los recursos en el cluster.
# Es idempotente: si el recurso ya existe, lo actualiza; si no, lo crea.
echo ""
echo "[3/5] Aplicando manifiestos de Kubernetes..."

# --- Namespace ---
# El Namespace "delivereats" agrupa todos los recursos del proyecto,
# aislándolos de otros proyectos que puedan existir en el cluster.
kubectl apply -f "$SCRIPT_DIR/namespace/namespace.yaml"

# --- Auth Service ---
# auth-secret.yaml: Secret con usuario/contraseña de auth-db y el JWT secret.
# Los Secrets en K8s almacenan datos sensibles codificados en base64.
kubectl apply -f "$SCRIPT_DIR/auth-service/auth-secret.yaml"

# auth-db-statefulset.yaml: StatefulSet de PostgreSQL para auth.
# Se usa StatefulSet (no Deployment) porque necesita almacenamiento persistente
# y un nombre de pod estable (auth-db-0) para las conexiones de la BD.
kubectl apply -f "$SCRIPT_DIR/auth-service/auth-db-statefulset.yaml"

# auth-service-deployment.yaml contiene tres recursos:
#   1. Service headless (clusterIP: None) para que el StatefulSet auth-db-0
#      tenga una identidad de red estable (auth-db-0.auth-db.delivereats.svc...)
#   2. Deployment del microservicio auth-service (Node.js + gRPC)
#   3. Service ClusterIP que expone auth-service internamente en el cluster
kubectl apply -f "$SCRIPT_DIR/auth-service/auth-service-deployment.yaml"

# --- Catalog Service ---
# catalog-service.yaml combina en un solo archivo:
#   Secret (catalog-db creds) + StatefulSet (PostgreSQL) +
#   Service headless + Deployment (microservicio) + Service ClusterIP
kubectl apply -f "$SCRIPT_DIR/catalog-service/catalog-service.yaml"

# --- Order Service ---
# Misma estructura que catalog: todo en un archivo.
kubectl apply -f "$SCRIPT_DIR/order-service/order-service.yaml"

# --- Delivery Service ---
kubectl apply -f "$SCRIPT_DIR/delivery-service/delivery-service.yaml"

# --- Redis ---
# redis-statefulset.yaml: Redis con persistencia (appendonly) en un PVC.
# redis-service.yaml: Service headless para que fx-service lo encuentre por nombre.
kubectl apply -f "$SCRIPT_DIR/redis/redis-statefulset.yaml"
kubectl apply -f "$SCRIPT_DIR/redis/redis-service.yaml"

# --- Payment Service ---
# Incluye Secret, StatefulSet (payment-db), ConfigMap de variables
# de entorno, Deployment y Service.
kubectl apply -f "$SCRIPT_DIR/payment-service/payment-service.yaml"

# --- Notification Service ---
# Secret con credenciales SMTP (Gmail App Password) + ConfigMap +
# Deployment + Service.
kubectl apply -f "$SCRIPT_DIR/notification-service/notification-service.yaml"

# --- FX Service ---
# ConfigMap con URL del API de tipos de cambio, Deployment y Service.
# Depende de Redis para cachear los resultados.
kubectl apply -f "$SCRIPT_DIR/fx-service/fx-service.yaml"

# --- API Gateway ---
# ConfigMap con URLs de todos los microservicios gRPC +
# Deployment (2 réplicas para alta disponibilidad) +
# Service ClusterIP + Ingress (expone /api al exterior via nginx)
kubectl apply -f "$SCRIPT_DIR/api-gateway/api-gateway.yaml"

# --- Frontend ---
# Deployment con nginx que sirve la app Angular compilada +
# Service ClusterIP + Ingress (expone / al exterior)
kubectl apply -f "$SCRIPT_DIR/frontend/frontend.yaml"

echo "  Todos los manifiestos aplicados."

# ============================================================
# PASO 4: Esperar que los pods estén listos
# ============================================================
# "kubectl wait" bloquea hasta que la condición se cumple o se agota
# el tiempo límite (--timeout).
# El selector "-l app=auth-db" filtra solo los pods con label app=auth-db.
# Las BDs deben estar Ready antes de que los microservicios intenten conectarse.
echo ""
echo "[4/5] Esperando que las bases de datos estén listas (máx. 3 min cada una)..."

kubectl wait --for=condition=ready pod -l app=auth-db     -n delivereats --timeout=180s && echo "  [OK] auth-db"
kubectl wait --for=condition=ready pod -l app=catalog-db  -n delivereats --timeout=180s && echo "  [OK] catalog-db"
kubectl wait --for=condition=ready pod -l app=order-db    -n delivereats --timeout=180s && echo "  [OK] order-db"
kubectl wait --for=condition=ready pod -l app=delivery-db -n delivereats --timeout=180s && echo "  [OK] delivery-db"
kubectl wait --for=condition=ready pod -l app=payment-db  -n delivereats --timeout=180s && echo "  [OK] payment-db"
kubectl wait --for=condition=ready pod -l app=redis       -n delivereats --timeout=120s && echo "  [OK] redis"

echo ""
echo "Esperando que los microservicios y frontend estén listos (máx. 5 min)..."
# Espera TODOS los pods del namespace. El "|| true" evita que el script
# falle si algún pod tarda más (K8s seguirá reintentando en segundo plano).
kubectl wait --for=condition=ready pod --all -n delivereats --timeout=300s || true

# ============================================================
# PASO 5: Mostrar resumen e instrucciones de acceso
# ============================================================
echo ""
echo "================================================="
echo "  Estado del cluster"
echo "================================================="
echo ""
# Lista todos los Pods con su estado (Running, Pending, CrashLoopBackOff, etc.)
kubectl get pods     -n delivereats
echo ""
# Lista Services con sus IPs internas y puertos
kubectl get services -n delivereats
echo ""
# Lista los Ingress (hostname → service)
kubectl get ingress  -n delivereats

# Obtiene la IP del nodo de Minikube para configurar /etc/hosts
MINIKUBE_IP=$(minikube ip)

echo ""
echo "================================================="
echo "  Cómo acceder a la aplicación"
echo "================================================="
echo ""
echo "  IP de Minikube: $MINIKUBE_IP"
echo ""
echo "  Agrega al archivo hosts:"
echo "  Windows:   C:\\Windows\\System32\\drivers\\etc\\hosts  (como Administrador)"
echo "  Linux/Mac: /etc/hosts"
echo ""
echo "    $MINIKUBE_IP  delivereats.local"
echo "    $MINIKUBE_IP  api.delivereats.local"
echo ""
echo "  Luego abre: http://delivereats.local"
echo ""
echo "================================================="
echo "  Comandos útiles"
echo "================================================="
echo ""
echo "  Ver pods:       kubectl get pods -n delivereats"
echo "  Ver logs:       kubectl logs -n delivereats <pod-name> -f"
echo "  Ver errores:    kubectl describe pod -n delivereats <pod-name>"
echo "  Dashboard:      minikube dashboard"
echo ""
echo "  Eliminar todo:  kubectl delete namespace delivereats"
echo ""
