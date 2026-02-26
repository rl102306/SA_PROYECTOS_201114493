# 🎓 PROYECTO COMPLETO - Delivereats con 6 Microservicios

## 📦 Servicios Implementados

### ✅ 1. API Gateway (Puerto 3000)
- REST API para el frontend
- Validación de JWT
- Enrutamiento a servicios gRPC
- CORS habilitado

### ✅ 2. Auth-Service (Puerto 50052)
- Registro de usuarios (4 roles: CLIENT, ADMIN, RESTAURANT, DELIVERY)
- Login con JWT
- Bcrypt para passwords
- PostgreSQL (puerto 5432)

### ✅ 3. Restaurant-Catalog-Service (Puerto 50051)
- Gestión de productos
- Validación de órdenes vía gRPC
- Verificación de existencia, pertenencia, disponibilidad y precios
- PostgreSQL (puerto 5433)

### ✅ 4. Order-Service (Puerto 50053)
- Crear órdenes
- Validación con Catalog-Service vía gRPC
- Estados: PENDING, CONFIRMED, PREPARING, READY, IN_TRANSIT, DELIVERED, CANCELLED, REJECTED
- PostgreSQL (puerto 5434)

### ✅ 5. Delivery-Service (Puerto 50054) **NUEVO**
- Aceptar entregas (repartidores)
- Actualizar estado de entrega
- Estados: PENDING, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, CANCELLED
- PostgreSQL (puerto 5435)

### ✅ 6. Notification-Service (Puerto 50055) **NUEVO**
- Envío de correos electrónicos
- 7 tipos de notificaciones:
  - Orden creada
  - Orden cancelada (cliente/restaurante/repartidor)
  - Orden rechazada
  - Orden en tránsito
  - Orden entregada
- Nodemailer con SMTP

---

## 🚀 Inicio Rápido

### 1. Configurar SMTP

Copia `.env.example` a `.env` y configura tu SMTP:

```bash
cp .env.example .env
nano .env
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
```

### 2. Levantar todo con Docker

```bash
docker-compose up -d --build
```

Esto levanta:
- 4 bases de datos PostgreSQL
- 6 microservicios
- 1 API Gateway
- 1 Frontend Angular

### 3. Insertar datos de prueba

```bash
./insert-products.sh
```

### 4. Acceder al frontend

Abre: http://localhost:4200

---

## 🔄 Flujo Completo del Sistema

```
1. CLIENTE se registra/login
   Frontend → API Gateway → Auth-Service
   ↓ JWT Token

2. CLIENTE crea una orden
   Frontend → API Gateway → Order-Service
   ↓
   Order-Service valida con Catalog-Service (gRPC)
   ↓ ✅ Validación OK
   Order-Service guarda orden (estado: PENDING)
   ↓
   Order-Service → Notification-Service (gRPC)
   ↓ 📧 Email: "Orden creada"

3. RESTAURANTE recibe la orden
   Frontend → API Gateway → Order-Service
   ↓
   Restaurante marca como "EN PROCESO"
   ↓
   Restaurante marca como "LISTA"
   ↓
   Order-Service → Delivery-Service (gRPC)
   Delivery-Service crea entrega (estado: PENDING)

4. REPARTIDOR acepta la entrega
   Frontend → API Gateway → Delivery-Service
   ↓
   Delivery-Service asigna repartidor (estado: ASSIGNED)
   ↓
   Repartidor recoge pedido (estado: PICKED_UP)
   ↓
   Repartidor marca "EN TRÁNSITO" (estado: IN_TRANSIT)
   ↓
   Delivery-Service → Notification-Service (gRPC)
   ↓ 📧 Email: "Tu orden está en camino"

5. ENTREGA completada
   Repartidor marca como "ENTREGADA" (estado: DELIVERED)
   ↓
   Delivery-Service → Notification-Service (gRPC)
   ↓ 📧 Email: "Orden entregada"
```

---

## 🗂️ Estructura del Proyecto

```
delivereats-project/
├── api-gateway/              # REST → gRPC
├── auth-service/             # Usuarios y JWT
├── restaurant-catalog-service/  # Productos y validación
├── order-service/            # Órdenes
├── delivery-service/         # Entregas (NUEVO)
├── notification-service/     # Emails (NUEVO)
├── frontend/                 # Angular
├── docker-compose.yml        # Orquestación de TODO
└── .env                      # Configuración SMTP
```

---

## 📡 Comunicación entre Servicios

### REST (Frontend ↔ API Gateway)
```
Frontend ---HTTP/REST---> API Gateway
```

### gRPC (Microservicios internos)
```
Order-Service ---gRPC---> Catalog-Service (validación)
Order-Service ---gRPC---> Delivery-Service (crear entrega)
Order-Service ---gRPC---> Notification-Service (emails)
Delivery-Service ---gRPC---> Notification-Service (emails)
```

---

## 🎯 Funcionalidades por Rol

### CLIENTE
- ✅ Registro/Login
- ✅ Ver catálogo de productos
- ✅ Crear orden
- ✅ Cancelar orden
- ✅ Ver estado de orden
- ✅ Recibir notificaciones por email

### RESTAURANTE
- ✅ Gestión de productos (CRUD)
- ✅ Recibir órdenes
- ✅ Aceptar/Rechazar órdenes
- ✅ Marcar orden como "EN PROCESO"
- ✅ Marcar orden como "LISTA"

### REPARTIDOR (DELIVERY)
- ✅ Ver entregas pendientes
- ✅ Aceptar entrega
- ✅ Marcar como "Recogido"
- ✅ Marcar como "En tránsito"
- ✅ Marcar como "Entregado"
- ✅ Cancelar entrega

### ADMINISTRADOR
- ✅ Gestión de restaurantes (CRUD)
- ✅ Ver todas las órdenes
- ✅ Ver estadísticas

---

## 🔌 Puertos Utilizados

| Servicio | Puerto | Tipo |
|----------|--------|------|
| Frontend | 4200 | HTTP |
| API Gateway | 3000 | HTTP REST |
| Auth-Service | 50052 | gRPC |
| Catalog-Service | 50051 | gRPC |
| Order-Service | 50053 | gRPC |
| Delivery-Service | 50054 | gRPC |
| Notification-Service | 50055 | gRPC |
| Auth DB | 5432 | PostgreSQL |
| Catalog DB | 5433 | PostgreSQL |
| Order DB | 5434 | PostgreSQL |
| Delivery DB | 5435 | PostgreSQL |

---

## 🧪 Pruebas

### Caso 1: Crear orden exitosa
```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# 2. Crear orden
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "11111111-1111-1111-1111-111111111111", "quantity": 2, "price": 12.99}]
  }'

# ✅ Resultado: Orden creada + Email enviado
```

### Caso 2: Validación fallida (precio incorrecto)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "11111111-1111-1111-1111-111111111111", "quantity": 1, "price": 5.00}]
  }'

# ❌ Resultado: "Precio incorrecto. Actual: $12.99, Recibido: $5.00"
```

---

## 📧 Configuración de Email

### Opción 1: Gmail

1. Habilita 2FA en tu cuenta de Google
2. Ve a: https://myaccount.google.com/apppasswords
3. Genera una contraseña para "Mail"
4. Usa esa contraseña en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
```

### Opción 2: SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=tu-api-key-de-sendgrid
```

### Opción 3: Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@tu-dominio.mailgun.org
SMTP_PASSWORD=tu-password-mailgun
```

---

## 🐳 Comandos Docker Útiles

```bash
# Ver todos los servicios
docker-compose ps

# Ver logs de un servicio
docker-compose logs -f delivery-service
docker-compose logs -f notification-service

# Reiniciar un servicio
docker-compose restart delivery-service

# Reconstruir un servicio
docker-compose up -d --build delivery-service

# Detener todo
docker-compose down

# Limpiar todo (⚠️ borra datos)
docker-compose down -v
```

---

## 🏗️ Arquitectura de Capas (Clean Architecture)

Cada servicio sigue:

```
domain/           # Entidades y contratos (sin dependencias)
├── entities/     # Order, Delivery, Notification
└── interfaces/   # IOrderRepository, IDeliveryRepository

application/      # Casos de uso (lógica de negocio)
├── dtos/         # Data Transfer Objects
└── usecases/     # CreateOrder, AcceptDelivery, SendNotification

infrastructure/   # Implementaciones técnicas
├── database/     # PostgreSQL
├── grpc/         # Servidor y cliente gRPC
├── email/        # Nodemailer
└── di/           # Dependency Injection
```

---

## 📊 Base de Datos

### auth_db
```sql
TABLE users (
  id, email, password, first_name, last_name, role, created_at, updated_at
)
```

### catalog_db
```sql
TABLE products (
  id, restaurant_id, name, description, price, category, is_available, image_url, created_at, updated_at
)
```

### order_db
```sql
TABLE orders (
  id, user_id, restaurant_id, items, status, total_amount, delivery_address, created_at, updated_at
)
```

### delivery_db (NUEVO)
```sql
TABLE deliveries (
  id, order_id, delivery_person_id, delivery_person_name, status,
  pickup_address, delivery_address, estimated_time, actual_delivery_time,
  cancellation_reason, created_at, updated_at
)
```

---

## 🎓 Cumplimiento de Requisitos del Proyecto

| Requisito | Estado | Ubicación |
|-----------|--------|-----------|
| **6 Microservicios** | ✅ | Todos implementados |
| **API Gateway** | ✅ | api-gateway/ |
| **Auth con JWT** | ✅ | auth-service/ |
| **gRPC** | ✅ | catalog.proto, delivery.proto, notification.proto |
| **Clean Architecture** | ✅ | domain/application/infrastructure |
| **SOLID** | ✅ | Interfaces, DI, SRP |
| **Docker Compose** | ✅ | docker-compose.yml |
| **PostgreSQL** | ✅ | 4 bases de datos |
| **Frontend** | ✅ | Angular |
| **Notificaciones** | ✅ | Nodemailer + SMTP |
| **Control de versiones** | ✅ | Git + GitHub |

---

## 📝 Próximos Pasos

1. **Probar localmente** con `docker-compose up -d`
2. **Configurar SMTP** en `.env`
3. **Probar el flujo completo** (orden → entrega → notificación)
4. **Desplegar en la nube** (GCP/AWS/Azure) - siguiente fase
5. **Crear tag** v0.4.0
6. **Documentar** casos de prueba

---

¡Proyecto completo con los 6 microservicios! 🎉
