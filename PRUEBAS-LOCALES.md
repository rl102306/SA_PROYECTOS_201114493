# 🧪 Guía de Pruebas Locales - Delivereats

## 📋 Prerequisitos

1. **Docker Desktop instalado y corriendo**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Cuenta de Gmail configurada**
   - Habilita 2FA
   - Genera App Password

---

## 🚀 PASO 1: Descomprimir y Preparar

```bash
# Descomprimir
unzip delivereats-project-complete.zip
cd delivereats-project

# Verificar estructura
ls -la
# Deberías ver:
# - auth-service/
# - restaurant-catalog-service/
# - order-service/
# - delivery-service/       ← NUEVO
# - notification-service/   ← NUEVO
# - api-gateway/
# - frontend/
# - docker-compose.yml
```

---

## 🔧 PASO 2: Configurar SMTP

### Opción A: Gmail (Recomendado para pruebas)

1. **Obtener App Password de Gmail:**
   - Ve a: https://myaccount.google.com/security
   - Habilita "Verificación en dos pasos"
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Mail" y "Otro (nombre personalizado)"
   - Escribe "Delivereats"
   - Copia la contraseña generada (formato: xxxx xxxx xxxx xxxx)

2. **Crear archivo .env:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Editar .env:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

### Opción B: Mailtrap (Para desarrollo - emails de prueba)

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu-usuario-mailtrap
SMTP_PASSWORD=tu-password-mailtrap
```

Crea cuenta gratuita en: https://mailtrap.io

---

## 🐳 PASO 3: Levantar Servicios con Docker

```bash
# Levantar TODOS los servicios
docker-compose up -d --build

# Esto levantará 10 contenedores:
# ✅ auth-db
# ✅ catalog-db
# ✅ order-db
# ✅ delivery-db          ← NUEVO
# ✅ auth-service
# ✅ catalog-service
# ✅ order-service
# ✅ delivery-service     ← NUEVO
# ✅ notification-service ← NUEVO
# ✅ api-gateway
# ✅ frontend
```

**Espera 30-60 segundos** para que todo inicie.

---

## ✅ PASO 4: Verificar que Todo Está Corriendo

```bash
# Ver estado de contenedores
docker-compose ps

# Deberías ver todos con "Up"
```

### Ver logs en tiempo real:

```bash
# Todos los servicios
docker-compose logs -f

# Un servicio específico
docker-compose logs -f notification-service
docker-compose logs -f delivery-service
docker-compose logs -f order-service
```

Para salir: **Ctrl + C**

---

## 📦 PASO 5: Insertar Productos de Prueba

```bash
chmod +x insert-products.sh
./insert-products.sh
```

Deberías ver:
```
✅ Productos insertados correctamente
Productos disponibles:
  ✅ Pizza Margarita - $12.99
  ✅ Hamburguesa Clásica - $8.50
  ✅ Refresco - $2.00
  ❌ Ensalada César - $7.50 (NO DISPONIBLE)
  ✅ Pasta Carbonara - $11.50
```

---

## 🧪 PASO 6: Probar con el Frontend

### 1. Abrir navegador
```
http://localhost:4200
```

### 2. Registrarse
- Click en "Regístrate aquí"
- Email: **tu-email@gmail.com** (el mismo del SMTP)
- Nombre: Test
- Apellido: User
- Password: password123
- Rol: Cliente
- Click "Registrarse"

### 3. Login
- Email: tu-email@gmail.com
- Password: password123
- Click "Iniciar Sesión"

### 4. Crear Orden
- Selecciona "Restaurante Central"
- Click "+ Desde Catálogo"
- Selecciona "Pizza Margarita"
- Cantidad: 2
- Click "🚀 Realizar Pedido"

### 5. ¡Verifica tu email! 📧
Deberías recibir un correo con:
```
Subject: Orden #... - Confirmación de Pedido
Contenido:
- Número de Orden
- Productos: Pizza Margarita x2
- Monto Total: $25.98
- Estado: CREADA
```

---

## 🧪 PASO 7: Probar con Postman/cURL

### Test 1: Registrar Usuario

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123",
    "firstName": "Cliente",
    "lastName": "Uno",
    "role": "CLIENT"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "...",
    "email": "cliente1@test.com",
    "role": "CLIENT"
  }
}
```

### Test 2: Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@test.com",
    "password": "password123"
  }'
```

**Guarda el token:**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Test 3: Crear Orden (exitosa)

```bash
curl -X POST http://localhost:3000/orders \
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
    "deliveryAddress": "Calle 123, Ciudad"
  }'
```

**Logs que deberías ver:**

**Terminal 1 (Catalog-Service):**
```
catalog-service | 📦 Validando orden para restaurante 99999999...
catalog-service | ✅ Validación exitosa: 1 productos
```

**Terminal 2 (Order-Service):**
```
order-service | 🔍 Validando con Catalog Service vía gRPC...
order-service | ✅ Validación gRPC exitosa
order-service | ✅ Orden orden-uuid creada exitosamente
order-service | 📧 Enviando notificación de orden creada...
```

**Terminal 3 (Notification-Service):**
```
notification-service | 📧 Enviando notificación tipo ORDER_CREATED a cliente1@test.com
notification-service | ✅ Email enviado a cliente1@test.com
notification-service | ✅ Notificación enviada exitosamente
```

**Terminal 4 (Email):**
```
📧 Revisa tu email - deberías tener:
Subject: Orden #... - Confirmación de Pedido
```

### Test 4: Crear Orden (fallida - precio incorrecto)

```bash
curl -X POST http://localhost:3000/orders \
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
    ],
    "deliveryAddress": "Calle 123"
  }'
```

**Respuesta esperada:**
```json
{
  "success": false,
  "message": "Validación fallida: Precio incorrecto para Pizza Margarita. Actual: $12.99, Recibido: $5.00"
}
```

**Logs:**
```
catalog-service | ❌ Validación fallida: 1 errores
order-service   | ❌ Validación gRPC fallida
```

**Email:** NO se envía (porque la orden no se creó)

---

## 🚚 PASO 8: Probar Delivery-Service

### Ver entregas pendientes

```bash
# Primero crea una orden (usa Test 3)
# Luego lista entregas pendientes

curl -X GET http://localhost:3000/deliveries/pending \
  -H "Authorization: Bearer $TOKEN"
```

### Aceptar una entrega (como repartidor)

```bash
# Primero registra un repartidor
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "repartidor1@test.com",
    "password": "password123",
    "firstName": "Repartidor",
    "lastName": "Uno",
    "role": "DELIVERY"
  }'

# Login como repartidor
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "repartidor1@test.com",
    "password": "password123"
  }'

# Guarda el token del repartidor
DELIVERY_TOKEN="..."

# Aceptar entrega
curl -X POST http://localhost:3000/deliveries/DELIVERY_ID/accept \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DELIVERY_TOKEN" \
  -d '{
    "deliveryPersonName": "Repartidor Uno"
  }'
```

---

## 📊 PASO 9: Verificar Bases de Datos

### Ver usuarios registrados:
```bash
docker exec -it delivereats-auth-db psql -U auth_user -d auth_db -c "SELECT email, role FROM users;"
```

### Ver productos:
```bash
docker exec -it delivereats-catalog-db psql -U catalog_user -d catalog_db -c "SELECT name, price, is_available FROM products;"
```

### Ver órdenes:
```bash
docker exec -it delivereats-order-db psql -U order_user -d order_db -c "SELECT id, status, total_amount FROM orders;"
```

### Ver entregas:
```bash
docker exec -it delivereats-delivery-db psql -U delivery_user -d delivery_db -c "SELECT order_id, status, delivery_person_name FROM deliveries;"
```

---

## 🎯 Casos de Prueba Completos

### Caso 1: Flujo Exitoso Completo ✅

1. **Registrar cliente**
2. **Login cliente**
3. **Crear orden** → ✅ Orden creada + 📧 Email enviado
4. **Registrar restaurante**
5. **Login restaurante**
6. **Marcar orden como LISTA**
7. **Crear entrega** (automático)
8. **Registrar repartidor**
9. **Login repartidor**
10. **Aceptar entrega** → Estado: ASSIGNED
11. **Marcar PICKED_UP**
12. **Marcar IN_TRANSIT** → 📧 Email: "En camino"
13. **Marcar DELIVERED** → 📧 Email: "Entregado"

### Caso 2: Validación Fallida ❌

1. **Login cliente**
2. **Crear orden con precio incorrecto** → ❌ Error
3. **Crear orden con producto no disponible** → ❌ Error
4. **Crear orden con producto inexistente** → ❌ Error

### Caso 3: Cancelación por Cliente ❌

1. **Crear orden**
2. **Cancelar orden** → 📧 Email: "Orden cancelada"

---

## 🐛 Troubleshooting

### Problema: "Cannot connect to database"

```bash
# Ver logs del contenedor
docker-compose logs auth-db

# Reiniciar base de datos
docker-compose restart auth-db

# Esperar 10 segundos
sleep 10

# Verificar
docker-compose ps
```

### Problema: "Email no se envía"

```bash
# Ver logs de notification-service
docker-compose logs notification-service

# Verificar credenciales SMTP en .env
cat .env

# Probar credenciales manualmente
docker exec -it delivereats-notification-service sh
# Dentro del contenedor:
env | grep SMTP
```

### Problema: "Puerto ya en uso"

```bash
# Ver qué está usando el puerto
lsof -i :3000

# Matar proceso
kill -9 <PID>

# O cambiar puerto en docker-compose.yml
```

### Problema: "Servicio no inicia"

```bash
# Ver logs completos
docker-compose logs <servicio>

# Reconstruir
docker-compose up -d --build <servicio>

# Verificar sintaxis
docker-compose config
```

---

## 🧹 Limpiar y Empezar de Nuevo

```bash
# Detener todo
docker-compose down

# Limpiar TODO (⚠️ borra bases de datos)
docker-compose down -v

# Levantar de nuevo
docker-compose up -d --build

# Insertar productos
./insert-products.sh
```

---

## ✅ Checklist de Pruebas Locales

Antes de desplegar en la nube, verifica:

- [ ] Todos los contenedores corriendo (`docker-compose ps`)
- [ ] Registro de usuario funciona
- [ ] Login funciona y devuelve token
- [ ] Crear orden exitosa funciona
- [ ] Email se recibe en bandeja de entrada
- [ ] Validación de precio fallida funciona
- [ ] Validación de disponibilidad funciona
- [ ] Logs muestran comunicación gRPC
- [ ] Frontend carga correctamente
- [ ] Bases de datos tienen datos

---

¡Si TODO funciona localmente, estás listo para la nube! ☁️
