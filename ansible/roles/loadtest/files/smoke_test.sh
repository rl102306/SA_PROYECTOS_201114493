#!/bin/bash
# =============================================================
# Smoke Test — DeliverEats
# =============================================================
# Valida el flujo crítico de la aplicación haciendo peticiones
# HTTP reales contra el entorno desplegado.
#
# Flujo probado:
#   1. Health check del API Gateway
#   2. Registro de usuario cliente
#   3. Login y obtención de token JWT
#   4. Listar restaurantes (catálogo)
#   5. Listar productos de un restaurante
#   6. Crear un pedido
#   7. Consultar estado del pedido
#
# Salida:
#   - Exit 0: todos los checks pasaron
#   - Exit 1: al menos un check falló
#
# Uso:
#   ./smoke_test.sh                          (usa BASE_URL del entorno)
#   BASE_URL=http://mi-app.com ./smoke_test.sh
# =============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://delivereats.local}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoke_${TIMESTAMP}@test.com"
TEST_PASSWORD="SmokeTest123!"
PASS=0
FAIL=0

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}  ✓ PASS${NC} — $1"; ((PASS++)) || true; }
log_fail() { echo -e "${RED}  ✗ FAIL${NC} — $1"; ((FAIL++)) || true; }
log_info() { echo -e "${YELLOW}  →${NC} $1"; }

echo "======================================================="
echo " DeliverEats Smoke Test"
echo " Base URL : $BASE_URL"
echo " Timestamp: $TIMESTAMP"
echo "======================================================="

# ── Helper: HTTP request con timeout ─────────────────────────────────────────
http_get() {
  curl -s -o /tmp/smoke_response.json -w "%{http_code}" \
    --max-time 10 \
    -H "Host: api.delivereats.local" \
    -H "Authorization: Bearer ${TOKEN:-}" \
    "$1"
}

http_post() {
  curl -s -o /tmp/smoke_response.json -w "%{http_code}" \
    --max-time 10 \
    -H "Host: api.delivereats.local" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN:-}" \
    -d "$2" \
    "$1"
}

response_field() {
  cat /tmp/smoke_response.json | jq -r "$1" 2>/dev/null || echo ""
}

# ── CHECK 1: Health check ─────────────────────────────────────────────────────
echo ""
echo "[ 1/7 ] Health check del API Gateway"
STATUS=$(http_get "$BASE_URL/health")
if [ "$STATUS" = "200" ]; then
  log_pass "GET /health → $STATUS"
else
  log_fail "GET /health → $STATUS (esperado 200)"
fi

# ── CHECK 2: Registro de usuario ──────────────────────────────────────────────
echo ""
echo "[ 2/7 ] Registro de usuario cliente"
log_info "Email: $TEST_EMAIL"
STATUS=$(http_post "$BASE_URL/auth/register" "{
  \"email\": \"$TEST_EMAIL\",
  \"password\": \"$TEST_PASSWORD\",
  \"firstName\": \"Smoke\",
  \"lastName\": \"Test\",
  \"role\": \"CLIENT\"
}")
SUCCESS=$(response_field '.success')
if [ "$STATUS" = "200" ] && [ "$SUCCESS" = "true" ]; then
  log_pass "POST /auth/register → $STATUS"
else
  log_fail "POST /auth/register → $STATUS, success=$SUCCESS"
  cat /tmp/smoke_response.json
fi

# ── CHECK 3: Login ────────────────────────────────────────────────────────────
echo ""
echo "[ 3/7 ] Login y obtención de token JWT"
STATUS=$(http_post "$BASE_URL/auth/login" "{
  \"email\": \"$TEST_EMAIL\",
  \"password\": \"$TEST_PASSWORD\"
}")
TOKEN=$(response_field '.token')
USER_ID=$(response_field '.user.id')
if [ "$STATUS" = "200" ] && [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  log_pass "POST /auth/login → $STATUS (token obtenido)"
else
  log_fail "POST /auth/login → $STATUS, token=$TOKEN"
  cat /tmp/smoke_response.json
  TOKEN=""
fi

# ── CHECK 4: Listar restaurantes ──────────────────────────────────────────────
echo ""
echo "[ 4/7 ] Listar restaurantes del catálogo"
STATUS=$(http_get "$BASE_URL/catalog/restaurants")
RESTAURANT_COUNT=$(response_field '.restaurants | length' 2>/dev/null || echo "0")
RESTAURANT_ID=$(response_field '.restaurants[0].id' 2>/dev/null || echo "")
if [ "$STATUS" = "200" ] && [ "$RESTAURANT_COUNT" -gt 0 ] 2>/dev/null; then
  log_pass "GET /catalog/restaurants → $STATUS ($RESTAURANT_COUNT restaurantes)"
else
  log_fail "GET /catalog/restaurants → $STATUS (count=$RESTAURANT_COUNT)"
  cat /tmp/smoke_response.json
fi

# ── CHECK 5: Listar productos de un restaurante ───────────────────────────────
echo ""
echo "[ 5/7 ] Listar productos del primer restaurante"
if [ -n "$RESTAURANT_ID" ] && [ "$RESTAURANT_ID" != "null" ]; then
  STATUS=$(http_get "$BASE_URL/catalog/restaurants/$RESTAURANT_ID/products")
  PRODUCT_COUNT=$(response_field '.products | length' 2>/dev/null || echo "0")
  PRODUCT_ID=$(response_field '.products[0].id' 2>/dev/null || echo "")
  PRODUCT_PRICE=$(response_field '.products[0].price' 2>/dev/null || echo "10")
  if [ "$STATUS" = "200" ]; then
    log_pass "GET /catalog/restaurants/:id/products → $STATUS ($PRODUCT_COUNT productos)"
  else
    log_fail "GET /catalog/restaurants/:id/products → $STATUS"
    cat /tmp/smoke_response.json
  fi
else
  log_fail "Sin restaurante disponible para consultar productos"
  PRODUCT_ID=""
  PRODUCT_PRICE="10"
fi

# ── CHECK 6: Crear pedido ─────────────────────────────────────────────────────
echo ""
echo "[ 6/7 ] Crear un pedido"
ORDER_ID=""
if [ -n "$TOKEN" ] && [ -n "$RESTAURANT_ID" ] && [ "$RESTAURANT_ID" != "null" ]; then
  ITEM_PRODUCT_ID="${PRODUCT_ID:-00000000-0000-0000-0000-000000000001}"
  STATUS=$(http_post "$BASE_URL/orders" "{
    \"restaurantId\": \"$RESTAURANT_ID\",
    \"items\": [{
      \"productId\": \"$ITEM_PRODUCT_ID\",
      \"quantity\": 1,
      \"price\": ${PRODUCT_PRICE:-10}
    }],
    \"deliveryAddress\": \"Calle Smoke Test 123\"
  }")
  ORDER_ID=$(response_field '.order.id' 2>/dev/null || echo "")
  ORDER_SUCCESS=$(response_field '.success')
  if [ "$STATUS" = "200" ] && [ "$ORDER_SUCCESS" = "true" ] && [ -n "$ORDER_ID" ]; then
    log_pass "POST /orders → $STATUS (orderId: ${ORDER_ID:0:8}...)"
  else
    log_fail "POST /orders → $STATUS, success=$ORDER_SUCCESS"
    cat /tmp/smoke_response.json
  fi
else
  log_fail "Sin token o restaurante — no se puede crear pedido"
fi

# ── CHECK 7: Consultar estado del pedido ──────────────────────────────────────
echo ""
echo "[ 7/7 ] Consultar estado del pedido creado"
if [ -n "$TOKEN" ] && [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  STATUS=$(http_get "$BASE_URL/orders/$ORDER_ID")
  ORDER_STATUS=$(response_field '.order.status' 2>/dev/null || echo "")
  if [ "$STATUS" = "200" ] && [ -n "$ORDER_STATUS" ]; then
    log_pass "GET /orders/:id → $STATUS (estado: $ORDER_STATUS)"
  else
    log_fail "GET /orders/:id → $STATUS, status=$ORDER_STATUS"
    cat /tmp/smoke_response.json
  fi
else
  log_fail "Sin orderId — no se puede consultar estado"
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================================="
echo " RESULTADOS DEL SMOKE TEST"
echo "======================================================="
echo -e " ${GREEN}✓ Passed${NC}: $PASS"
echo -e " ${RED}✗ Failed${NC}: $FAIL"
echo " Total  : $((PASS + FAIL))"
echo "======================================================="

if [ "$FAIL" -gt 0 ]; then
  echo -e " ${RED}SMOKE TEST FALLIDO${NC}"
  exit 1
else
  echo -e " ${GREEN}SMOKE TEST EXITOSO${NC}"
  exit 0
fi
