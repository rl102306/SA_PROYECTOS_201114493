#!/bin/bash

# 🚀 Script de Inicio Rápido para Desarrollo Local

echo "🚀 Iniciando Delivereats en Modo Desarrollo..."
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Levantar bases de datos
echo -e "${BLUE}📦 Paso 1: Levantando bases de datos con Docker...${NC}"
docker-compose -f docker-compose.dev.yml up -d
echo ""

# Esperar a que las bases de datos estén listas
echo -e "${YELLOW}⏳ Esperando a que las bases de datos estén listas...${NC}"
sleep 10

# 2. Verificar que las bases de datos están corriendo
echo -e "${BLUE}🔍 Paso 2: Verificando bases de datos...${NC}"
docker-compose -f docker-compose.dev.yml ps
echo ""

# 3. Instrucciones
echo -e "${GREEN}✅ Bases de datos listas!${NC}"
echo ""
echo -e "${YELLOW}📝 Ahora abre VSCode y ejecuta en 5 terminales:${NC}"
echo ""
echo -e "${BLUE}Terminal 1 (Auth Service):${NC}"
echo "  cd auth-service && npm install && npm run dev"
echo ""
echo -e "${BLUE}Terminal 2 (Catalog Service):${NC}"
echo "  cd restaurant-catalog-service && npm install && npm run dev"
echo ""
echo -e "${BLUE}Terminal 3 (Order Service):${NC}"
echo "  cd order-service && npm install && npm run dev"
echo ""
echo -e "${BLUE}Terminal 4 (API Gateway):${NC}"
echo "  cd api-gateway && npm install && npm run dev"
echo ""
echo -e "${BLUE}Terminal 5 (Frontend):${NC}"
echo "  cd frontend && npm install && npm start"
echo ""
echo -e "${GREEN}🎯 Luego ve a: http://localhost:4200${NC}"
echo ""
echo -e "${YELLOW}💡 Lee DESARROLLO-LOCAL.md para más detalles${NC}"
