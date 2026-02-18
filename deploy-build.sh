#!/bin/bash

# 🚀 Script Automatizado de Despliegue en GCP
# Este script despliega todos los servicios de Delivereats en Google Cloud Run

set -e  # Salir si hay error

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando despliegue de Delivereats en GCP${NC}"
echo ""

# Verificar que gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI no está instalado${NC}"
    echo "Instala desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Pedir configuración
read -p "Project ID (ej: delivereats-prod): " PROJECT_ID
read -p "Region (ej: us-central1): " REGION

export PROJECT_ID
export REGION

echo -e "${YELLOW}📝 Configurando proyecto...${NC}"
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Habilitar APIs
echo -e "${YELLOW}🔧 Habilitando APIs necesarias...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Configurar Docker
echo -e "${YELLOW}🐳 Configurando Docker...${NC}"
gcloud auth configure-docker

# Construir y subir imágenes
echo -e "${GREEN}📦 Construyendo imágenes Docker...${NC}"

services=("auth-service" "restaurant-catalog-service" "order-service" "delivery-service" "notification-service" "api-gateway" "frontend")

for service in "${services[@]}"; do
    echo -e "${YELLOW}Building $service...${NC}"
    cd $service
    docker build -t gcr.io/$PROJECT_ID/$service:latest .
    docker push gcr.io/$PROJECT_ID/$service:latest
    cd ..
    echo -e "${GREEN}✅ $service pushed${NC}"
done

echo ""
echo -e "${GREEN}🎉 Todas las imágenes subidas a GCR${NC}"
echo ""
echo -e "${YELLOW}⚠️  Ahora necesitas:${NC}"
echo "1. Crear Cloud SQL instances manualmente"
echo "2. Crear secrets con gcloud secrets create"
echo "3. Ejecutar deploy-services.sh para desplegar"
echo ""
echo "Ver DESPLIEGUE-GCP.md para instrucciones completas"
