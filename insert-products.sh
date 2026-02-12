#!/bin/bash

# Script para insertar productos de prueba en la base de datos

echo "📦 Insertando productos de prueba en la base de datos..."
echo ""

docker-compose exec -T catalog-db psql -U catalog_user -d catalog_db << EOF

-- Limpiar productos existentes
DELETE FROM products;

-- Insertar productos de prueba
INSERT INTO products (id, restaurant_id, name, description, price, category, is_available, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Pizza Margarita', 'Pizza clásica con tomate y mozzarella', 12.99, 'Pizzas', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'Hamburguesa Clásica', 'Hamburguesa con queso y vegetales', 8.50, 'Hamburguesas', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Refresco', 'Coca-Cola 500ml', 2.00, 'Bebidas', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'Ensalada César', 'Ensalada fresca con pollo', 7.50, 'Ensaladas', false, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'Pasta Carbonara', 'Pasta con salsa carbonara', 11.50, 'Pastas', true, NOW(), NOW());

-- Verificar productos insertados
SELECT id, name, price, is_available FROM products ORDER BY name;

EOF

echo ""
echo "✅ Productos insertados correctamente"
echo ""
echo "Productos disponibles:"
echo "  ✅ Pizza Margarita - \$12.99"
echo "  ✅ Hamburguesa Clásica - \$8.50"
echo "  ✅ Refresco - \$2.00"
echo "  ❌ Ensalada César - \$7.50 (NO DISPONIBLE)"
echo "  ✅ Pasta Carbonara - \$11.50"
echo ""
echo "Restaurante ID: 99999999-9999-9999-9999-999999999999"
