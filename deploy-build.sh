#!/bin/bash
# Script automatizado de construcción y envío de imágenes Docker a GCR
# Uso: ./deploy-build.sh
# Prerrequisitos: gcloud CLI instalado, Docker corriendo, proyecto GCP configurado

set -e  # Salir inmediatamente si cualquier comando falla

# Definir colores para mensajes en terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

echo -e "${GREEN}🚀 Iniciando construcción y despliegue de Delivereats en GCP${NC}"
echo ""

# Verificar que gcloud CLI está instalado en el sistema
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI no está instalado${NC}"
    echo "Instala desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar que Docker Desktop está corriendo antes de intentar construir imágenes
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker no está corriendo. Inicia Docker Desktop primero.${NC}"
    exit 1
fi

# Solicitar al usuario el Project ID y la región de GCP
read -p "Project ID de GCP (ej: delivereats-prod): " PROJECT_ID
read -p "Región de GCP (ej: us-central1): " REGION

# Exportar variables para que los subcomandos también las tengan disponibles
export PROJECT_ID
export REGION

echo -e "${YELLOW}📝 Configurando proyecto activo en gcloud...${NC}"
gcloud config set project "$PROJECT_ID"      # Establecer el proyecto activo de GCP
gcloud config set run/region "$REGION"       # Establecer la región por defecto para Cloud Run

# Habilitar todas las APIs de GCP necesarias para este proyecto
echo -e "${YELLOW}🔧 Habilitando APIs de GCP necesarias...${NC}"
gcloud services enable run.googleapis.com                 # Cloud Run: ejecución de contenedores sin servidor
gcloud services enable containerregistry.googleapis.com   # Container Registry: almacenamiento de imágenes Docker
gcloud services enable sqladmin.googleapis.com            # Cloud SQL: bases de datos PostgreSQL administradas
gcloud services enable redis.googleapis.com               # Memorystore for Redis: caché para el FX-Service
gcloud services enable secretmanager.googleapis.com       # Secret Manager: gestión segura de contraseñas y JWT

# Autenticar Docker para poder hacer push a Google Container Registry
echo -e "${YELLOW}🐳 Configurando autenticación de Docker con GCR...${NC}"
gcloud auth configure-docker

# Lista completa de todos los microservicios del proyecto Delivereats
echo -e "${GREEN}📦 Construyendo imágenes Docker de todos los servicios...${NC}"

services=(
    "auth-service"              # Servicio de autenticación con JWT
    "restaurant-catalog-service" # Catálogo de restaurantes y productos (validación gRPC)
    "order-service"             # Gestión de pedidos (estados: PENDING, PAID, DELIVERED, CANCELLED)
    "delivery-service"          # Gestión de entregas (foto base64 obligatoria al marcar DELIVERED)
    "notification-service"      # Envío de emails (registro, pedidos, pagos) vía SMTP/Nodemailer
    "fx-service"                # Tipos de cambio USD/GTQ con caché Redis 24h + fallback
    "payment-service"           # Pagos CREDIT_CARD/DEBIT_CARD/DIGITAL_WALLET con conversión GTQ/USD
    "api-gateway"               # Puerta de enlace REST→gRPC (autenticación, rutas admin, pagos)
    "frontend"                  # Aplicación Angular (Panel Admin, Dashboard Repartidor, vista Cliente)
)

# Recorrer cada servicio: construir imagen y subirla a GCR
for service in "${services[@]}"; do
    echo -e "${YELLOW}🔨 Construyendo imagen: ${service}...${NC}"

    # Construir imagen Docker usando el Dockerfile ubicado en el directorio del servicio
    # Se usa ./${service} como contexto en lugar de cd para evitar problemas si un build falla
    docker build -t "gcr.io/${PROJECT_ID}/${service}:latest" "./${service}"

    # Subir la imagen construida al Google Container Registry del proyecto
    docker push "gcr.io/${PROJECT_ID}/${service}:latest"

    echo -e "${GREEN}✅ ${service} subido exitosamente a GCR${NC}"
    echo ""
done

echo ""
echo -e "${GREEN}🎉 Todas las imágenes subidas exitosamente a GCR${NC}"
echo ""
echo -e "${YELLOW}⚠️  Pasos siguientes para completar el despliegue:${NC}"
echo "1. Crear instancias Cloud SQL PostgreSQL para:"
echo "   auth-db (5432), catalog-db (5433), order-db (5434), delivery-db (5435), payment-db (5436)"
echo "2. Crear instancia Cloud Memorystore for Redis (para fx-service: caché de tipos de cambio)"
echo "3. Crear secretos en Secret Manager:"
echo "   gcloud secrets create jwt-secret --data-file=<archivo>"
echo "   gcloud secrets create smtp-password --data-file=<archivo>"
echo "4. Desplegar en Kubernetes Engine (GKE) usando los manifiestos del directorio k8s/"
echo "   cd k8s && ./deploy.sh"
echo ""
echo "Ver k8s/deploy.sh para instrucciones completas de despliegue en Kubernetes"
