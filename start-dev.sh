#!/bin/bash
# Script de inicio rápido para desarrollo local de Delivereats
# Uso: ./start-dev.sh
# Levanta la infraestructura (DBs + Redis) y muestra comandos para cada microservicio

echo "🚀 Iniciando Delivereats en Modo Desarrollo..."
echo ""

# Definir colores para mensajes en terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

# Verificar que Docker está corriendo antes de intentar levantar contenedores
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker no está corriendo. Inicia Docker Desktop primero.${NC}"
    exit 1
fi

# Paso 1: Levantar toda la infraestructura con Docker en modo desarrollo
# docker-compose.dev.yml incluye: 5 PostgreSQL, Redis 7, payment-db
echo -e "${BLUE}📦 Paso 1: Levantando infraestructura (bases de datos + Redis) con Docker...${NC}"
docker-compose -f docker-compose.dev.yml up -d  # Modo detached: corre en segundo plano
echo ""

# Esperar a que PostgreSQL inicialice las tablas y Redis esté listo para conexiones
echo -e "${YELLOW}⏳ Esperando a que la infraestructura esté lista (15 seg)...${NC}"
sleep 15  # El FX-Service necesita Redis disponible antes de arrancar

# Paso 2: Verificar que todos los contenedores de infraestructura están corriendo
echo -e "${BLUE}🔍 Paso 2: Verificando estado de contenedores de infraestructura...${NC}"
docker-compose -f docker-compose.dev.yml ps  # Muestra estado (Up/Exit) de cada contenedor
echo ""

# Paso 3: Mostrar instrucciones para iniciar los 9 microservicios
echo -e "${GREEN}✅ Infraestructura lista (bases de datos PostgreSQL + Redis)${NC}"
echo ""
echo -e "${YELLOW}📝 Abre 9 terminales en VSCode y ejecuta cada comando:${NC}"
echo ""

# Terminal 1: Auth-Service — autenticación JWT, registro e inicio de sesión
echo -e "${BLUE}Terminal 1 — Auth Service (gRPC :50052):${NC}"
echo "  cd auth-service && npm install && npm run dev"
echo ""

# Terminal 2: Catalog-Service — catálogo de restaurantes y productos, validación de precios
echo -e "${BLUE}Terminal 2 — Catalog Service (gRPC :50051):${NC}"
echo "  cd restaurant-catalog-service && npm install && npm run dev"
echo ""

# Terminal 3: Order-Service — creación y gestión de pedidos, estados (PENDING→PAID→DELIVERED)
echo -e "${BLUE}Terminal 3 — Order Service (gRPC :50053):${NC}"
echo "  cd order-service && npm install && npm run dev"
echo ""

# Terminal 4: Delivery-Service — asignación de repartidores, foto obligatoria al entregar
echo -e "${BLUE}Terminal 4 — Delivery Service (gRPC :50054):${NC}"
echo "  cd delivery-service && npm install && npm run dev"
echo ""

# Terminal 5: Notification-Service — emails de bienvenida, pedidos y confirmaciones de pago
echo -e "${BLUE}Terminal 5 — Notification Service (gRPC :50055):${NC}"
echo "  cd notification-service && npm install && npm run dev"
echo ""

# Terminal 6: FX-Service — tipos de cambio USD/GTQ con caché Redis 24h y fallback
echo -e "${BLUE}Terminal 6 — FX Service (gRPC :50056):${NC}"
echo "  cd fx-service && npm install && npm run dev"
echo "  Nota: Requiere Redis corriendo (ya iniciado con docker-compose.dev.yml)"
echo ""

# Terminal 7: Payment-Service — pagos con CREDIT_CARD, DEBIT_CARD y DIGITAL_WALLET
echo -e "${BLUE}Terminal 7 — Payment Service (gRPC :50057):${NC}"
echo "  cd payment-service && npm install && npm run dev"
echo ""

# Terminal 8: API Gateway — punto de entrada REST que enruta a microservicios vía gRPC
echo -e "${BLUE}Terminal 8 — API Gateway (HTTP :3000):${NC}"
echo "  cd api-gateway && npm install && npm run dev"
echo ""

# Terminal 9: Frontend Angular — Panel Admin, Dashboard Repartidor y vista Cliente
echo -e "${BLUE}Terminal 9 — Frontend Angular (HTTP :4200):${NC}"
echo "  cd frontend && npm install && npm start"
echo ""

# Mostrar URLs disponibles cuando todos los servicios estén corriendo
echo -e "${GREEN}🎯 URLs disponibles cuando todo esté corriendo:${NC}"
echo "  Frontend:    http://localhost:4200"
echo "  API Gateway: http://localhost:3000"
echo "  Health:      http://localhost:3000/health"
echo ""

# Mostrar puertos de bases de datos para herramientas externas (DBeaver, pgAdmin)
echo -e "${YELLOW}💡 Puertos de bases de datos para DBeaver/pgAdmin:${NC}"
echo "  auth-db:     localhost:5432  (usuario: auth_user, bd: auth_db)"
echo "  catalog-db:  localhost:5433  (usuario: catalog_user, bd: catalog_db)"
echo "  order-db:    localhost:5434  (usuario: order_user, bd: order_db)"
echo "  delivery-db: localhost:5435  (usuario: delivery_user, bd: delivery_db)"
echo "  payment-db:  localhost:5436  (usuario: payment_user, bd: payment_db)"
echo ""

# Mostrar cómo verificar que Redis está funcionando correctamente
echo -e "${YELLOW}🔴 Para verificar Redis:${NC}"
echo "  docker-compose -f docker-compose.dev.yml exec redis redis-cli ping"
echo "  Respuesta esperada: PONG"
echo ""
