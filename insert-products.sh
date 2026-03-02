#!/bin/bash
# Script para insertar productos de prueba en la base de datos del Catalog-Service
# Uso: ./insert-products.sh
# Prerrequisito: docker-compose corriendo (catalog-db debe estar activo)

echo "📦 Insertando productos de prueba en la base de datos..."
echo ""

# Ejecutar comandos SQL dentro del contenedor catalog-db vía psql
# -T desactiva la asignación de pseudo-TTY (necesario para usar heredoc sin terminal interactivo)
docker-compose exec -T catalog-db psql -U catalog_user -d catalog_db << EOF

-- Limpiar productos existentes para evitar duplicados en cada ejecución del script
DELETE FROM products;

-- Insertar 5 productos de prueba con IDs fijos para que test-all.sh los pueda referenciar
-- Los IDs fijos permiten que las pruebas sean reproducibles y consistentes
INSERT INTO products (id, restaurant_id, name, description, price, category, is_available, created_at, updated_at)
VALUES
  -- Producto 1: Pizza disponible — precio 12.99 (usado en test-all.sh para validar precio correcto)
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Pizza Margarita', 'Pizza clásica con tomate y mozzarella', 12.99, 'Pizzas', true, NOW(), NOW()),
  -- Producto 2: Hamburguesa disponible — precio 8.50
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'Hamburguesa Clásica', 'Hamburguesa con queso y vegetales', 8.50, 'Hamburguesas', true, NOW(), NOW()),
  -- Producto 3: Bebida disponible — precio 2.00 (usado para órdenes con múltiples items)
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Refresco', 'Coca-Cola 500ml', 2.00, 'Bebidas', true, NOW(), NOW()),
  -- Producto 4: Ensalada NO disponible (is_available=false) — usado para probar rechazo de pedidos
  ('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'Ensalada César', 'Ensalada fresca con pollo', 7.50, 'Ensaladas', false, NOW(), NOW()),
  -- Producto 5: Pasta disponible — precio 11.50 (usado en pruebas de pago con DIGITAL_WALLET)
  ('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'Pasta Carbonara', 'Pasta con salsa carbonara', 11.50, 'Pastas', true, NOW(), NOW());

-- Mostrar los productos recién insertados para confirmar que se guardaron correctamente
SELECT id, name, price, is_available FROM products ORDER BY name;

EOF

echo ""
echo "✅ Productos insertados correctamente"
echo ""
echo "Productos disponibles:"
echo "  ✅ Pizza Margarita - \$12.99"
echo "  ✅ Hamburguesa Clásica - \$8.50"
echo "  ✅ Refresco - \$2.00"
echo "  ❌ Ensalada César - \$7.50 (NO DISPONIBLE — usada para prueba de rechazo)"
echo "  ✅ Pasta Carbonara - \$11.50"
echo ""
echo "Restaurante ID: 99999999-9999-9999-9999-999999999999"
