#!/bin/bash
# Script de Pruebas Automatizadas — Delivereats
# Cubre Prácticas 2, 3 y 5: Auth, gRPC (validación catálogo), FX-Service, Payment-Service,
# Delivery con foto obligatoria y Panel Administrativo
# Uso: ./test-all.sh
# Prerrequisito: todos los servicios corriendo (./start-dev.sh)

echo "🚀 Iniciando pruebas de Delivereats..."
echo ""

# Colores para output de resultados
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

# URL base del API Gateway
API_URL="http://localhost:3000"

# Variables globales para tokens y IDs que se reutilizan entre pruebas
TOKEN=""         # Token del usuario CLIENT (se setea en login P2)
ADMIN_TOKEN=""   # Token del usuario ADMIN (se setea en P5)
DELIVERY_TOKEN="" # Token del usuario DELIVERY (se setea en P5)

# Función de pausa para revisar resultados entre secciones
pause() {
    read -p "Presiona Enter para continuar..."
}

# Función que muestra ✅ o ❌ según el código de salida del comando anterior
show_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

echo "════════════════════════════════════════"
echo "  PRÁCTICA 2: AUTH SERVICE + JWT"
echo "════════════════════════════════════════"
echo ""

# ============================================
# REGISTRO DE USUARIOS
# ============================================
echo "📝 PRUEBA 1: Registro de Usuarios"
echo "-----------------------------------"

# Registro 1: Usuario con rol CLIENT (cliente del restaurante)
echo "1. Registrando Cliente..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }')
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Cliente registrado"
echo ""

# Registro 2: Usuario con rol ADMIN (acceso al panel administrativo)
echo "2. Registrando Admin..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@test.com",
    "password": "password123",
    "firstName": "Admin",
    "lastName": "Sistema",
    "role": "ADMIN"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Admin registrado"
echo ""

# Registro 3: Usuario con rol RESTAURANT (dueño de restaurante)
echo "3. Registrando Restaurante..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant1@test.com",
    "password": "password123",
    "firstName": "Restaurante",
    "lastName": "Uno",
    "role": "RESTAURANT"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Restaurante registrado"
echo ""

# Registro 4: Usuario con rol DELIVERY (repartidor)
echo "4. Registrando Repartidor..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "delivery1@test.com",
    "password": "password123",
    "firstName": "Repartidor",
    "lastName": "Uno",
    "role": "DELIVERY"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Repartidor registrado"
echo ""

# Registro 5: Email duplicado — debe ser rechazado por el sistema
echo "5. Intentando email duplicado (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Email duplicado rechazado correctamente"
echo ""

pause

# ============================================
# LOGIN Y JWT
# ============================================
echo ""
echo "🔐 PRUEBA 2: Login y JWT"
echo "-----------------------------------"

# Login 1: Credenciales correctas — debe generar token JWT
echo "1. Login exitoso..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123"
  }')
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
TOKEN=$(echo "$RESPONSE" | jq -r '.token')  # Guardar el JWT para pruebas posteriores
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Login exitoso"
echo "Token obtenido: ${TOKEN:0:50}..."
echo ""

# Login 2: Contraseña incorrecta — debe ser rechazado con error 401
echo "2. Login con contraseña incorrecta (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "wrongpassword"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Contraseña incorrecta rechazada"
echo ""

# Login 3: Email inexistente — debe ser rechazado con error 404
echo "3. Login con email inexistente (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "noexiste@test.com",
    "password": "password123"
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Email inexistente rechazado"
echo ""

pause

# ============================================
# PRÁCTICA 3: GRPC — VALIDACIÓN DE PEDIDOS
# ============================================
echo ""
echo "════════════════════════════════════════"
echo "  PRÁCTICA 3: VALIDACIÓN gRPC"
echo "════════════════════════════════════════"
echo ""

echo "📦 PRUEBA 3: Órdenes Exitosas (Validación gRPC con Catalog-Service)"
echo "-----------------------------------"

# Orden 1: Pizza con precio correcto y producto disponible
echo "1. Orden con Pizza..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 2,
        "price": 12.99
      }
    ],
    "deliveryAddress": "Calle 123"
  }')
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Orden de Pizza creada"
echo ""

# Orden 2: Hamburguesa con precio correcto
echo "2. Orden con Hamburguesa..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "22222222-2222-2222-2222-222222222222",
        "quantity": 1,
        "price": 8.50
      }
    ]
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Orden de Hamburguesa creada"
echo ""

# Orden 3: Múltiples productos en un solo pedido
echo "3. Orden con múltiples productos..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 1,
        "price": 12.99
      },
      {
        "productId": "33333333-3333-3333-3333-333333333333",
        "quantity": 2,
        "price": 2.00
      }
    ]
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Orden múltiple creada"
echo ""

pause

# ============================================
# ÓRDENES FALLIDAS — VALIDACIONES
# ============================================
echo ""
echo "❌ PRUEBA 4: Órdenes Fallidas (Validación gRPC)"
echo "-----------------------------------"

# Fallo 1: Precio enviado no coincide con el precio real del producto
echo "1. Orden con precio incorrecto (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 1,
        "price": 5.00
      }
    ]
  }')
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Precio incorrecto rechazado"
echo ""

# Fallo 2: El producto existe pero está marcado como no disponible (is_available = false)
echo "2. Orden con producto no disponible (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "44444444-4444-4444-4444-444444444444",
        "quantity": 1,
        "price": 7.50
      }
    ]
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Producto no disponible rechazado"
echo ""

# Fallo 3: El productId no existe en el catálogo
echo "3. Orden con producto inexistente (debe fallar)..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "quantity": 1,
        "price": 10.00
      }
    ]
  }')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Producto inexistente rechazado"
echo ""

pause

# ============================================
# PRÁCTICA 5: FX-SERVICE + PAYMENT + DELIVERY CON FOTO + PANEL ADMIN
# ============================================
echo ""
echo "════════════════════════════════════════"
echo "  PRÁCTICA 5: FX-SERVICE + PAYMENT + DELIVERY CON FOTO + PANEL ADMIN"
echo "════════════════════════════════════════"
echo ""

# ============================================
# FX-SERVICE: TIPOS DE CAMBIO CON CACHÉ REDIS
# ============================================
echo "💱 PRUEBA 5: FX-Service — Tipos de cambio USD/GTQ con caché Redis"
echo "-----------------------------------"

# Primera llamada: debe consultar la API externa open.er-api.com (source = API)
echo "1. Primera llamada al tipo de cambio (fuente esperada: API)..."
RESPONSE=$(curl -s "$API_URL/fx/rate?from=USD&to=GTQ")
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
SOURCE=$(echo "$RESPONSE" | jq -r '.data.source // .source // empty')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Tipo de cambio obtenido"
echo "  Fuente obtenida: $SOURCE  (se espera: API)"
echo ""

# Segunda llamada inmediata: debe retornar desde Redis (source = CACHE)
echo "2. Segunda llamada al tipo de cambio (fuente esperada: CACHE)..."
RESPONSE=$(curl -s "$API_URL/fx/rate?from=USD&to=GTQ")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
SOURCE=$(echo "$RESPONSE" | jq -r '.data.source // .source // empty')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Tipo de cambio en caché"
echo "  Fuente obtenida: $SOURCE  (se espera: CACHE)"
echo ""

pause

# ============================================
# OBTENER TOKENS DE ADMIN Y DELIVERY
# ============================================
echo "👑 PRUEBA 6: Obtener tokens de ADMIN y DELIVERY"
echo "-----------------------------------"

# Login como ADMIN para acceder al panel administrativo
echo "1. Login como ADMIN..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@test.com",
    "password": "password123"
  }')
ADMIN_TOKEN=$(echo "$RESPONSE" | jq -r '.token')  # JWT con role=ADMIN
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Login ADMIN exitoso"
echo ""

# Login como DELIVERY para gestionar entregas
echo "2. Login como DELIVERY..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "delivery1@test.com",
    "password": "password123"
  }')
DELIVERY_TOKEN=$(echo "$RESPONSE" | jq -r '.token')  # JWT con role=DELIVERY
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Login DELIVERY exitoso"
echo ""

pause

# ============================================
# PAYMENT-SERVICE: PROCESAMIENTO DE PAGOS
# ============================================
echo "💳 PRUEBA 7: Payment-Service — Procesamiento de pagos"
echo "-----------------------------------"

# Crear orden 1 para pagar con CREDIT_CARD
echo "1. Creando orden para pago con tarjeta de crédito..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "11111111-1111-1111-1111-111111111111", "quantity": 1, "price": 12.99}],
    "deliveryAddress": "Zona 1, Ciudad de Guatemala"
  }')
ORDER_ID_1=$(echo "$RESPONSE" | jq -r '.order.id // .data.id // .id')  # Extraer UUID del pedido
show_result $([ "$(echo "$RESPONSE" | jq -r '.success')" = "true" ] && echo 0 || echo 1) "Orden 1 creada"
echo "  Order ID: $ORDER_ID_1"
echo ""

# Procesar pago con CREDIT_CARD — simula tarjeta de crédito terminada en 1234
echo "2. Procesando pago con CREDIT_CARD..."
RESPONSE=$(curl -s -X POST $API_URL/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"orderId\": \"$ORDER_ID_1\",
    \"amount\": 12.99,
    \"currency\": \"USD\",
    \"paymentMethod\": \"CREDIT_CARD\",
    \"cardHolder\": \"Juan Pérez\",
    \"cardLastFour\": \"1234\"
  }")
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Pago con CREDIT_CARD procesado"
echo ""

# Crear orden 2 para pagar con DEBIT_CARD
echo "3. Creando orden para pago con tarjeta de débito..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "22222222-2222-2222-2222-222222222222", "quantity": 2, "price": 8.50}],
    "deliveryAddress": "Zona 10, Ciudad de Guatemala"
  }')
ORDER_ID_2=$(echo "$RESPONSE" | jq -r '.order.id // .data.id // .id')
show_result $([ "$(echo "$RESPONSE" | jq -r '.success')" = "true" ] && echo 0 || echo 1) "Orden 2 creada"
echo "  Order ID: $ORDER_ID_2"
echo ""

# Procesar pago con DEBIT_CARD — simula tarjeta de débito terminada en 5678
echo "4. Procesando pago con DEBIT_CARD..."
RESPONSE=$(curl -s -X POST $API_URL/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"orderId\": \"$ORDER_ID_2\",
    \"amount\": 17.00,
    \"currency\": \"USD\",
    \"paymentMethod\": \"DEBIT_CARD\",
    \"cardHolder\": \"Juan Pérez\",
    \"cardLastFour\": \"5678\"
  }")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Pago con DEBIT_CARD procesado"
echo ""

# Crear orden 3 para pagar con DIGITAL_WALLET (billetera digital tipo Google Pay)
echo "5. Creando orden para pago con billetera digital..."
RESPONSE=$(curl -s -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "55555555-5555-5555-5555-555555555555", "quantity": 1, "price": 11.50}],
    "deliveryAddress": "Zona 15, Ciudad de Guatemala"
  }')
ORDER_ID_3=$(echo "$RESPONSE" | jq -r '.order.id // .data.id // .id')
show_result $([ "$(echo "$RESPONSE" | jq -r '.success')" = "true" ] && echo 0 || echo 1) "Orden 3 creada"
echo "  Order ID: $ORDER_ID_3"
echo ""

# Procesar pago con DIGITAL_WALLET — simula billetera digital con ID de wallet
echo "6. Procesando pago con DIGITAL_WALLET..."
RESPONSE=$(curl -s -X POST $API_URL/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"orderId\": \"$ORDER_ID_3\",
    \"amount\": 11.50,
    \"currency\": \"USD\",
    \"paymentMethod\": \"DIGITAL_WALLET\",
    \"walletId\": \"wallet-abc-123\"
  }")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Pago con DIGITAL_WALLET procesado"
echo ""

pause

# ============================================
# DELIVERY CON FOTO OBLIGATORIA AL ENTREGAR
# ============================================
echo "📸 PRUEBA 8: Delivery-Service — Entrega con foto obligatoria"
echo "-----------------------------------"

# Obtener la lista de entregas asignadas al repartidor actual
echo "1. Obteniendo entregas asignadas al repartidor..."
RESPONSE=$(curl -s "$API_URL/deliveries/my" \
  -H "Authorization: Bearer $DELIVERY_TOKEN")
echo "$RESPONSE" | jq '.deliveries[0] // .data[0] // .[0]'
DELIVERY_ID=$(echo "$RESPONSE" | jq -r '.deliveries[0].id // .data[0].id // .[0].id')
show_result $([ -n "$DELIVERY_ID" ] && [ "$DELIVERY_ID" != "null" ] && echo 0 || echo 1) "Entrega encontrada"
echo "  Delivery ID: $DELIVERY_ID"
echo ""

if [ -n "$DELIVERY_ID" ] && [ "$DELIVERY_ID" != "null" ]; then

    # Actualizar estado a PICKED_UP: el repartidor recogió el pedido en el restaurante
    echo "2. Actualizando estado a PICKED_UP (paquete recogido en restaurante)..."
    RESPONSE=$(curl -s -X PUT "$API_URL/deliveries/$DELIVERY_ID/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DELIVERY_TOKEN" \
      -d '{"status": "PICKED_UP"}')
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Estado PICKED_UP actualizado"
    echo ""

    # Actualizar estado a IN_TRANSIT: el repartidor está en camino al cliente
    echo "3. Actualizando estado a IN_TRANSIT (en camino al cliente)..."
    RESPONSE=$(curl -s -X PUT "$API_URL/deliveries/$DELIVERY_ID/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DELIVERY_TOKEN" \
      -d '{"status": "IN_TRANSIT"}')
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Estado IN_TRANSIT actualizado"
    echo ""

    # Intentar marcar DELIVERED sin foto — debe ser rechazado (foto obligatoria)
    echo "4. Intentando DELIVERED sin foto (debe fallar — foto obligatoria)..."
    RESPONSE=$(curl -s -X PUT "$API_URL/deliveries/$DELIVERY_ID/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DELIVERY_TOKEN" \
      -d '{"status": "DELIVERED"}')
    echo "$RESPONSE" | jq '.'
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "DELIVERED sin foto rechazado correctamente"
    echo ""

    # Marcar como DELIVERED con foto base64 — imagen de 1x1 pixel PNG para la prueba
    echo "5. Marcando como DELIVERED con foto base64 (debe ser exitoso)..."
    PHOTO_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    RESPONSE=$(curl -s -X PUT "$API_URL/deliveries/$DELIVERY_ID/status" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $DELIVERY_TOKEN" \
      -d "{\"status\": \"DELIVERED\", \"deliveryPhoto\": \"$PHOTO_BASE64\"}")
    echo "$RESPONSE" | jq '.'
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "DELIVERED con foto registrado correctamente"
    echo ""

else
    echo -e "${YELLOW}⚠️  No hay entregas asignadas al repartidor aún.${NC}"
    echo "   Asegúrate de haber creado órdenes en las pruebas anteriores."
    echo "   El sistema asigna entregas automáticamente al crear pedidos."
    echo ""
fi

pause

# ============================================
# PANEL ADMIN: CONSULTA DE ÓRDENES FINALIZADAS
# ============================================
echo "📋 PRUEBA 9: Panel Admin — Consulta de órdenes por estado"
echo "-----------------------------------"

# Consultar órdenes entregadas como administrador
echo "1. Consultando órdenes DELIVERED como ADMIN..."
RESPONSE=$(curl -s "$API_URL/admin/orders?status=DELIVERED" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESPONSE" | jq '{success: .success, total_entregadas: (.orders | length)}'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Órdenes DELIVERED obtenidas como ADMIN"
echo ""

# Consultar órdenes pagadas (estado PAID, orden pagada aún sin entregar)
echo "2. Consultando órdenes PAID como ADMIN..."
RESPONSE=$(curl -s "$API_URL/admin/orders?status=PAID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Órdenes PAID obtenidas como ADMIN"
echo ""

# Consultar órdenes canceladas
echo "3. Consultando órdenes CANCELLED como ADMIN..."
RESPONSE=$(curl -s "$API_URL/admin/orders?status=CANCELLED" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Órdenes CANCELLED obtenidas como ADMIN"
echo ""

# Verificar que un usuario CLIENT no puede acceder al panel admin (autorización por rol)
echo "4. Intentando acceder al panel admin con token de CLIENT (debe fallar)..."
RESPONSE=$(curl -s "$API_URL/admin/orders" \
  -H "Authorization: Bearer $TOKEN")
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
show_result $([ "$SUCCESS" = "false" ] && echo 0 || echo 1) "Acceso ADMIN denegado a usuario CLIENT"
echo ""

# ============================================
# RESUMEN FINAL DE PRUEBAS
# ============================================
echo ""
echo "════════════════════════════════════════"
echo "  RESUMEN DE PRUEBAS"
echo "════════════════════════════════════════"
echo ""
echo "✅ Práctica 2: Auth Service + JWT"
echo "   - 5 Registros (4 exitosos, 1 duplicado rechazado)"
echo "   - 3 Logins (1 exitoso, 2 fallidos)"
echo ""
echo "✅ Práctica 3: Validación gRPC con Catalog-Service"
echo "   - 3 Órdenes exitosas (pizza, hamburguesa, múltiple)"
echo "   - 3 Órdenes fallidas (precio incorrecto, no disponible, inexistente)"
echo ""
echo "✅ Práctica 5: FX-Service + Payment-Service + Delivery + Admin"
echo "   - FX-Service: rate USD→GTQ (fuente API y CACHE Redis)"
echo "   - Payments: 3 métodos (CREDIT_CARD, DEBIT_CARD, DIGITAL_WALLET)"
echo "   - Delivery: flujo completo PICKED_UP → IN_TRANSIT → DELIVERED con foto"
echo "   - Panel Admin: filtrado por DELIVERED, PAID, CANCELLED + control de acceso"
echo ""
echo "💡 Para ver los logs de cada servicio:"
echo "   docker-compose logs -f fx-service payment-service"
echo "   docker-compose logs -f order-service delivery-service"
echo ""
echo "🎉 ¡Pruebas completadas!"
