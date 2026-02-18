# 🍕 Delivereats - Sistema de Delivery con Microservicios

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![gRPC](https://img.shields.io/badge/Protocol-gRPC-green)
![Docker](https://img.shields.io/badge/Container-Docker-blue)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Angular](https://img.shields.io/badge/Frontend-Angular-red)

Plataforma completa de delivery de comida con arquitectura de microservicios, gRPC, Clean Architecture y principios SOLID.

---

## 🏗️ Arquitectura

```
┌─────────────┐
│  Frontend   │  Angular
│  (Angular)  │  Puerto 4200
└──────┬──────┘
       │ REST
       ▼
┌─────────────┐
│ API Gateway │  Express
│   (REST)    │  Puerto 3000
└──────┬──────┘
       │ gRPC
       ├────────┬────────┬──────────┬───────────┐
       ▼        ▼        ▼          ▼           ▼
┌──────────┐┌──────────┐┌────────┐┌─────────┐┌──────────┐
│   Auth   ││ Catalog  ││ Order  ││Delivery ││Notification│
│ Service  ││ Service  ││Service ││Service  ││  Service   │
│  50052   ││  50051   ││ 50053  ││ 50054   ││   50055    │
└────┬─────┘└────┬─────┘└────┬───┘└────┬────┘└─────┬──────┘
     │           │           │         │            │
     ▼           ▼           ▼         ▼            ▼
 ┌────────┐  ┌────────┐  ┌──────┐ ┌────────┐   📧 SMTP
 │auth_db │  │catalog │  │order │ │delivery│
 │  5432  │  │  _db   │  │ _db  │ │  _db   │
 └────────┘  │  5433  │  │ 5434 │ │  5435  │
             └────────┘  └──────┘ └────────┘
```

---

## 🚀 Microservicios

| Servicio | Puerto | Función | Base de Datos |
|----------|--------|---------|---------------|
| **Auth-Service** | 50052 | Autenticación JWT, Gestión usuarios | PostgreSQL (5432) |
| **Catalog-Service** | 50051 | Productos, Validación gRPC | PostgreSQL (5433) |
| **Order-Service** | 50053 | Órdenes, Cliente gRPC | PostgreSQL (5434) |
| **Delivery-Service** | 50054 | Entregas, Repartidores | PostgreSQL (5435) |
| **Notification-Service** | 50055 | Emails, Notificaciones | SMTP |
| **API Gateway** | 3000 | REST → gRPC, Validación JWT | - |
| **Frontend** | 4200 | Angular UI | - |

---

## ⚡ Inicio Rápido (5 minutos)

```bash
# 1. Clonar
git clone https://github.com/[usuario]/SA_PROYECTO_[carnet].git
cd SA_PROYECTO_[carnet]

# 2. Configurar SMTP
cp .env.example .env
nano .env  # Editar con credenciales Gmail

# 3. Levantar todo
docker-compose up -d --build

# 4. Insertar datos
./insert-products.sh

# 5. Abrir
http://localhost:4200
```

---

## 🛠️ Stack Tecnológico

**Backend:** Node.js, TypeScript, gRPC, Express, PostgreSQL, Nodemailer  
**Frontend:** Angular 17, TypeScript, RxJS, Tailwind CSS  
**DevOps:** Docker, Docker Compose, GCP Cloud Run  
**Arquitectura:** Clean Architecture, SOLID Principles

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| **[PRUEBAS-LOCALES.md](PRUEBAS-LOCALES.md)** | 🧪 Guía completa de pruebas locales |
| **[DESPLIEGUE-GCP.md](DESPLIEGUE-GCP.md)** | ☁️ Despliegue en Google Cloud |
| **[PROYECTO-COMPLETO.md](PROYECTO-COMPLETO.md)** | 📖 Visión general de los 6 servicios |
| **[QUE-ES-GRPC.md](QUE-ES-GRPC.md)** | 🔌 Explicación de gRPC con ejemplos |
| **[RUBRICA-COMPLETA.md](RUBRICA-COMPLETA.md)** | 📋 Mapeo de requisitos académicos |
| **[GUIA-RAPIDA.md](GUIA-RAPIDA.md)** | ⚡ Referencia rápida |

---

## 🧪 Ejemplo de Uso

### 1. Registrar usuario
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@test.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@test.com","password":"password123"}'
```

### 3. Crear orden
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [{"productId": "11111111-1111-1111-1111-111111111111", "quantity": 2, "price": 12.99}]
  }'
```

📧 **Resultado:** Email de confirmación enviado automáticamente

---

## 🔍 Clean Architecture

```
src/
├── domain/           # Entidades y contratos
│   ├── entities/     # Order, User, Product
│   └── interfaces/   # IOrderRepository
│
├── application/      # Casos de uso
│   ├── dtos/
│   └── usecases/     # CreateOrder, ValidateOrder
│
└── infrastructure/   # Implementaciones
    ├── database/     # PostgreSQL
    ├── grpc/         # Servidores/Clientes
    └── di/           # Inyección de dependencias
```

---

## 📡 Comunicación gRPC

**Order-Service** valida productos con **Catalog-Service** vía gRPC:

```typescript
// Order-Service (Cliente)
const validation = await catalogClient.validateOrder({
  restaurantId: "...",
  items: [...]
});

if (!validation.isValid) {
  throw new Error("Validación fallida");
}
// Solo guarda si validación OK
```

```typescript
// Catalog-Service (Servidor)
ValidateOrder(request) {
  // 1. ¿Producto existe?
  // 2. ¿Pertenece al restaurante?
  // 3. ¿Está disponible?
  // 4. ¿Precio correcto?
  return { isValid, errors };
}
```

---

## 🎯 Principios SOLID

- ✅ **S**RP: Cada caso de uso tiene una responsabilidad
- ✅ **O**CP: Interfaces permiten extensión
- ✅ **L**SP: Implementaciones intercambiables
- ✅ **I**SP: Interfaces específicas
- ✅ **D**IP: Dependencia de abstracciones

---

## ☁️ Despliegue en GCP

```bash
# Construir y subir imágenes
./deploy-build.sh

# Desplegar servicios
gcloud run deploy auth-service \
  --image gcr.io/PROJECT_ID/auth-service \
  --platform managed
```

Ver: [DESPLIEGUE-GCP.md](DESPLIEGUE-GCP.md)

---

## 📊 Scripts Útiles

```bash
# Ver servicios
docker-compose ps

# Logs en tiempo real
docker-compose logs -f order-service

# Reiniciar servicio
docker-compose restart notification-service

# Limpiar todo
docker-compose down -v
```

---

## 🎓 Proyecto Académico

**Universidad:** Universidad de San Carlos de Guatemala  
**Curso:** Software Avanzado  
**Fecha:** Febrero 2026

---

## 📄 Licencia

MIT License - Proyecto académico

---

## 🌟 Características Destacadas

- ✅ 6 microservicios con gRPC
- ✅ Clean Architecture en todos los servicios
- ✅ SOLID principles
- ✅ Validación de órdenes antes de guardar
- ✅ Notificaciones por email automáticas
- ✅ Docker Compose para desarrollo
- ✅ Despliegue en GCP Cloud Run
- ✅ Documentación completa

---

⭐ **Dale una estrella si te fue útil!** ⭐
