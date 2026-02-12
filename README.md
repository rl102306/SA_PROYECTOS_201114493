# 🍔 Delivereats - Plataforma de Delivery con Microservicios

## 📋 Descripción del Proyecto

Delivereats es una plataforma de delivery diseñada con arquitectura de microservicios, implementando los principios SOLID y comunicación gRPC entre servicios.

### Prácticas Implementadas

- **Práctica 2**: Auth-Service con JWT, principios SOLID, gRPC
- **Práctica 3**: Comunicación gRPC entre Order-Service y Restaurant-Catalog-Service para validación de órdenes

---

## 🏗️ Arquitectura

```
delivereats-project/
├── auth-service/              # Servicio de autenticación con JWT
├── restaurant-catalog-service/ # Catálogo de productos (Servidor gRPC)
├── order-service/             # Gestión de órdenes (Cliente gRPC)
├── api-gateway/               # Gateway REST
├── frontend/                  # Aplicación Angular
└── docker-compose.yml         # Orquestación de servicios
```

### Microservicios

1. **Auth-Service** (Puerto: 50052)
   - Registro de usuarios (Cliente, Restaurante, Repartidor, Admin)
   - Login con JWT
   - Validación de tokens
   - Base de datos: PostgreSQL (puerto 5432)

2. **Restaurant-Catalog-Service** (Puerto: 50051)
   - Gestión de catálogo de productos
   - Validación de productos y precios (Servidor gRPC)
   - Base de datos: PostgreSQL (puerto 5433)

3. **Order-Service** (Puerto: 50053)
   - Creación de órdenes
   - Validación con Catalog-Service vía gRPC (Cliente)
   - Base de datos: PostgreSQL (puerto 5434)

4. **API-Gateway** (Puerto: 3000)
   - Punto de entrada REST para el frontend
   - Comunicación con microservicios vía gRPC
   - Validación de JWT

5. **Frontend** (Puerto: 4200)
   - Aplicación Angular
   - Interfaz de usuario para clientes y administradores

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker Desktop instalado
- Docker Compose instalado
- Node.js 18+ (para desarrollo local)
- Git

### Instalación

1. **Clonar el repositorio**
```bash
git clone <tu-repositorio>
cd delivereats-project
```

2. **Levantar todos los servicios con Docker Compose**
```bash
docker-compose up -d
```

3. **Verificar que todos los servicios estén corriendo**
```bash
docker-compose ps
```

Deberías ver 8 contenedores corriendo:
- 3 bases de datos (auth-db, catalog-db, order-db)
- 5 servicios (auth-service, catalog-service, order-service, api-gateway, frontend)

4. **Ver logs de los servicios**
```bash
# Todos los servicios
docker-compose logs -f

# Un servicio específico
docker-compose logs -f auth-service
docker-compose logs -f catalog-service
docker-compose logs -f order-service
```

5. **Acceder a la aplicación**
- Frontend: http://localhost:4200
- API Gateway: http://localhost:3000

---

## 🔧 Desarrollo Local (Sin Docker)

### Auth-Service

```bash
cd auth-service
npm install
cp .env.example .env
npm run dev
```

### Restaurant-Catalog-Service

```bash
cd restaurant-catalog-service
npm install
cp .env.example .env
npm run dev
```

### Order-Service

```bash
cd order-service
npm install
cp .env.example .env
npm run dev
```

### API-Gateway

```bash
cd api-gateway
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
ng serve
```

---

## 📚 Guía de Uso

### 1. Registro de Usuario

**Endpoint**: `POST http://localhost:3000/auth/register`

**Desde el Frontend**:
1. Ir a http://localhost:4200
2. Click en "Regístrate aquí"
3. Llenar el formulario con:
   - Email
   - Contraseña (mínimo 8 caracteres)
   - Nombre
   - Apellido
   - Rol (Cliente, Restaurante, Repartidor, Admin)

**Ejemplo con cURL**:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }'
```

### 2. Login

**Endpoint**: `POST http://localhost:3000/auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "password": "password123"
  }'
```

**Respuesta**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "cliente@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }
}
```

### 3. Crear Orden (con validación gRPC)

**Endpoint**: `POST http://localhost:3000/orders`

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{
    "restaurantId": "rest-uuid",
    "items": [
      {
        "productId": "prod-uuid-1",
        "quantity": 2,
        "price": 15.99
      },
      {
        "productId": "prod-uuid-2",
        "quantity": 1,
        "price": 8.50
      }
    ]
  }'
```

**Proceso de validación**:
1. Order-Service recibe la petición
2. Order-Service llama a Catalog-Service vía gRPC
3. Catalog-Service valida:
   - ✅ Que los productos existan
   - ✅ Que pertenezcan al restaurante
   - ✅ Que estén disponibles
   - ✅ Que los precios sean correctos
4. Si la validación es exitosa, se crea la orden
5. Si falla, se devuelve error con detalles

---

## 🧪 Pruebas de Validación gRPC

### Escenarios de Prueba

#### ✅ Validación Exitosa
```bash
# Crear una orden con productos válidos
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "restaurantId": "valid-restaurant-id",
    "items": [
      { "productId": "valid-product-1", "quantity": 1, "price": 10.50 }
    ]
  }'
```

**Logs esperados**:
```
order-service     | 📦 Validando orden con Catalog Service...
catalog-service   | 📦 Validando orden para restaurante valid-restaurant-id con 1 productos
catalog-service   | ✅ Validación exitosa para restaurante valid-restaurant-id: 1 productos
order-service     | ✅ Validación exitosa - procediendo a crear orden
order-service     | ✅ Orden order-uuid creada exitosamente
```

#### ❌ Producto No Encontrado
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "restaurantId": "valid-restaurant-id",
    "items": [
      { "productId": "non-existent-product", "quantity": 1, "price": 10.50 }
    ]
  }'
```

**Respuesta esperada**:
```json
{
  "success": false,
  "message": "Validación de orden fallida: non-existent-product: Producto no encontrado"
}
```

#### ❌ Precio Incorrecto
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "restaurantId": "valid-restaurant-id",
    "items": [
      { "productId": "valid-product-1", "quantity": 1, "price": 999.99 }
    ]
  }'
```

**Respuesta esperada**:
```json
{
  "success": false,
  "message": "Validación de orden fallida: valid-product-1: Precio incorrecto. Precio actual: $10.50, Precio recibido: $999.99"
}
```

#### ❌ Producto No Disponible
**Respuesta esperada**:
```json
{
  "success": false,
  "message": "Validación de orden fallida: product-id: Producto no está disponible"
}
```

---

## 📊 Principios SOLID Implementados

### 1. Single Responsibility Principle (SRP)
Cada clase tiene una única responsabilidad:
- `RegisterUserUseCase`: Solo maneja el registro de usuarios
- `LoginUserUseCase`: Solo maneja el login
- `ValidateOrderUseCase`: Solo valida órdenes

### 2. Open/Closed Principle (OCP)
Uso de interfaces para extensibilidad:
```typescript
interface IPasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

// Podemos cambiar de bcrypt a argon2 sin modificar el código
class BcryptPasswordHasher implements IPasswordHasher { }
class Argon2PasswordHasher implements IPasswordHasher { }
```

### 3. Liskov Substitution Principle (LSP)
Las implementaciones son intercambiables:
```typescript
const userRepository: IUserRepository = new PostgresUserRepository(pool);
// O en el futuro:
const userRepository: IUserRepository = new MongoUserRepository(client);
```

### 4. Interface Segregation Principle (ISP)
Interfaces pequeñas y específicas:
```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

### 5. Dependency Inversion Principle (DIP)
Dependemos de abstracciones, no de implementaciones:
```typescript
class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,  // Abstracción
    private readonly passwordHasher: IPasswordHasher   // Abstracción
  ) {}
}
```

---

## 📁 Estructura de Archivos

### Microservicio (Clean Architecture)

```
auth-service/
├── src/
│   ├── domain/              # Entidades y contratos
│   │   ├── entities/
│   │   │   └── User.ts
│   │   └── interfaces/
│   │       ├── IUserRepository.ts
│   │       ├── IPasswordHasher.ts
│   │       └── IJwtGenerator.ts
│   │
│   ├── application/         # Casos de uso
│   │   ├── dtos/
│   │   │   ├── RegisterUserDTO.ts
│   │   │   └── LoginUserDTO.ts
│   │   └── usecases/
│   │       ├── RegisterUserUseCase.ts
│   │       └── LoginUserUseCase.ts
│   │
│   ├── infrastructure/      # Implementaciones
│   │   ├── adapters/
│   │   │   ├── BcryptPasswordHasher.ts
│   │   │   └── JwtService.ts
│   │   ├── database/
│   │   │   └── postgres/
│   │   │       ├── config.ts
│   │   │       └── PostgresUserRepository.ts
│   │   ├── grpc/
│   │   │   ├── proto/
│   │   │   │   └── auth.proto
│   │   │   └── handlers/
│   │   │       └── AuthServiceHandler.ts
│   │   └── di/
│   │       └── container.ts
│   │
│   └── server.ts
│
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🔐 Seguridad

- ✅ Contraseñas hasheadas con bcrypt (10 rounds)
- ✅ JWT para autenticación stateless
- ✅ Validación de datos en DTOs
- ✅ Aislamiento de bases de datos por servicio
- ✅ Variables de entorno para secretos

**Importante**: Cambiar `JWT_SECRET` en producción.

---

## 🐛 Troubleshooting

### Error: "Cannot connect to database"
```bash
# Verificar que las bases de datos estén corriendo
docker-compose ps

# Reiniciar las bases de datos
docker-compose restart auth-db catalog-db order-db
```

### Error: "Port already in use"
```bash
# Detener todos los contenedores
docker-compose down

# Verificar puertos
lsof -i :5432
lsof -i :3000
lsof -i :4200

# Levantar de nuevo
docker-compose up -d
```

### Ver logs detallados
```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f auth-service
docker-compose logs -f catalog-service
```

### Reiniciar un servicio
```bash
docker-compose restart auth-service
```

### Reconstruir imágenes
```bash
docker-compose up -d --build
```

---

## 📝 Scripts Útiles

```bash
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra datos)
docker-compose down -v

# Ver estado de servicios
docker-compose ps

# Ejecutar comando en un contenedor
docker-compose exec auth-service sh

# Ver logs en tiempo real
docker-compose logs -f auth-service

# Reconstruir y levantar
docker-compose up -d --build
```

---

## 📦 Entregables de las Prácticas

### Práctica 2: Auth-Service con JWT
- [x] Entidad User con encapsulación
- [x] Interfaces (IUserRepository, IPasswordHasher, IJwtGenerator)
- [x] DTOs con validación
- [x] Use Cases (Register, Login)
- [x] Implementaciones (Bcrypt, JWT, PostgreSQL)
- [x] Servidor gRPC
- [x] Aplicación de principios SOLID
- [x] Contraseñas hasheadas
- [x] Docker y Docker Compose

### Práctica 3: Comunicación gRPC
- [x] Protocol Buffer para validación
- [x] Servidor gRPC en Catalog-Service
- [x] Cliente gRPC en Order-Service
- [x] Validación de productos
- [x] Validación de precios
- [x] Validación de disponibilidad
- [x] Validación de pertenencia a restaurante
- [x] Manejo de errores
- [x] Logs de éxito y fallo
- [x] Docker y Docker Compose

---

## 👥 Autor

**Estudiante**: [Tu Nombre]  
**Carné**: [Tu Carné]  
**Curso**: Software Avanzado  
**Universidad**: San Carlos de Guatemala  

---

## 📄 Licencia

Este proyecto es parte de las prácticas del curso de Software Avanzado.

---

## 🙏 Agradecimientos

- Auxiliar: Samashoas
- Curso de Software Avanzado - USAC
- Arquitectura basada en Clean Architecture y Domain-Driven Design
