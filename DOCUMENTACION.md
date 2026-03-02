# Delivereats — Documentacion Completa del Proyecto

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Carnet: 201114493**

---

## Tabla de Contenidos

1. [Vision General](#1-vision-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Microservicios](#3-microservicios)
   - [Auth Service](#31-auth-service)
   - [Catalog Service](#32-catalog-service-restaurant-catalog-service)
   - [Order Service](#33-order-service)
   - [Delivery Service](#34-delivery-service)
   - [FX Service](#35-fx-service)
   - [Payment Service](#36-payment-service)
   - [Notification Service](#37-notification-service)
   - [API Gateway](#38-api-gateway)
4. [Frontend Angular](#4-frontend-angular)
5. [Comunicacion gRPC](#5-comunicacion-grpc)
6. [Bases de Datos](#6-bases-de-datos)
7. [Flujos de Negocio](#7-flujos-de-negocio)
8. [Docker y Docker Compose](#8-docker-y-docker-compose)
9. [Kubernetes](#9-kubernetes)
10. [Variables de Entorno](#10-variables-de-entorno)
11. [Clean Architecture y SOLID](#11-clean-architecture-y-solid)

---

## 1. Vision General

**Delivereats** es una plataforma de delivery de comida construida como sistema de microservicios. Permite a clientes ordenar comida de restaurantes, a repartidores gestionar entregas y a administradores supervisar todo el flujo operativo.

### Caracteristicas Principales

- 8 microservicios independientes comunicados via gRPC
- API Gateway REST como unico punto de entrada
- Frontend Angular 17 con 4 roles de usuario
- Validacion de ordenes en tiempo real contra el catalogo
- Pagos con conversion automatica de moneda (USD/GTQ)
- Notificaciones por email en cada cambio de estado
- Foto obligatoria al marcar una entrega como completada
- Despliegue local con Docker Compose y en nube con Kubernetes

---

## 2. Arquitectura del Sistema

### Diagrama de Componentes

```
 ┌─────────────────────────────────────────────────────────┐
 │                   CLIENTE / NAVEGADOR                   │
 │              Frontend Angular 17 — :4200                │
 └──────────────────────────┬──────────────────────────────┘
                            │ HTTP/REST
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │                     API GATEWAY                         │
 │                 Express.js — :3000                      │
 │                                                         │
 │  • Valida JWT en cada request protegido                 │
 │  • Enruta REST → llamadas gRPC al servicio correcto     │
 │  • Maneja CORS para el frontend                         │
 └───┬─────────┬────────┬────────┬────────┬────────┬───────┘
     │         │        │        │        │        │
  gRPC      gRPC     gRPC    gRPC     gRPC    gRPC
     │         │        │        │        │        │
     ▼         ▼        ▼        ▼        ▼        ▼
 ┌───────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐
 │ Auth  │ │Catlog│ │Order │ │Deliv.│ │  FX  │ │Payment│
 │:50052 │ │:50051│ │:50053│ │:50054│ │:50056│ │:50057 │
 └───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘
     │        │        │        │        │           │
   auth_db catalog_db order_db deliv_db Redis    payment_db
   :5432    :5433     :5434    :5435   :6379      :5436

                    Notification Service :50055
                    (llamado por Order y Payment)
                           │
                         SMTP
                      (Gmail/Email)
```

### Patron de Comunicacion

- **Frontend ↔ API Gateway**: HTTP REST con JSON
- **API Gateway ↔ Microservicios**: gRPC (binario, tipado con Protocol Buffers)
- **Order Service ↔ Catalog Service**: gRPC para validar productos antes de guardar
- **Payment Service ↔ FX Service**: gRPC para obtener tipo de cambio
- **Payment Service ↔ Notification Service**: gRPC para enviar emails de confirmacion
- **Order Service ↔ Notification Service**: gRPC para notificar cambios de estado

---

## 3. Microservicios

### 3.1 Auth Service

**Directorio:** `auth-service/`
**Puerto gRPC:** 50052
**Base de datos:** PostgreSQL `auth_db` (puerto 5432)

#### Responsabilidad
Gestiona el registro, autenticacion y autorizacion de usuarios. Genera y valida tokens JWT.

#### Entidades
- **User**: id, email, password (bcrypt), firstName, lastName, role, createdAt

#### Roles disponibles
| Rol | Descripcion |
|---|---|
| `CLIENT` | Cliente que realiza ordenes |
| `RESTAURANT` | Dueno o empleado de restaurante |
| `DELIVERY` | Repartidor |
| `ADMIN` | Administrador del sistema |

#### Metodos gRPC (auth.proto)
```protobuf
service AuthService {
  rpc Register (RegisterRequest) returns (RegisterResponse);
  rpc Login (LoginRequest) returns (LoginResponse);
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
}
```

#### Endpoints REST (via API Gateway)
```
POST /auth/register   — Registrar nuevo usuario
POST /auth/login      — Iniciar sesion, devuelve JWT
```

#### Tabla en base de datos
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,  -- bcrypt hash
  first_name  VARCHAR(100),
  last_name   VARCHAR(100),
  role        VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

### 3.2 Catalog Service (restaurant-catalog-service)

**Directorio:** `restaurant-catalog-service/`
**Puerto gRPC:** 50051
**Base de datos:** PostgreSQL `catalog_db` (puerto 5433)

#### Responsabilidad
Gestiona el catalogo de restaurantes y productos. Valida que los items de una orden sean correctos (producto existe, pertenece al restaurante, esta disponible y el precio coincide).

#### Entidades
- **Restaurant**: id, name, address, phone, email, schedule, description, imageUrl, isActive
- **Product**: id, restaurantId, name, description, price, category, isAvailable, imageUrl

#### Metodos gRPC (catalog.proto)
```protobuf
service CatalogService {
  rpc ValidateOrder (ValidationRequest) returns (ValidationResponse);
  rpc GetProduct (GetProductRequest) returns (GetProductResponse);
  rpc GetRestaurantCatalog (GetRestaurantCatalogRequest) returns (GetRestaurantCatalogResponse);
  rpc ListRestaurants (ListRestaurantsRequest) returns (ListRestaurantsResponse);
}
```

**ValidateOrder** — Valida cada item de una orden:
1. Comprueba que el producto exista en la BD
2. Verifica que el producto pertenezca al restaurante indicado
3. Confirma que el producto este disponible (`isAvailable = true`)
4. Valida que el precio enviado coincida con el precio en BD

#### Endpoints REST (via API Gateway)
```
GET /catalog/restaurants                    — Lista restaurantes activos
GET /catalog/restaurants/:id/products       — Productos de un restaurante (desde BD real)
GET /catalog/products/:id                   — Producto por ID
```

#### Tablas en base de datos
```sql
CREATE TABLE restaurants (
  id          UUID PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  address     VARCHAR(255),
  phone       VARCHAR(50),
  email       VARCHAR(255),
  schedule    VARCHAR(255),
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id            UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  category      VARCHAR(100),
  is_available  BOOLEAN DEFAULT true,
  image_url     TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

### 3.3 Order Service

**Directorio:** `order-service/`
**Puerto gRPC:** 50053
**Base de datos:** PostgreSQL `order_db` (puerto 5434)

#### Responsabilidad
Gestiona el ciclo de vida completo de una orden: creacion, actualizacion de estado, consulta. Antes de guardar una orden llama al Catalog Service para validar los productos.

#### Estados de una orden
```
PENDING → PAID → IN_TRANSIT → DELIVERED
                   ↓
               CANCELLED
```

#### Metodos gRPC (order.proto)
```protobuf
service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder (GetOrderRequest) returns (GetOrderResponse);
  rpc GetUserOrders (GetUserOrdersRequest) returns (GetUserOrdersResponse);
  rpc GetAllOrders (GetAllOrdersRequest) returns (GetAllOrdersResponse);
  rpc UpdateOrderStatus (UpdateOrderStatusRequest) returns (UpdateOrderStatusResponse);
}
```

#### Flujo de creacion de orden
1. API Gateway recibe `POST /orders` con JWT
2. Order Service valida estructura de la peticion
3. **Llama a Catalog Service via gRPC** para validar productos
4. Si validacion OK: guarda la orden en BD con estado `PENDING`
5. Notifica al usuario via Notification Service (email)
6. Devuelve la orden creada

#### Endpoints REST (via API Gateway)
```
POST /orders                    — Crear orden (requiere JWT)
GET  /orders/:id                — Ver orden por ID
GET  /orders/user/:userId       — Ordenes de un usuario
GET  /admin/orders              — Todas las ordenes (rol ADMIN/RESTAURANT)
PUT  /admin/orders/:id/status   — Cambiar estado de orden
```

---

### 3.4 Delivery Service

**Directorio:** `delivery-service/`
**Puerto gRPC:** 50054
**Base de datos:** PostgreSQL `delivery_db` (puerto 5435)

#### Responsabilidad
Gestiona las entregas. Un repartidor acepta una entrega pendiente, la lleva al cliente y al marcarla como `DELIVERED` debe subir una foto en base64.

#### Estados de una entrega
```
PENDING → ACCEPTED → IN_TRANSIT → DELIVERED
                                    ↓
                               CANCELLED
```

#### Metodos gRPC (delivery.proto)
```protobuf
service DeliveryService {
  rpc GetPendingDeliveries (Empty) returns (GetPendingDeliveriesResponse);
  rpc GetDeliveryPersonDeliveries (GetDeliveryPersonRequest) returns (GetDeliveryPersonDeliveriesResponse);
  rpc AcceptDelivery (AcceptDeliveryRequest) returns (AcceptDeliveryResponse);
  rpc UpdateDeliveryStatus (UpdateDeliveryStatusRequest) returns (UpdateDeliveryStatusResponse);
}
```

#### Regla de negocio clave
Al marcar `DELIVERED`, el campo `delivery_photo` (base64) es **obligatorio**. Si se envia vacio, la operacion es rechazada.

#### Endpoints REST (via API Gateway)
```
GET  /deliveries/pending                    — Entregas pendientes (repartidor)
GET  /deliveries/person/:id                 — Mis entregas asignadas
POST /deliveries/:id/accept                 — Aceptar una entrega
PUT  /deliveries/:id/status                 — Actualizar estado (con foto si es DELIVERED)
```

---

### 3.5 FX Service

**Directorio:** `fx-service/`
**Puerto gRPC:** 50056
**Cache:** Redis (puerto 6379)

#### Responsabilidad
Proporciona tipos de cambio de divisas, principalmente USD a GTQ (Quetzal guatemalteco). Cachea la tasa en Redis por 24 horas para evitar llamadas excesivas a la API externa.

#### Fuente de datos
API publica gratuita: `https://open.er-api.com/v6/latest`

#### Metodos gRPC (fx.proto)
```protobuf
service FxService {
  rpc GetExchangeRate (GetExchangeRateRequest) returns (GetExchangeRateResponse);
}
```

#### Logica de cache
1. Revisa si hay tasa almacenada en Redis con TTL < 24h
2. Si existe: devuelve el valor cacheado
3. Si no existe o expiro: llama a la API externa, guarda en Redis con TTL de 86400s y devuelve el valor

#### Endpoint REST (via API Gateway)
```
GET /fx/rate?from=USD&to=GTQ    — Tipo de cambio actual
```

---

### 3.6 Payment Service

**Directorio:** `payment-service/`
**Puerto gRPC:** 50057
**Base de datos:** PostgreSQL `payment_db` (puerto 5436)

#### Responsabilidad
Procesa pagos de ordenes. Soporta tres metodos de pago. Al procesar un pago consulta el tipo de cambio al FX Service para mostrar el monto tanto en GTQ como en USD. Notifica al usuario via Notification Service.

#### Metodos de pago soportados
- `CREDIT_CARD` — Tarjeta de credito
- `DEBIT_CARD` — Tarjeta de debito
- `DIGITAL_WALLET` — Billetera digital

#### Metodos gRPC (payment.proto)
```protobuf
service PaymentService {
  rpc ProcessPayment (ProcessPaymentRequest) returns (ProcessPaymentResponse);
  rpc GetPayment (GetPaymentRequest) returns (GetPaymentResponse);
  rpc RefundPayment (RefundPaymentRequest) returns (RefundPaymentResponse);
}
```

#### Flujo de pago
1. Cliente solicita pago con metodo y monto
2. Payment Service llama a FX Service para obtener tasa USD/GTQ
3. Calcula monto equivalente en ambas monedas
4. Guarda el pago como `COMPLETED` en BD
5. Actualiza estado de la orden a `PAID` (via Order Service)
6. Envia email de confirmacion (via Notification Service)

#### Endpoint REST (via API Gateway)
```
POST /payments/process    — Procesar pago (requiere JWT)
GET  /payments/:id        — Ver pago por ID
POST /payments/:id/refund — Reembolso
```

---

### 3.7 Notification Service

**Directorio:** `notification-service/`
**Puerto gRPC:** 50055
**Dependencias externas:** SMTP (Gmail)

#### Responsabilidad
Envia emails automaticos en respuesta a eventos del sistema. No tiene base de datos propia; es un servicio de solo escritura.

#### Metodos gRPC (notification.proto)
```protobuf
service NotificationService {
  rpc SendOrderCreatedNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendOrderCancelledNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendOrderInTransitNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendOrderRejectedNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendOrderDeliveredNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendPaymentConfirmedNotification (NotificationRequest) returns (NotificationResponse);
  rpc SendPaymentRefundedNotification (NotificationRequest) returns (NotificationResponse);
}
```

#### Configuracion SMTP (Gmail)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password-16-chars
```

Para obtener el App Password de Gmail:
1. Activar verificacion en 2 pasos en tu cuenta Google
2. Ir a Seguridad > Contrasenas de aplicacion
3. Generar una para "Correo"

---

### 3.8 API Gateway

**Directorio:** `api-gateway/`
**Puerto HTTP:** 3000

#### Responsabilidad
Unico punto de entrada al sistema. Recibe peticiones REST del frontend, valida JWT cuando es necesario, y traduce las llamadas a gRPC hacia el microservicio correspondiente.

#### Rutas registradas
```
/auth        → Auth Service
/catalog     → Catalog Service
/orders      → Order Service
/deliveries  → Delivery Service
/fx          → FX Service
/payments    → Payment Service
/admin       → Order Service (con validacion de rol ADMIN/RESTAURANT)
```

#### Middleware de autenticacion
El `authMiddleware` extrae el JWT del header `Authorization: Bearer <token>`, lo valida con el Auth Service via gRPC y agrega `req.user` al request.

#### Clientes gRPC disponibles
```
src/grpc/clients/
  AuthServiceClient.ts
  CatalogServiceClient.ts
  OrderServiceClient.ts
  DeliveryServiceClient.ts
  FxServiceClient.ts
  PaymentServiceClient.ts
```

#### Health check
```
GET /health
→ { "status": "OK", "service": "API Gateway", "timestamp": "..." }
```

---

## 4. Frontend Angular

**Directorio:** `frontend/`
**Puerto:** 4200 (Angular dev) / 80 (Nginx en Docker)
**Framework:** Angular 17

### Estructura de Modulos

```
src/app/
├── core/
│   ├── guards/
│   │   ├── admin.guard.ts      — Protege rutas para ADMIN y RESTAURANT
│   │   └── delivery.guard.ts   — Protege rutas para DELIVERY
│   └── services/
│       └── auth.service.ts     — Login, registro, gestion de JWT
│
├── features/
│   ├── auth/
│   │   └── components/
│   │       ├── login.component      — Formulario de login
│   │       └── register.component   — Formulario de registro
│   │
│   ├── client/
│   │   ├── components/
│   │   │   ├── create-order.component   — Formulario de nueva orden
│   │   │   └── view-catalog.component   — Grid de productos desde BD
│   │   └── services/
│   │       ├── catalog.service.ts   — Llama a /catalog/* de la API
│   │       └── order.service.ts     — Llama a /orders de la API
│   │
│   ├── admin/
│   │   └── components/
│   │       └── admin-orders.component   — Panel de ordenes (ADMIN/RESTAURANT)
│   │
│   └── delivery/
│       └── components/
│           └── delivery-dashboard.component  — Panel del repartidor
│
└── shared/
    └── models/
        └── restaurant.model.ts   — Interfaces Restaurant y Product
```

### Rutas de la Aplicacion

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | LoginComponent | Publico |
| `/register` | RegisterComponent | Publico |
| `/client/create-order` | CreateOrderComponent | CLIENT |
| `/client/catalog` | ViewCatalogComponent | CLIENT |
| `/admin/orders` | AdminOrdersComponent | ADMIN, RESTAURANT |
| `/delivery/dashboard` | DeliveryDashboardComponent | DELIVERY |

### Redireccion segun rol tras login

| Rol JWT | Redirige a |
|---|---|
| `ADMIN` | `/admin/orders` |
| `RESTAURANT` | `/admin/orders` |
| `DELIVERY` | `/delivery/dashboard` |
| `CLIENT` | `/client/create-order` |

### Catalogo de Productos

El componente `ViewCatalogComponent` carga restaurantes y productos directamente desde la BD a traves de la API:
1. Al cargar: `GET /catalog/restaurants` — muestra el select de restaurantes
2. Al seleccionar restaurante: `GET /catalog/restaurants/:id/products` — muestra el grid

Los precios se muestran en Quetzales (`Q`) en toda la interfaz.

---

## 5. Comunicacion gRPC

### Que es gRPC

gRPC es un framework de llamada a procedimiento remoto (RPC) de alto rendimiento que usa Protocol Buffers como formato de serializacion. Es mas eficiente que REST/JSON porque los datos van en binario y el esquema esta definido en archivos `.proto`.

### Archivos Proto

Cada servicio define su interfaz en un archivo `.proto`:

```
auth-service/src/infrastructure/grpc/proto/auth.proto
restaurant-catalog-service/src/infrastructure/grpc/proto/catalog.proto
order-service/src/infrastructure/grpc/proto/order.proto
delivery-service/src/infrastructure/grpc/proto/delivery.proto
fx-service/src/infrastructure/grpc/proto/fx.proto
payment-service/src/infrastructure/grpc/proto/payment.proto
notification-service/src/infrastructure/grpc/proto/notification.proto
```

El API Gateway tiene copias de los protos en:
```
api-gateway/src/grpc/proto/
```

### Ejemplo de llamada gRPC (Order → Catalog)

**En el Order Service** (cliente gRPC):
```typescript
// Antes de guardar la orden, valida con Catalog Service
const validation = await catalogClient.validateOrder({
  restaurant_id: "99999999-...",
  items: [
    { product_id: "11111111-...", quantity: 2, expected_price: 12.99 }
  ]
});

if (!validation.is_valid) {
  throw new Error(validation.message);
}
// Solo si es valida, se guarda en BD
```

**En el Catalog Service** (servidor gRPC):
```typescript
async ValidateOrder(call, callback) {
  const { restaurant_id, items } = call.request;
  const errors = [];

  for (const item of items) {
    const product = await productRepository.findById(item.product_id);

    if (!product)               errors.push({ error_type: 'NOT_FOUND' });
    else if (!product.isAvailable) errors.push({ error_type: 'UNAVAILABLE' });
    else if (product.price !== item.expected_price) errors.push({ error_type: 'PRICE_MISMATCH' });
  }

  callback(null, {
    is_valid: errors.length === 0,
    errors
  });
}
```

---

## 6. Bases de Datos

### Resumen

| BD | Servicio | Puerto | Usuario | Nombre |
|---|---|---|---|---|
| PostgreSQL | Auth | 5432 | auth_user | auth_db |
| PostgreSQL | Catalog | 5433 | catalog_user | catalog_db |
| PostgreSQL | Order | 5434 | order_user | order_db |
| PostgreSQL | Delivery | 5435 | delivery_user | delivery_db |
| PostgreSQL | Payment | 5436 | payment_user | payment_db |
| Redis | FX (cache) | 6379 | — | — |

Cada microservicio tiene su propia base de datos aislada (patron *Database per Service*). Ningun servicio accede directamente a la BD de otro.

### Inicializacion automatica

Cada servicio crea sus tablas al arrancar con `CREATE TABLE IF NOT EXISTS`. No se requieren migraciones manuales.

### Datos de prueba

Los restaurantes y productos deben insertarse manualmente (ver README.md → Inicio Rapido). Los IDs fijos permiten que los tests sean reproducibles:

```
Restaurante Central: 99999999-9999-9999-9999-999999999999
Pizzeria Italia:     88888888-8888-8888-8888-888888888888
Burger House:        77777777-7777-7777-7777-777777777777
```

---

## 7. Flujos de Negocio

### Flujo Completo: Crear y Entregar una Orden

```
1. CLIENTE se registra / inicia sesion
   POST /auth/register  →  POST /auth/login
   Resultado: JWT con rol CLIENT

2. CLIENTE ve el catalogo
   GET /catalog/restaurants
   GET /catalog/restaurants/:id/products
   Resultado: lista de restaurantes y productos desde la BD

3. CLIENTE crea una orden
   POST /orders  (con JWT)
   ↓
   API Gateway  →  Order Service
                     ↓
               Catalog Service (gRPC: ValidateOrder)
               ← validacion OK
                     ↓
               Guarda orden (estado: PENDING)
                     ↓
               Notification Service (email: "Tu orden fue creada")

4. ADMIN/RESTAURANT aprueba la orden
   PUT /admin/orders/:id/status  { "status": "PAID" }
   ↓
   Order Service actualiza estado
   ↓
   Notification Service (email: "Tu pago fue confirmado")

5. REPARTIDOR acepta la entrega
   POST /deliveries/:id/accept
   ↓
   Delivery Service asigna repartidor

6. REPARTIDOR marca en transito
   PUT /deliveries/:id/status  { "status": "IN_TRANSIT" }
   ↓
   Notification Service (email: "Tu orden esta en camino")

7. REPARTIDOR entrega y sube foto
   PUT /deliveries/:id/status  {
     "status": "DELIVERED",
     "delivery_photo": "<base64 de la foto>"
   }
   ↓
   Notification Service (email: "Tu orden fue entregada")
```

### Flujo de Pago con Conversion de Moneda

```
POST /payments/process  {
  "orderId": "...",
  "method": "CREDIT_CARD",
  "amount": 100.00,
  "currency": "GTQ"
}
↓
Payment Service
  ↓
  FX Service (gRPC: GetExchangeRate USD→GTQ)
  ← tasa: 7.75 (desde Redis o API externa)
  ↓
  Calcula equivalentes: GTQ 100.00 = USD 12.90
  ↓
  Guarda pago como COMPLETED
  ↓
  Order Service (actualiza estado a PAID)
  ↓
  Notification Service (email con desglose en GTQ y USD)
```

---

## 8. Docker y Docker Compose

### docker-compose.yml (Stack Completo)

Levanta todos los servicios para produccion/testing:

```bash
docker compose up -d --build    # Primera vez
docker compose up -d            # Siguientes veces (sin rebuild)
docker compose ps               # Ver estado
docker compose logs -f          # Ver logs en tiempo real
docker compose down             # Detener (conserva volumenes)
docker compose down -v          # Detener y borrar datos
```

### docker-compose.dev.yml (Solo Bases de Datos)

Para desarrollo local donde los servicios corren fuera de Docker:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Levanta: auth-db, catalog-db, order-db, delivery-db, payment-db, Redis.

### Estructura de los Dockerfiles

Todos los servicios Node.js usan **multi-stage build**:

```dockerfile
# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Copiar .proto a dist/ (tsc no los copia automaticamente)
RUN find src -name "*.proto" | while IFS= read -r f; do \
    dest="dist/${f#src/}"; mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; done

# Stage 2: Produccion (imagen mas liviana)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE <puerto>
CMD ["node", "dist/server.js"]
```

El frontend usa Nginx para servir el build de Angular:
```dockerfile
FROM node:18-alpine AS builder
RUN npm install -g @angular/cli@17
COPY . .
RUN ng build --configuration production

FROM nginx:alpine
COPY --from=builder /app/dist/delivereats /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

## 9. Kubernetes

### Estructura de Manifiestos

```
k8s/
├── namespace/
│   └── namespace.yaml              — Namespace "delivereats"
├── auth-service/
│   ├── auth-secret.yaml            — Secrets: auth-db-secret, jwt-secret
│   ├── auth-db-statefulset.yaml    — StatefulSet + PVC para PostgreSQL
│   └── auth-service-deployment.yaml — Deployment + Service
├── catalog-service/
│   └── catalog-service.yaml        — DB StatefulSet + Service Deployment
├── order-service/
│   └── order-service.yaml
├── delivery-service/
│   └── delivery-service.yaml
├── fx-service/
│   └── fx-service.yaml             — ConfigMap + Deployment + Service
├── payment-service/
│   └── payment-service.yaml
├── notification-service/
│   └── notification-service.yaml
├── api-gateway/
│   └── api-gateway.yaml            — ConfigMap + Deployment (2 replicas) + Service + Ingress
├── frontend/
│   └── frontend.yaml               — Deployment + Service
├── redis/
│   └── (manifiestos de Redis)
└── deploy.sh                       — Script de despliegue automatizado
```

### Conceptos Kubernetes Usados

| Concepto | Para que se usa |
|---|---|
| **Namespace** | Aislar todos los recursos del proyecto en `delivereats` |
| **Deployment** | Microservicios sin estado (auth, catalog, order, etc.) |
| **StatefulSet** | Bases de datos PostgreSQL (necesitan identidad estable y almacenamiento persistente) |
| **PersistentVolumeClaim** | Almacenamiento persistente para las DBs |
| **Service (ClusterIP)** | Comunicacion interna entre pods (DNS interno de k8s) |
| **Service (LoadBalancer)** | Exponer API Gateway al exterior |
| **Ingress** | Enrutamiento HTTP hacia API Gateway con hostname `api.delivereats.local` |
| **ConfigMap** | Variables de entorno no sensibles (puertos, URLs de servicios) |
| **Secret** | Variables sensibles (passwords de BD, JWT secret, SMTP) |
| **readinessProbe** | k8s no envia trafico hasta que el pod este listo |
| **livenessProbe** | k8s reinicia el pod si deja de responder |
| **resources.limits** | Limita CPU y memoria para evitar que un pod consuma todo el nodo |

### Despliegue

```bash
cd k8s

# Desplegar todo (crea namespace, secretos, DBs, servicios, gateway, frontend)
./deploy.sh up

# Verificar
kubectl get pods -n delivereats
kubectl get svc -n delivereats
kubectl get ingress -n delivereats

# Logs de un pod
kubectl logs -f deployment/api-gateway -n delivereats

# Entrar a un pod
kubectl exec -it deployment/auth-service -n delivereats -- sh

# Eliminar todo
./deploy.sh down
```

### Comunicacion Interna en k8s

Kubernetes provee DNS interno automatico. Los servicios se comunican usando el nombre del Service como hostname:

```yaml
# En ConfigMap del API Gateway
AUTH_SERVICE_URL: auth-service:50052
CATALOG_SERVICE_URL: catalog-service:50051
ORDER_SERVICE_URL: order-service:50053
```

Estos nombres resuelven al ClusterIP del Service correspondiente dentro del namespace `delivereats`.

### Recursos por Servicio

| Servicio | CPU Request | CPU Limit | RAM Request | RAM Limit |
|---|---|---|---|---|
| API Gateway | 100m | 300m | 128Mi | 256Mi |
| Auth Service | 100m | 200m | 128Mi | 256Mi |
| Order Service | 100m | 200m | 128Mi | 256Mi |
| FX Service | 50m | 150m | 64Mi | 128Mi |
| Frontend | 50m | 100m | 64Mi | 128Mi |

---

## 10. Variables de Entorno

### API Gateway

| Variable | Descripcion | Valor por defecto |
|---|---|---|
| `PORT` | Puerto HTTP | 3000 |
| `NODE_ENV` | Entorno | development |
| `JWT_SECRET` | Clave secreta JWT | — |
| `CORS_ORIGIN` | Origen permitido CORS | http://localhost:4200 |
| `AUTH_SERVICE_URL` | URL gRPC Auth | localhost:50052 |
| `CATALOG_SERVICE_URL` | URL gRPC Catalog | localhost:50051 |
| `ORDER_SERVICE_URL` | URL gRPC Order | localhost:50053 |
| `DELIVERY_SERVICE_URL` | URL gRPC Delivery | localhost:50054 |
| `FX_SERVICE_URL` | URL gRPC FX | localhost:50056 |
| `PAYMENT_SERVICE_URL` | URL gRPC Payment | localhost:50057 |

### Auth Service

| Variable | Descripcion |
|---|---|
| `GRPC_PORT` | Puerto gRPC (50052) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexion a auth_db |
| `JWT_SECRET` | Clave secreta para firmar tokens |
| `JWT_EXPIRES_IN` | Expiracion del token (24h) |

### FX Service

| Variable | Descripcion |
|---|---|
| `GRPC_PORT` | Puerto gRPC (50056) |
| `REDIS_HOST`, `REDIS_PORT` | Conexion a Redis |
| `EXCHANGE_RATE_API_URL` | API de tipos de cambio |

### Notification Service

| Variable | Descripcion |
|---|---|
| `GRPC_PORT` | Puerto gRPC (50055) |
| `SMTP_HOST` | Servidor SMTP (smtp.gmail.com) |
| `SMTP_PORT` | Puerto SMTP (587) |
| `SMTP_USER` | Email remitente |
| `SMTP_PASSWORD` | App Password de Gmail |

---

## 11. Clean Architecture y SOLID

### Clean Architecture

Cada microservicio sigue la misma estructura de capas:

```
src/
├── domain/                    — Capa de Dominio (mas interna, sin dependencias externas)
│   ├── entities/              — Objetos del negocio: User, Order, Product
│   └── interfaces/            — Contratos: IUserRepository, IOrderRepository
│
├── application/               — Capa de Aplicacion
│   ├── usecases/              — Un caso de uso por operacion de negocio
│   │   ├── CreateOrderUseCase.ts
│   │   └── ValidateOrderUseCase.ts
│   └── dtos/                  — Objetos de transferencia de datos
│
└── infrastructure/            — Capa de Infraestructura (mas externa)
    ├── database/
    │   └── postgres/          — Implementaciones de repositorios con PostgreSQL
    ├── grpc/
    │   ├── proto/             — Definicion del contrato gRPC (.proto)
    │   └── handlers/          — Manejadores gRPC que llaman a los use cases
    └── di/
        └── container.ts       — Inyeccion de dependencias manual
```

**Regla de dependencia:** Las capas internas no conocen a las externas. El dominio no sabe nada de PostgreSQL ni gRPC. Los use cases solo conocen interfaces, no implementaciones concretas.

### Principios SOLID Aplicados

**S — Single Responsibility Principle**
Cada clase tiene una sola razon para cambiar:
- `CreateOrderUseCase` solo crea ordenes
- `PostgresOrderRepository` solo persiste ordenes en PostgreSQL
- `CatalogServiceHandler` solo maneja requests gRPC del catalogo

**O — Open/Closed Principle**
Los repositorios implementan interfaces del dominio. Se puede agregar un `MongoOrderRepository` sin modificar los use cases.

**L — Liskov Substitution Principle**
`PostgresOrderRepository` puede sustituirse por cualquier otra implementacion de `IOrderRepository` sin romper el sistema.

**I — Interface Segregation Principle**
`IProductRepository` y `IRestaurantRepository` son interfaces separadas, cada una con solo los metodos que necesita su cliente.

**D — Dependency Inversion Principle**
Los use cases dependen de `IOrderRepository` (abstraccion), no de `PostgresOrderRepository` (implementacion concreta). El contenedor de DI inyecta la implementacion real al arrancar.

### Ejemplo: Creacion de Orden con SOLID

```typescript
// domain/interfaces/IOrderRepository.ts
export interface IOrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

// application/usecases/CreateOrderUseCase.ts
export class CreateOrderUseCase {
  // Depende de la interfaz, no de la implementacion (DIP)
  constructor(
    private orderRepo: IOrderRepository,          // SRP: solo gestiona ordenes
    private catalogClient: ICatalogClient          // OCP: intercambiable
  ) {}

  async execute(data: CreateOrderDto): Promise<Order> {
    // Validar primero con catalog
    const validation = await this.catalogClient.validateOrder(data);
    if (!validation.isValid) throw new Error(validation.message);

    // Crear entidad de dominio
    const order = Order.create(data);

    // Persistir
    return this.orderRepo.save(order);
  }
}

// infrastructure/di/container.ts
const orderRepo = new PostgresOrderRepository(pool);  // LSP: implementa IOrderRepository
const catalogClient = new CatalogGrpcClient();
const createOrderUseCase = new CreateOrderUseCase(orderRepo, catalogClient);
```

---

*Delivereats — Software Avanzado, USAC 2026*
