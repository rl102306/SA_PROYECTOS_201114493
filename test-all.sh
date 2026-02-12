#!/bin/bash

# 🧪 Script de Pruebas Automatizadas - Delivereats
# Este script ejecuta todas las pruebas necesarias para las prácticas 2 y 3

echo "🚀 Iniciando pruebas de Delivereats..."
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
API_URL="http://localhost:3000"
TOKEN=""

# Función para hacer pause
pause() {
    read -p "Presiona Enter para continuar..."
}

# Función para mostrar resultados
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

# Registro 1: Cliente
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

# Registro 2: Admin
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

# Registro 3: Restaurante
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

# Registro 4: Repartidor
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

# Registro 5: Email duplicado (debe fallar)
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
# LOGIN
# ============================================
echo ""
echo "🔐 PRUEBA 2: Login y JWT"
echo "-----------------------------------"

# Login 1: Exitoso
echo "1. Login exitoso..."
RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123"
  }')
echo "$RESPONSE" | jq '.'
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
TOKEN=$(echo "$RESPONSE" | jq -r '.token')
show_result $([ "$SUCCESS" = "true" ] && echo 0 || echo 1) "Login exitoso"
echo "Token obtenido: ${TOKEN:0:50}..."
echo ""

# Login 2: Contraseña incorrecta (debe fallar)
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

# Login 3: Email inexistente (debe fallar)
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
# PRÁCTICA 3: GRPC
# ============================================
echo ""
echo "════════════════════════════════════════"
echo "  PRÁCTICA 3: VALIDACIÓN gRPC"
echo "════════════════════════════════════════"
echo ""

echo "📦 PRUEBA 3: Órdenes Exitosas (Validación gRPC)"
echo "-----------------------------------"

# Orden 1: Pizza
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

# Orden 2: Hamburguesa
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

# Orden 3: Múltiples productos
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
# ÓRDENES FALLIDAS
# ============================================
echo ""
echo "❌ PRUEBA 4: Órdenes Fallidas (Validación gRPC)"
echo "-----------------------------------"

# Fallo 1: Precio incorrecto
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

# Fallo 2: Producto no disponible
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

# Fallo 3: Producto no existe
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

# ============================================
# RESUMEN
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
echo "✅ Práctica 3: Validación gRPC"
echo "   - 3 Órdenes exitosas"
echo "   - 3 Órdenes fallidas (precio, disponibilidad, inexistente)"
echo ""
echo "💡 Para ver los logs detallados:"
echo "   docker-compose logs order-service catalog-service"
echo ""
echo "🎉 ¡Pruebas completadas!"
