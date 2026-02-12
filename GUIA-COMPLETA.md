# 🎓 Guía Completa: Entendiendo y Probando Delivereats

## 📚 Índice
1. [¿Cómo funciona el ecosistema?](#cómo-funciona-el-ecosistema)
2. [Arquitectura visual](#arquitectura-visual)
3. [Preparación del ambiente](#preparación-del-ambiente)
4. [Levantar el proyecto](#levantar-el-proyecto)
5. [Pruebas paso a paso](#pruebas-paso-a-paso)
6. [Casos de prueba para las prácticas](#casos-de-prueba-para-las-prácticas)
7. [Troubleshooting](#troubleshooting)

---

## 🌐 ¿Cómo funciona el ecosistema?

### Componentes del Sistema

```
┌─────────────┐
│  FRONTEND   │  Puerto 4200 (Angular)
│  (Angular)  │  - Interfaz de usuario
└──────┬──────┘  - Login, Registro
       │         - Crear órdenes
       │ HTTP REST
       ▼
┌─────────────┐
│ API GATEWAY │  Puerto 3000 (Express)
│   (REST)    │  - Punto de entrada único
└──────┬──────┘  - Valida JWT
       │         - Enruta peticiones
       │ gRPC
       ├─────────────────┬──────────────┐
       ▼                 ▼              ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│AUTH SERVICE │   │ORDER SERVICE│   │   CATALOG   │
│  (gRPC)     │   │   (gRPC)    │   │  SERVICE    │
│ Port 50052  │   │ Port 50053  │   │  (gRPC)     │
└──────┬──────┘   └──────┬──────┘   │ Port 50051  │
       │                 │           └──────┬──────┘
       │                 │ gRPC             │
       │                 └──────────────────┤
       │                      Valida        │
       ▼                      Productos     ▼
┌─────────────┐           ┌─────────────┐  ┌─────────────┐
│  auth_db    │           │  order_db   │  │ catalog_db  │
│ Port 5432   │           │ Port 5434   │  │ Port 5433   │
└─────────────┘           └─────────────┘  └─────────────┘
```

### Flujo de una Orden (Práctica 3)

```
PASO 1: Usuario hace login
┌─────────┐  POST /auth/login   ┌─────────┐  gRPC Login  ┌─────────┐
│Frontend │ ───────────────────>│   API   │ ──────────────>│  Auth   │
│         │                     │ Gateway │                │ Service │
│         │<───── JWT Token ────│         │<───────────────│         │
└─────────┘                     └─────────┘                └─────────┘

PASO 2: Usuario crea una orden
┌─────────┐  POST /orders       ┌─────────┐  gRPC CreateOrder  ┌─────────┐
│Frontend │ ───────────────────>│   API   │ ──────────────────>│  Order  │
│         │  + JWT Token        │ Gateway │                    │ Service │
└─────────┘  + productos        └─────────┘                    └────┬────┘
                                                                     │
                                                                     │ gRPC
                                                                     │ ValidateOrder
                                                                     ▼
                                                              ┌─────────────┐
                                                              │  Catalog    │
                                                              │  Service    │
                                                              └──────┬──────┘
                                                                     │
                                      ┌──────────────────────────────┤
                                      │                              │
                            ✅ TODO OK │                    ❌ ERROR  │
                                      │                              │
                                      ▼                              ▼
                           Orden guardada en DB          Orden rechazada
                           Respuesta exitosa             con detalles del error
```

### ¿Qué hace cada servicio?

#### 🔐 **Auth Service** (Práctica 2)
- **Responsabilidad**: Gestionar usuarios y autenticación
- **Funciones**:
  - Registrar usuarios (Cliente, Admin, Restaurante, Repartidor)
  - Login con email/password
  - Generar JWT (tokens de sesión)
  - Validar JWT
- **Base de datos**: `auth_db` - tabla `users`
- **Principios SOLID**: ✅ Aplica los 5 principios

#### 📦 **Catalog Service** (Práctica 3 - Servidor)
- **Responsabilidad**: Gestionar productos de restaurantes
- **Funciones**:
  - Validar que productos existan
  - Validar que pertenezcan al restaurante correcto
  - Validar precios
  - Validar disponibilidad
- **Base de datos**: `catalog_db` - tabla `products`
- **gRPC Server**: Expone el método `ValidateOrder`

#### 🛒 **Order Service** (Práctica 3 - Cliente)
- **Responsabilidad**: Gestionar órdenes
- **Funciones**:
  - Crear órdenes
  - **ANTES de guardar**: Validar con Catalog Service vía gRPC
  - Solo guardar si la validación es exitosa
  - Listar órdenes del usuario
- **Base de datos**: `order_db` - tabla `orders`
- **gRPC Client**: Llama a Catalog Service

#### 🚪 **API Gateway**
- **Responsabilidad**: Punto de entrada único
- **Funciones**:
  - Recibe peticiones HTTP REST del frontend
  - Valida JWT en cada petición protegida
  - Convierte REST → gRPC
  - Enruta a los microservicios correctos
- **No tiene base de datos**: Solo enruta

#### 🎨 **Frontend**
- **Responsabilidad**: Interfaz de usuario
- **Funciones**:
  - Formularios de login/registro
  - Crear órdenes
  - Ver historial
- **Se comunica**: Solo con API Gateway (REST)

---

## 📁 Arquitectura Visual

### Estructura de Carpetas

```
delivereats-project/
│
├── auth-service/               ← Microservicio de autenticación
│   ├── src/
│   │   ├── domain/            ← Entidades y contratos (SOLID)
│   │   │   ├── entities/
│   │   │   │   └── User.ts    ← Entidad User
│   │   │   └── interfaces/
│   │   │       ├── IUserRepository.ts
│   │   │       ├── IPasswordHasher.ts
│   │   │       └── IJwtGenerator.ts
│   │   ├── application/       ← Casos de uso
│   │   │   ├── dtos/
│   │   │   └── usecases/
│   │   │       ├── RegisterUserUseCase.ts
│   │   │       └── LoginUserUseCase.ts
│   │   └── infrastructure/    ← Implementaciones
│   │       ├── adapters/      ← Bcrypt, JWT
│   │       ├── database/      ← PostgreSQL
│   │       ├── grpc/          ← Servidor gRPC
│   │       └── di/            ← Inyección de dependencias
│   ├── Dockerfile
│   └── package.json
│
├── restaurant-catalog-service/ ← Catálogo (Servidor gRPC)
│   ├── src/
│   │   ├── domain/
│   │   │   └── entities/
│   │   │       └── Product.ts
│   │   ├── application/
│   │   │   └── usecases/
│   │   │       └── ValidateOrderUseCase.ts  ← VALIDACIÓN
│   │   └── infrastructure/
│   │       └── grpc/
│   │           ├── proto/
│   │           │   └── catalog.proto
│   │           └── handlers/
│   │               └── CatalogServiceHandler.ts
│   └── ...
│
├── order-service/             ← Órdenes (Cliente gRPC)
│   ├── src/
│   │   ├── domain/
│   │   │   └── entities/
│   │   │       └── Order.ts
│   │   ├── application/
│   │   │   └── usecases/
│   │   │       └── CreateOrderUseCase.ts  ← USA gRPC
│   │   └── infrastructure/
│   │       └── grpc/
│   │           ├── proto/
│   │           │   └── catalog.proto
│   │           └── clients/
│   │               └── CatalogServiceClient.ts  ← Cliente
│   └── ...
│
├── api-gateway/               ← Gateway REST
│   ├── src/
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   └── orderRoutes.ts
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts
│   │   └── grpc/
│   │       └── clients/       ← Clientes gRPC
│   └── ...
│
├── frontend/                  ← Angular
│   └── src/
│       └── app/
│           ├── features/
│           │   └── auth/
│           └── core/
│               └── services/
│                   └── auth.service.ts
│
└── docker-compose.yml         ← Orquestación de TODO
```

---

## 🛠️ Preparación del Ambiente

### Requisitos Previos

1. **Instalar Docker Desktop**
   - Windows/Mac: https://www.docker.com/products/docker-desktop
   - Verificar instalación:
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Descomprimir el proyecto**
   ```bash
   # Descomprimir el ZIP
   unzip delivereats-project-complete.zip
   cd delivereats-project
   ```

3. **Verificar estructura**
   ```bash
   ls -la
   # Deberías ver:
   # - auth-service/
   # - restaurant-catalog-service/
   # - order-service/
   # - api-gateway/
   # - frontend/
   # - docker-compose.yml
   # - README.md
   ```

---

## 🚀 Levantar el Proyecto

### Opción 1: Con Docker (RECOMENDADO)

```bash
# 1. Ir a la carpeta del proyecto
cd delivereats-project

# 2. Levantar TODOS los servicios
docker-compose up -d

# Esto levantará:
# ✅ 3 bases de datos (auth-db, catalog-db, order-db)
# ✅ 3 microservicios (auth, catalog, order)
# ✅ 1 API Gateway
# ✅ 1 Frontend
```

### ⏳ Esperar a que todo esté listo

```bash
# Ver el estado de los contenedores
docker-compose ps

# Deberías ver 8 contenedores "Up"
```

### 📊 Ver los logs

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f auth-service
docker-compose logs -f order-service
docker-compose logs -f catalog-service
docker-compose logs -f api-gateway

# Para salir de los logs: Ctrl + C
```

### ✅ Verificar que todo está corriendo

```bash
# Verificar API Gateway
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"OK","service":"API Gateway","timestamp":"..."}
```

---

## 🧪 Pruebas Paso a Paso

### Herramientas para hacer pruebas

**Opción 1: Postman** (Recomendado)
- Descargar: https://www.postman.com/downloads/

**Opción 2: cURL** (Línea de comandos)
- Ya viene instalado en Linux/Mac
- Windows: usar Git Bash o WSL

**Opción 3: Frontend** (http://localhost:4200)
- Interfaz visual para probar

---

## 📝 Casos de Prueba

### 🔐 PRUEBA 1: Registro de Usuario (Práctica 2)

#### Con cURL:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@delivereats.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }'
```

#### Con Postman:
```
POST http://localhost:3000/auth/register
Body (JSON):
{
  "email": "cliente1@delivereats.com",
  "password": "password123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "CLIENT"
}
```

#### ✅ Respuesta Esperada:
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "uuid-generado",
    "email": "cliente1@delivereats.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }
}
```

#### 🔍 Ver en los logs:
```bash
docker-compose logs auth-service | grep "Usuario registrado"
# Deberías ver: ✅ Usuario registrado: cliente1@delivereats.com (CLIENT)
```

#### 💾 Ver en la base de datos:
```bash
# Conectarse a la base de datos
docker-compose exec auth-db psql -U auth_user -d auth_db

# Ver usuarios
SELECT id, email, first_name, last_name, role FROM users;

# Salir
\q
```

---

### 🔐 PRUEBA 2: Login (Práctica 2)

#### Con cURL:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente1@delivereats.com",
    "password": "password123"
  }'
```

#### ✅ Respuesta Esperada:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1dWlkIiwiZW1haWwiOiJjbGllbnRlMUBkZWxpdmVyZWF0cy5jb20iLCJyb2xlIjoiQ0xJRU5UIiwiaWF0IjoxNzA3NjM2MDAwLCJleHAiOjE3MDc3MjI0MDB9.xyz",
  "user": {
    "id": "uuid",
    "email": "cliente1@delivereats.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }
}
```

#### 📋 IMPORTANTE: Guardar el token
```bash
# Guardar el token en una variable (Linux/Mac/Git Bash)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# En Postman: Copiarlo para usar en las siguientes peticiones
```

---

### 📦 PRUEBA 3: Crear Productos (Preparación)

Para probar la validación de órdenes, primero necesitamos productos en el catálogo.

#### Insertar productos de prueba:
```bash
# Conectarse a la base de datos de catálogo
docker-compose exec catalog-db psql -U catalog_user -d catalog_db

# Insertar productos
INSERT INTO products (id, restaurant_id, name, description, price, category, is_available, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Pizza Margarita', 'Pizza clásica con tomate y mozzarella', 12.99, 'Pizzas', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'Hamburguesa Clásica', 'Hamburguesa con queso y vegetales', 8.50, 'Hamburguesas', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Refresco', 'Coca-Cola 500ml', 2.00, 'Bebidas', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'Ensalada César', 'Ensalada fresca con pollo', 7.50, 'Ensaladas', false, NOW(), NOW());

# Verificar
SELECT id, name, price, is_available FROM products;

# Salir
\q
```

**Productos creados:**
- ✅ Pizza Margarita ($12.99) - DISPONIBLE
- ✅ Hamburguesa Clásica ($8.50) - DISPONIBLE
- ✅ Refresco ($2.00) - DISPONIBLE
- ❌ Ensalada César ($7.50) - NO DISPONIBLE

---

### 🛒 PRUEBA 4: Crear Orden EXITOSA (Práctica 3)

Esta es la prueba principal que demuestra la comunicación gRPC.

#### Con cURL:
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
      },
      {
        "productId": "22222222-2222-2222-2222-222222222222",
        "quantity": 1,
        "price": 8.50
      }
    ],
    "deliveryAddress": "Calle 123, Ciudad"
  }'
```

#### ✅ Respuesta Esperada:
```json
{
  "success": true,
  "message": "Orden creada exitosamente",
  "order": {
    "id": "orden-uuid",
    "userId": "usuario-uuid",
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [...],
    "status": "PENDING",
    "totalAmount": 34.48,
    "deliveryAddress": "Calle 123, Ciudad",
    "createdAt": "2026-02-11T..."
  }
}
```

#### 🔍 Ver el flujo completo en los logs:

**Terminal 1 - Order Service:**
```bash
docker-compose logs -f order-service
```
Verás:
```
📦 Creando orden para usuario ... en restaurante ...
📦 Productos: 2
🔍 Validando orden con Catalog Service vía gRPC...
📡 Enviando validación gRPC para 2 productos...
✅ Validación gRPC exitosa
✅ Validación exitosa - procediendo a crear orden
✅ Orden orden-uuid creada exitosamente - Total: $34.48
```

**Terminal 2 - Catalog Service:**
```bash
docker-compose logs -f catalog-service
```
Verás:
```
📦 Validando orden para restaurante 99999999-9999-9999-9999-999999999999 con 2 productos
✅ Validación exitosa para restaurante 99999999-9999-9999-9999-999999999999: 2 productos
```

---

### ❌ PRUEBA 5: Orden con PRECIO INCORRECTO (Práctica 3)

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
    ]
  }'
```

#### ❌ Respuesta Esperada:
```json
{
  "success": false,
  "message": "Validación de orden fallida: 11111111-1111-1111-1111-111111111111: Precio incorrecto para Pizza Margarita. Precio actual: $12.99, Precio recibido: $5.00"
}
```

#### 🔍 Logs:
```
catalog-service | ❌ Validación fallida para restaurante ...: 1 errores
order-service   | ❌ Validación fallida: ...
```

---

### ❌ PRUEBA 6: Producto NO DISPONIBLE (Práctica 3)

```bash
curl -X POST http://localhost:3000/orders \
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
  }'
```

#### ❌ Respuesta Esperada:
```json
{
  "success": false,
  "message": "Validación de orden fallida: 44444444-4444-4444-4444-444444444444: Producto 44444444-4444-4444-4444-444444444444 (Ensalada César) no está disponible"
}
```

---

### ❌ PRUEBA 7: Producto NO EXISTE (Práctica 3)

```bash
curl -X POST http://localhost:3000/orders \
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
  }'
```

#### ❌ Respuesta Esperada:
```json
{
  "success": false,
  "message": "Validación de orden fallida: ffffffff-ffff-ffff-ffff-ffffffffffff: Producto ffffffff-ffff-ffff-ffff-ffffffffffff no encontrado"
}
```

---

## 📊 Resumen de Pruebas para Entregables

### Para Práctica 2 (Auth Service + JWT):

✅ **5 Pruebas de Registro Exitoso:**
```bash
# Cliente
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"cliente1@test.com","password":"pass12345","firstName":"Juan","lastName":"Pérez","role":"CLIENT"}'

# Admin
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"admin1@test.com","password":"pass12345","firstName":"Admin","lastName":"Sistema","role":"ADMIN"}'

# Restaurante
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"rest1@test.com","password":"pass12345","firstName":"Restaurante","lastName":"Uno","role":"RESTAURANT"}'

# Repartidor
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"delivery1@test.com","password":"pass12345","firstName":"Repartidor","lastName":"Uno","role":"DELIVERY"}'

# Registro duplicado (error)
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"cliente1@test.com","password":"pass12345","firstName":"Juan","lastName":"Pérez","role":"CLIENT"}'
```

✅ **5 Pruebas de Login:**
```bash
# Login exitoso
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"cliente1@test.com","password":"pass12345"}'

# Login con contraseña incorrecta
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"cliente1@test.com","password":"wrongpass"}'

# Login con email inexistente
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"noexiste@test.com","password":"pass12345"}'
```

### Para Práctica 3 (Validación gRPC):

✅ **5 Órdenes Exitosas:**
```bash
# Orden 1
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"11111111-1111-1111-1111-111111111111","quantity":2,"price":12.99}]}'

# Orden 2
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"22222222-2222-2222-2222-222222222222","quantity":1,"price":8.50}]}'

# Orden 3 (múltiples productos)
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"11111111-1111-1111-1111-111111111111","quantity":1,"price":12.99},{"productId":"33333333-3333-3333-3333-333333333333","quantity":2,"price":2.00}]}'
```

✅ **5 Órdenes Fallidas:**
```bash
# Fallo 1: Precio incorrecto
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"11111111-1111-1111-1111-111111111111","quantity":1,"price":5.00}]}'

# Fallo 2: Producto no disponible
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"44444444-4444-4444-4444-444444444444","quantity":1,"price":7.50}]}'

# Fallo 3: Producto no existe
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"ffffffff-ffff-ffff-ffff-ffffffffffff","quantity":1,"price":10.00}]}'
```

---

## 📸 Capturar Logs para Entregables

### Guardar logs en archivo:
```bash
# Logs de validación exitosa
docker-compose logs order-service catalog-service > logs-exitosos.txt

# Logs de validación fallida
docker-compose logs order-service catalog-service > logs-fallidos.txt
```

---

## 🔧 Comandos Útiles

### Ver estado:
```bash
docker-compose ps
```

### Reiniciar un servicio:
```bash
docker-compose restart order-service
docker-compose restart catalog-service
```

### Ver logs en tiempo real:
```bash
docker-compose logs -f order-service catalog-service
```

### Detener todo:
```bash
docker-compose down
```

### Limpiar y empezar de cero:
```bash
docker-compose down -v  # ⚠️ BORRA LAS BASES DE DATOS
docker-compose up -d
```

### Acceder a un contenedor:
```bash
docker-compose exec order-service sh
docker-compose exec catalog-db psql -U catalog_user -d catalog_db
```

---

## ❓ Troubleshooting

### Problema: Puerto ya en uso
```bash
Error: bind: address already in use
```
**Solución:**
```bash
# Ver qué está usando el puerto
lsof -i :3000
lsof -i :4200
lsof -i :5432

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en docker-compose.yml
```

### Problema: Servicio no responde
```bash
# Ver logs del servicio
docker-compose logs order-service

# Reiniciar
docker-compose restart order-service

# Reconstruir si hay cambios en código
docker-compose up -d --build order-service
```

### Problema: Error de conexión gRPC
```bash
Error: 14 UNAVAILABLE: No connection established
```
**Solución:**
```bash
# Verificar que catalog-service está corriendo
docker-compose ps catalog-service

# Ver logs
docker-compose logs catalog-service

# Verificar la variable de entorno
docker-compose exec order-service env | grep CATALOG
```

### Problema: Base de datos vacía
```bash
# Reinicializar base de datos
docker-compose restart catalog-db
docker-compose restart catalog-service

# Insertar productos de prueba de nuevo
```

---

## ✅ Checklist Final

Antes de entregar, verifica:

- [ ] ✅ Todos los contenedores corriendo: `docker-compose ps`
- [ ] ✅ 5 registros exitosos documentados
- [ ] ✅ 5 logins exitosos documentados  
- [ ] ✅ 5 órdenes creadas exitosamente (con logs)
- [ ] ✅ 5 órdenes rechazadas con errores específicos (con logs)
- [ ] ✅ Logs guardados mostrando la comunicación gRPC
- [ ] ✅ Screenshots de Postman o cURL
- [ ] ✅ README actualizado con tu información
- [ ] ✅ Repositorio con tag v0.3.0
- [ ] ✅ Auxiliar agregado como colaborador

---

## 🎓 Conceptos Clave para Defender

1. **¿Por qué gRPC y no REST entre microservicios?**
   - Más rápido (binario vs JSON)
   - Tipado fuerte con Protocol Buffers
   - Ideal para comunicación interna

2. **¿Cómo se aplican los principios SOLID?**
   - SRP: Cada caso de uso tiene una responsabilidad
   - OCP: Interfaces permiten extensión
   - LSP: Implementaciones son intercambiables
   - ISP: Interfaces pequeñas y específicas
   - DIP: Dependemos de abstracciones

3. **¿Por qué validar antes de guardar?**
   - Evita datos inconsistentes
   - Detecta errores temprano
   - Mantiene integridad del sistema

4. **¿Qué pasa si Catalog Service está caído?**
   - Order Service recibe error gRPC
   - No se crea la orden
   - Usuario recibe mensaje de error claro

---

¡Listo! Con esta guía puedes levantar, entender y probar todo el ecosistema. 🚀
