# Delivereats — Plataforma de Delivery con Microservicios

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![gRPC](https://img.shields.io/badge/Protocol-gRPC-green)
![Docker](https://img.shields.io/badge/Container-Docker-blue)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Angular](https://img.shields.io/badge/Frontend-Angular%2017-red)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-blue)

Sistema completo de delivery de comida construido con arquitectura de microservicios, comunicación gRPC, Clean Architecture y principios SOLID.

**Universidad de San Carlos de Guatemala — Software Avanzado — 2026**

---

## Arquitectura General

```
 ┌──────────────────────────────────────────────────────┐
 │              Frontend Angular 17                     │
 │                  Puerto 4200                         │
 └───────────────────────┬──────────────────────────────┘
                         │ REST / HTTP
                         ▼
 ┌──────────────────────────────────────────────────────┐
 │                  API Gateway                         │
 │              Express  — Puerto 3000                  │
 │     (Autenticación JWT, Enrutamiento REST→gRPC)      │
 └──┬───────┬────────┬────────┬────────┬────────┬───────┘
    │ gRPC  │ gRPC   │ gRPC   │ gRPC   │ gRPC   │ gRPC
    ▼       ▼        ▼        ▼        ▼        ▼
 ┌──────┐ ┌───────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
 │ Auth │ │Catalog│ │Order │ │Deliv.│ │  FX  │ │Pay.  │
 │:50052│ │:50051 │ │:50053│ │:50054│ │:50056│ │:50057│
 └──┬───┘ └───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
    │         │         │         │         │         │
 auth_db  catalog_db  order_db  deliv_db  Redis  payment_db
  :5432     :5433      :5434     :5435    :6379    :5436

                         ┌──────────────┐
                         │Notification  │
                         │  Svc :50055  │
                         │  (SMTP/Email)│
                         └──────────────┘
```

---

## Microservicios

| Servicio | Puerto gRPC | Puerto DB | Función |
|---|---|---|---|
| **Auth Service** | 50052 | 5432 | Registro, login, JWT |
| **Catalog Service** | 50051 | 5433 | Restaurantes, productos, validación de órdenes |
| **Order Service** | 50053 | 5434 | Ciclo de vida de órdenes |
| **Delivery Service** | 50054 | 5435 | Repartidores, foto de entrega |
| **FX Service** | 50056 | Redis | Tipos de cambio USD/GTQ con caché 24h |
| **Payment Service** | 50057 | 5436 | Pagos (tarjeta, billetera digital), conversión de moneda |
| **Notification Service** | 50055 | — | Emails automáticos via SMTP |
| **API Gateway** | — | 3000 | Punto de entrada REST, autenticación, routing |
| **Frontend** | — | 4200 | Angular 17, roles: CLIENT, RESTAURANT, DELIVERY, ADMIN |

---

## Inicio Rapido (Local)

### Prerequisitos
- Docker Desktop corriendo
- Git

### Pasos

```bash
# 1. Clonar repositorio
git clone <url-del-repo>
cd SA_PROYECTOS_201114493

# 2. Crear .env (solo se necesita para SMTP)
cp .env.example .env
# Editar .env con credenciales SMTP si se quieren emails reales

# 3. Levantar todo
docker compose up -d --build

# 4. Insertar restaurantes y productos en la BD
docker exec delivereats-catalog-db psql -U catalog_user -d catalog_db -c "
INSERT INTO restaurants (id, name, address, phone, email, schedule, is_active, created_at, updated_at)
VALUES
  ('99999999-9999-9999-9999-999999999999','Restaurante Central','Calle 1','5555-1234','c@mail.com','8am-10pm',true,NOW(),NOW()),
  ('88888888-8888-8888-8888-888888888888','Pizzeria Italia','Avenida 2','5555-5678','p@mail.com','11am-11pm',true,NOW(),NOW()),
  ('77777777-7777-7777-7777-777777777777','Burger House','Plaza 3','5555-9012','b@mail.com','10am-10pm',true,NOW(),NOW())
ON CONFLICT (id) DO NOTHING;"

# 5. Abrir el frontend
# http://localhost:4200
```

### URLs disponibles

| URL | Descripcion |
|---|---|
| http://localhost:4200 | Frontend Angular |
| http://localhost:3000 | API Gateway REST |
| http://localhost:3000/health | Health check |

---

## Usuarios por Rol

| Rol | Que puede hacer | Redirige a |
|---|---|---|
| `CLIENT` | Ver catalogo, crear ordenes, ver precios en Q | /client/create-order |
| `RESTAURANT` | Ver y gestionar ordenes de su restaurante | /admin/orders |
| `DELIVERY` | Aceptar entregas, subir foto de entrega | /delivery/dashboard |
| `ADMIN` | Administrar todas las ordenes | /admin/orders |

### Registrar usuario de prueba

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@test.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Perez",
    "role": "CLIENT"
  }'
```

---

## Endpoints Principales

### Autenticacion
```
POST /auth/register   — Registrar usuario
POST /auth/login      — Login, devuelve JWT
```

### Catalogo (publico)
```
GET  /catalog/restaurants                    — Listar restaurantes activos
GET  /catalog/restaurants/:id/products       — Productos de un restaurante
GET  /catalog/products/:id                   — Producto por ID
```

### Ordenes (requiere JWT)
```
POST /orders                    — Crear orden
GET  /orders/:id                — Ver orden
GET  /orders/user/:userId       — Ordenes de un usuario
```

### Pagos (requiere JWT)
```
POST /payments/process          — Procesar pago (CREDIT_CARD, DEBIT_CARD, DIGITAL_WALLET)
GET  /fx/rate                   — Tipo de cambio USD/GTQ
```

### Admin (requiere JWT + rol ADMIN/RESTAURANT)
```
GET  /admin/orders              — Todas las ordenes
PUT  /admin/orders/:id/status   — Actualizar estado de orden
```

---

## Despliegue en Kubernetes

```bash
cd k8s

# Desplegar todo
./deploy.sh up

# Ver estado
kubectl get pods -n delivereats
kubectl get svc -n delivereats

# Eliminar todo
./deploy.sh down
```

Los manifiestos estan en `k8s/` organizados por servicio. Cada directorio contiene Deployment, Service, ConfigMap y StatefulSet (para las bases de datos).

Para produccion en GCP:
```bash
./deploy-build.sh   # Construye y sube imagenes a GCR
```

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | Angular 17, TypeScript, RxJS |
| API Gateway | Node.js, Express, TypeScript |
| Microservicios | Node.js, TypeScript, gRPC (`@grpc/grpc-js`) |
| Bases de datos | PostgreSQL 15 |
| Cache | Redis 7 |
| Contenedores | Docker, Docker Compose |
| Orquestacion | Kubernetes |
| Nube | Google Cloud Platform (GCP) |
| Email | Nodemailer + Gmail SMTP |

---

## Estructura del Repositorio

```
.
├── api-gateway/              — Gateway REST→gRPC
├── auth-service/             — Autenticacion y usuarios
├── restaurant-catalog-service/ — Restaurantes y productos
├── order-service/            — Gestion de ordenes
├── delivery-service/         — Entregas y repartidores
├── fx-service/               — Tipos de cambio con Redis
├── payment-service/          — Procesamiento de pagos
├── notification-service/     — Emails automaticos
├── frontend/                 — Aplicacion Angular 17
├── k8s/                      — Manifiestos de Kubernetes
├── docker-compose.yml        — Stack completo local
├── docker-compose.dev.yml    — Solo bases de datos (dev)
├── deploy-build.sh           — Build y push a GCR
├── insert-products.sh        — Datos de prueba en BD
└── DOCUMENTACION.md          — Guia completa del proyecto
```

---

## Scripts Utiles

```bash
# Ver estado de todos los contenedores
docker compose ps

# Logs de un servicio
docker compose logs -f order-service

# Reiniciar un servicio
docker compose restart api-gateway

# Reconstruir un servicio especifico
docker compose build catalog-service && docker compose up -d catalog-service

# Detener todo (conserva volumenes)
docker compose down

# Detener todo y borrar datos
docker compose down -v
```



