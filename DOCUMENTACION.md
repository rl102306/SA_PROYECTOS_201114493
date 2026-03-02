# Delivereats — Documentacion Completa del Proyecto

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Practica 5 — v1.2.0**
**Carnet: 201114493**

---

## Tabla de Contenidos

1. [Vision General](#1-vision-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Clean Architecture: Capas del Proyecto](#3-clean-architecture-capas-del-proyecto)
   - [Domain (Dominio)](#31-domain-dominio)
   - [Application (Casos de Uso)](#32-application-casos-de-uso)
   - [Infrastructure (Infraestructura)](#33-infrastructure-infraestructura)
   - [El Contenedor de DI (DIContainer)](#34-el-contenedor-de-di-dicontainer)
4. [Que es gRPC y un archivo Proto](#4-que-es-grpc-y-un-archivo-proto)
5. [Que es un Handler gRPC](#5-que-es-un-handler-grpc)
6. [Microservicios](#6-microservicios)
   - [Auth Service](#61-auth-service)
   - [Catalog Service](#62-catalog-service-restaurant-catalog-service)
   - [Order Service](#63-order-service)
   - [Delivery Service](#64-delivery-service)
   - [FX Service](#65-fx-service)
   - [Payment Service](#66-payment-service)
   - [Notification Service](#67-notification-service)
   - [API Gateway](#68-api-gateway)
7. [Frontend Angular](#7-frontend-angular)
8. [Flujos de Negocio Completos](#8-flujos-de-negocio-completos)
9. [Bases de Datos](#9-bases-de-datos)
10. [Docker y Docker Compose](#10-docker-y-docker-compose)
11. [Kubernetes](#11-kubernetes)
12. [Variables de Entorno](#12-variables-de-entorno)
13. [Guia Tecnica FX Service](#13-guia-tecnica-fx-service)
14. [Logica de Aprobacion y Devolucion de Dinero](#14-logica-de-aprobacion-y-devolucion-de-dinero)
15. [Justificacion Tecnica Almacenamiento de Fotos](#15-justificacion-tecnica-almacenamiento-de-fotos)
16. [Flujo de Cancelacion de Entrega por el Repartidor](#16-flujo-de-cancelacion-de-entrega-por-el-repartidor)
17. [Flujo Completo del Panel del Repartidor](#17-flujo-completo-del-panel-del-repartidor)
18. [JWT: Autenticacion, Payload y JWT Secret](#18-jwt-autenticacion-payload-y-jwt-secret)
19. [Asociacion Restaurante-Usuario](#19-asociacion-restaurante-usuario)

---

## 1. Vision General

**Delivereats** es una plataforma de delivery de comida construida como sistema de microservicios con Clean Architecture. Permite a clientes ordenar comida de restaurantes, a repartidores gestionar entregas y a restaurantes administrar su menu y pedidos.

### Caracteristicas Principales

- 8 microservicios independientes comunicados via gRPC
- API Gateway REST como unico punto de entrada
- Frontend Angular 17 con 4 roles de usuario
- Validacion de ordenes en tiempo real contra el catalogo
- Pagos con conversion automatica de moneda (USD/GTQ) via Redis cache
- Notificaciones por email en cada cambio de estado
- Foto obligatoria al marcar una entrega como completada
- Cancelacion de entrega por el repartidor con motivo obligatorio, propagacion a orden y notificacion al cliente
- Despliegue local con Docker Compose y en nube con Kubernetes

---

## 2. Arquitectura del Sistema

### Diagrama de Componentes

```
 +----------------------------------------------------------+
 |                  CLIENTE / NAVEGADOR                     |
 |             Frontend Angular 17 — :4200                  |
 +---------------------------+------------------------------+
                             | HTTP/REST + JWT
                             v
 +----------------------------------------------------------+
 |                      API GATEWAY                         |
 |                  Express.js — :3000                      |
 |  • Valida JWT en cada request protegido                  |
 |  • Enruta REST → llamadas gRPC al microservicio          |
 |  • Maneja CORS para el frontend                          |
 +----+--------+--------+--------+--------+--------+--------+
      |        |        |        |        |        |
    gRPC     gRPC     gRPC    gRPC     gRPC    gRPC
      |        |        |        |        |        |
      v        v        v        v        v        v
  +------+ +------+ +------+ +------+ +------+ +-------+
  | Auth | |Catlog| |Order | |Deliv.| |  FX  | |Paymen.|
  |:50052| |:50051| |:50053| |:50054| |:50056| |:50057 |
  +--+---+ +--+---+ +--+---+ +--+---+ +--+---+ +---+---+
     |         |        |        |        |          |
  auth_db  catalog_db order_db deliv_db Redis    payment_db
  :5432    :5433     :5434    :5435   :6379      :5436

              Notification Service :50055
              (llamado por Order, Payment, Delivery)
                       |
                     SMTP
                  (Gmail/Email)
```

### Patron de Comunicacion

| Origen | Destino | Protocolo | Para que |
|---|---|---|---|
| Frontend | API Gateway | HTTP REST + JSON | Toda la comunicacion del usuario |
| API Gateway | Microservicios | gRPC | Traduccion de REST a llamadas internas |
| Order Service | Catalog Service | gRPC | Validar productos antes de guardar una orden |
| Payment Service | FX Service | gRPC | Obtener tipo de cambio USD/GTQ |
| Payment Service | Order Service | gRPC | Marcar orden como PAID tras pago exitoso |
| Payment Service | Notification Service | gRPC | Email de pago confirmado |
| Order Service | Notification Service | gRPC | Email al cambiar estado de orden |

---

## 3. Clean Architecture: Capas del Proyecto

Cada microservicio sigue exactamente la misma estructura de 3 capas. La regla fundamental es: **las capas internas no conocen a las externas**. El dominio no sabe nada de PostgreSQL, Redis ni gRPC.

```
src/
├── domain/           <- Capa 1: Nucleo del negocio (sin dependencias externas)
│   ├── entities/     <- Objetos del negocio con sus reglas
│   └── interfaces/   <- Contratos que la infraestructura debe implementar
│
├── application/      <- Capa 2: Logica de aplicacion
│   ├── usecases/     <- Un use case por cada operacion de negocio
│   └── dtos/         <- Objetos de transferencia de datos con validacion
│
└── infrastructure/   <- Capa 3: Implementaciones concretas (DB, gRPC, HTTP)
    ├── database/postgres/  <- Repositorios reales con PostgreSQL
    ├── grpc/
    │   ├── proto/          <- Contrato gRPC (.proto)
    │   ├── handlers/       <- Reciben llamadas gRPC y llaman use cases
    │   └── clients/        <- Clientes para llamar a otros servicios
    ├── cache/              <- Implementacion de cache (Redis)
    └── di/                 <- Contenedor de inyeccion de dependencias
```

### 3.1 Domain (Dominio)

El dominio es el corazon del microservicio. Contiene:

**Entidades**: Objetos que representan conceptos del negocio con sus propias reglas. Los atributos son privados y solo se modifican a traves de metodos con logica de negocio.

Ejemplo real — `order-service/src/domain/entities/Order.ts`:
```typescript
export class Order {
  private readonly _id: string;
  private _status: OrderStatus;
  // ...

  // Metodo de dominio: tiene logica de negocio
  cancel(): void {
    if (this._status === OrderStatus.DELIVERED) {
      throw new Error('No se puede cancelar una orden ya entregada');
    }
    this._status = OrderStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  calculateTotal(): number {
    return this._items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}
```

Ejemplo real — `payment-service/src/domain/entities/Payment.ts`:
```typescript
export class Payment {
  private readonly _id: string;
  private readonly _orderId: string;
  private readonly _amount: number;
  private readonly _currency: string;
  private readonly _amountGtq: number;   // monto en quetzales
  private readonly _amountUsd: number;   // monto en dolares
  private readonly _exchangeRate: number; // tasa usada
  private readonly _paymentMethod: PaymentMethod;
  private readonly _status: PaymentStatus;
  // ...
}
```

**Interfaces (Contratos)**: Describen que debe poder hacer un repositorio sin decir como. El dominio solo conoce estas interfaces, nunca las implementaciones.

Ejemplo real — `payment-service/src/domain/interfaces/IPaymentRepository.ts`:
```typescript
export interface IPaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
}
```

Ejemplo real — `restaurant-catalog-service/src/domain/interfaces/IProductRepository.ts`:
```typescript
export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByRestaurantId(restaurantId: string): Promise<Product[]>;
  save(product: Product): Promise<Product>;
  delete(id: string): Promise<void>;
}
```

### 3.2 Application (Casos de Uso)

Los **use cases** orquestan la logica de negocio. Reciben un DTO, hacen las validaciones y coordinan repositorios y clientes externos. Solo conocen interfaces del dominio.

Ejemplo real — `restaurant-catalog-service/src/application/usecases/ValidateOrderUseCase.ts`:
```typescript
export class ValidateOrderUseCase {
  constructor(
    private readonly productRepository: IProductRepository  // interfaz, no implementacion
  ) {}

  async execute(restaurantId: string, items: OrderItemDTO[]): Promise<ValidationResultDTO> {
    const errors: ValidationErrorDTO[] = [];

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);

      if (!product) {
        errors.push({ productId: item.productId, errorType: 'NOT_FOUND', message: '...' });
        continue;
      }

      if (product.restaurantId !== restaurantId) {
        errors.push({ errorType: 'WRONG_RESTAURANT', ... });
        continue;
      }

      if (!product.isAvailable) {
        errors.push({ errorType: 'UNAVAILABLE', ... });
        continue;
      }

      // Tolerancia de 0.01 para errores de punto flotante
      if (Math.abs(product.price - item.expectedPrice) > 0.01) {
        errors.push({ errorType: 'WRONG_PRICE', ... });
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
```

Ejemplo real — `order-service/src/application/usecases/CreateOrderUseCase.ts`:
```typescript
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly catalogClient: CatalogServiceClient  // cliente gRPC a catalog
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    // 1. Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) throw new Error(errors.join(', '));

    // 2. Validar productos contra Catalog Service via gRPC
    const validationResult = await this.catalogClient.validateOrder({
      restaurantId: dto.restaurantId,
      items: dto.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        expectedPrice: item.price
      }))
    });

    if (!validationResult.isValid) {
      throw new Error(`Validacion fallida: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    // 3. Crear y persistir la orden
    const order = new Order({
      userId: dto.userId,
      restaurantId: dto.restaurantId,
      items: dto.items,
      status: OrderStatus.PENDING,
      totalAmount: dto.items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      deliveryAddress: dto.deliveryAddress
    });

    return this.orderRepository.save(order);
  }
}
```

Ejemplo real — `fx-service/src/application/usecases/GetExchangeRateUseCase.ts`:
```typescript
export class GetExchangeRateUseCase {
  constructor(
    private readonly cache: IExchangeRateCache,
    private readonly apiClient: IExchangeRateApiClient
  ) {}

  async execute(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResult> {
    const cacheKey = `fx:${from}:${to}`;

    // 1. Buscar en cache con TTL vigente
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return { rate: cached, source: 'CACHE' };
    }

    // 2. Consultar API externa si no hay cache
    try {
      const rate = await this.apiClient.fetchRate(from, to);
      await this.cache.set(cacheKey, rate, 86400); // TTL 24 horas
      return { rate, source: 'API' };
    } catch (apiError) {
      // 3. Fallback: usar cache expirado antes de fallar del todo
      const stale = await this.cache.getStale(cacheKey);
      if (stale !== null) {
        return { rate: stale, source: 'CACHE_FALLBACK' };
      }
      throw new Error('Tipo de cambio no disponible');
    }
  }
}
```

Los **DTOs** (Data Transfer Objects) son objetos de entrada con validacion:
```typescript
// Ejemplo: ProcessPaymentDTO en payment-service
export class ProcessPaymentDTO {
  orderId: string;
  amount: number;
  currency: string;         // 'GTQ' o 'USD'
  paymentMethod: string;    // 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET'
  userId?: string;
  userEmail?: string;

  validate(): string[] {
    const errors: string[] = [];
    if (!this.orderId) errors.push('orderId es requerido');
    if (!this.amount || this.amount <= 0) errors.push('amount debe ser positivo');
    if (!['GTQ', 'USD'].includes(this.currency)) errors.push('currency invalida');
    return errors;
  }
}
```

### 3.3 Infrastructure (Infraestructura)

La capa de infraestructura implementa los contratos del dominio con tecnologias concretas.

**Repositorios PostgreSQL**: Implementan las interfaces del dominio:
```typescript
// PostgresPaymentRepository implements IPaymentRepository
export class PostgresPaymentRepository implements IPaymentRepository {
  constructor(private readonly pool: Pool) {}

  async save(payment: Payment): Promise<Payment> {
    const query = `
      INSERT INTO payments (id, order_id, amount, currency, amount_gtq, amount_usd, exchange_rate, payment_method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET ...
    `;
    await this.pool.query(query, [payment.id, payment.orderId, ...]);
    return payment;
  }
}
```

**Redis Cache**: Implementa `IExchangeRateCache` con dos claves por tasa: una con TTL (cache normal) y otra sin TTL (fallback permanente):
```typescript
// fx-service/src/infrastructure/cache/RedisExchangeRateCache.ts
async set(key: string, value: number, ttlSeconds: number): Promise<void> {
  await this.redis.setex(key, ttlSeconds, value.toString());          // con TTL
  await this.redis.set(`fx:stale:${key}`, value.toString());         // sin TTL (fallback)
}

async getStale(key: string): Promise<number | null> {
  const value = await this.redis.get(`fx:stale:${key}`);  // nunca expira
  return value ? parseFloat(value) : null;
}
```

### 3.4 El Contenedor de DI (DIContainer)

El DIContainer es el unico lugar donde se instancian y conectan todos los componentes. Implementa el patron **Singleton** para que solo exista una instancia de cada componente durante toda la vida del proceso.

Ejemplo real — `payment-service/src/infrastructure/di/DIContainer.ts`:
```typescript
export class DIContainer {
  private static instance: DIContainer;
  private handler: PaymentServiceHandler;

  private constructor(pool: Pool) {
    // 1. Crear repositorios (implementaciones concretas de interfaces del dominio)
    const paymentRepository = new PostgresPaymentRepository(pool);

    // 2. Crear clientes gRPC para comunicarse con otros servicios
    const fxClient = new FxServiceClient();
    const orderClient = new OrderServiceClient();
    const notificationClient = new NotificationServiceClient();

    // 3. Crear use case inyectando las dependencias
    const processPaymentUseCase = new ProcessPaymentUseCase(
      paymentRepository,    // IPaymentRepository
      fxClient,             // para obtener tipo de cambio
      orderClient,          // para actualizar estado de orden
      notificationClient    // para enviar email
    );

    // 4. Crear handler gRPC inyectando el use case
    this.handler = new PaymentServiceHandler(processPaymentUseCase, paymentRepository);
  }

  static initialize(pool: Pool): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer(pool);
    }
    return DIContainer.instance;
  }
}
```

Ejemplo real — `restaurant-catalog-service/src/infrastructure/di/container.ts`:
```typescript
export class DIContainer {
  register(pool: Pool): void {
    // Repositories
    const productRepository = new PostgresProductRepository(pool);
    const restaurantRepository = new PostgresRestaurantRepository(pool);

    // Use Cases
    const validateOrderUseCase = new ValidateOrderUseCase(productRepository);

    // Handler con todas las dependencias
    const catalogServiceHandler = new CatalogServiceHandler(
      validateOrderUseCase,
      productRepository,
      restaurantRepository
    );
    this.services.set('CatalogServiceHandler', catalogServiceHandler);
  }
}
```

---

## 4. Que es gRPC y un archivo Proto

### gRPC

gRPC es un framework de comunicacion remota de alto rendimiento. En lugar de enviar JSON por HTTP (como hace REST), gRPC serializa los datos en formato **binario** usando Protocol Buffers. Esto lo hace mas rapido y permite validacion de tipos automatica.

En Delivereats: el API Gateway habla REST con el frontend, pero internamente todos los microservicios se comunican via gRPC.

### Archivos .proto

Un archivo `.proto` es el **contrato** del microservicio. Define exactamente que metodos expone y que datos acepta/devuelve. Tanto el servidor como el cliente deben tener una copia del mismo `.proto`.

**Ubicacion de los protos en el proyecto:**
```
auth-service/src/infrastructure/grpc/proto/auth.proto
restaurant-catalog-service/src/infrastructure/grpc/proto/catalog.proto
order-service/src/infrastructure/grpc/proto/order.proto
delivery-service/src/infrastructure/grpc/proto/delivery.proto
fx-service/src/infrastructure/grpc/proto/fx.proto
payment-service/src/infrastructure/grpc/proto/payment.proto
notification-service/src/infrastructure/grpc/proto/notification.proto

# El API Gateway tiene copias de todos los protos:
api-gateway/src/grpc/proto/
```

**Ejemplo — catalog.proto (fragmento):**
```protobuf
syntax = "proto3";
package catalog;

service CatalogService {
  rpc ValidateOrder (ValidationRequest) returns (ValidationResponse);
  rpc GetProduct (GetProductRequest) returns (GetProductResponse);
  rpc GetRestaurantCatalog (GetRestaurantCatalogRequest) returns (GetRestaurantCatalogResponse);
  rpc ListRestaurants (ListRestaurantsRequest) returns (ListRestaurantsResponse);
  rpc CreateProduct (CreateProductRequest) returns (ProductMutationResponse);
  rpc UpdateProduct (UpdateProductRequest) returns (ProductMutationResponse);
  rpc DeleteProduct (DeleteProductRequest) returns (DeleteProductResponse);
}

message ValidationRequest {
  string restaurant_id = 1;
  repeated OrderItem items = 2;
}

message OrderItem {
  string product_id = 1;
  int32 quantity = 2;
  float expected_price = 3;
}

message ValidationResponse {
  bool is_valid = 1;
  string message = 2;
  repeated ValidationError errors = 3;
}
```

**Ejemplo — payment.proto (fragmento):**
```protobuf
syntax = "proto3";
package payment;

service PaymentService {
  rpc ProcessPayment (ProcessPaymentRequest) returns (ProcessPaymentResponse);
  rpc GetPaymentByOrder (GetPaymentByOrderRequest) returns (GetPaymentResponse);
}

message ProcessPaymentRequest {
  string order_id = 1;
  float amount = 2;
  string currency = 3;       // 'GTQ' o 'USD'
  string payment_method = 4; // 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET'
  string user_id = 5;
  string user_email = 6;
  string user_name = 7;
}

message ProcessPaymentResponse {
  bool success = 1;
  string message = 2;
  PaymentData payment = 3;
}

message PaymentData {
  string id = 1;
  string order_id = 2;
  float amount = 3;
  string currency = 4;
  float amount_gtq = 5;
  float amount_usd = 6;
  float exchange_rate = 7;
  string payment_method = 8;
  string status = 9;
  string created_at = 10;
}
```

**Nota tecnica**: TypeScript (tsc) no copia los archivos `.proto` al compilar. Por eso en cada Dockerfile se agrega este paso despues del build:
```dockerfile
RUN find src -name "*.proto" | while IFS= read -r f; do \
    dest="dist/${f#src/}"; mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; done
```

---

## 5. Que es un Handler gRPC

Un **handler** es la clase que recibe las llamadas gRPC entrantes. Es el equivalente a un controlador en REST. Su unica responsabilidad es:

1. Extraer los datos del request gRPC (`call.request`)
2. Construir un DTO y llamar al use case correspondiente
3. Transformar el resultado al formato que espera el proto (`callback`)
4. Capturar errores y responder con mensajes claros

Los handlers **no contienen logica de negocio**. Toda la logica esta en los use cases.

### Ejemplo real — CatalogServiceHandler (catalog-service)

```typescript
export class CatalogServiceHandler {
  constructor(
    private readonly validateOrderUseCase: ValidateOrderUseCase,
    private readonly productRepository: IProductRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  // Este metodo es llamado por gRPC cuando llega una peticion ValidateOrder
  async ValidateOrder(call: any, callback: any) {
    try {
      // 1. Extraer datos del request gRPC (nombres en snake_case segun el .proto)
      const { restaurant_id, items } = call.request;

      // 2. Convertir a formato del use case (camelCase interno)
      const orderItems = items.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        expectedPrice: item.expected_price
      }));

      // 3. Llamar al use case (logica de negocio)
      const result = await this.validateOrderUseCase.execute(restaurant_id, orderItems);

      // 4. Responder con el formato del proto
      callback(null, {
        is_valid: result.isValid,
        message: result.message,
        errors: result.errors.map(e => ({
          product_id: e.productId,
          error_type: e.errorType,
          message: e.message
        }))
      });
    } catch (error) {
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async ListRestaurants(call: any, callback: any) {
    try {
      const { active_only } = call.request;
      const restaurants = active_only
        ? await this.restaurantRepository.findActive()
        : await this.restaurantRepository.findAll();

      callback(null, {
        restaurants: restaurants.map(r => ({
          id: r.id, name: r.name, address: r.address,
          phone: r.phone, email: r.email, is_active: r.isActive
        }))
      });
    } catch (error) {
      callback({ code: 13, message: 'Error interno' });
    }
  }
}
```

### Ejemplo real — PaymentServiceHandler (payment-service)

```typescript
export class PaymentServiceHandler {
  constructor(
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly paymentRepository: IPaymentRepository
  ) {}

  async ProcessPayment(call: any, callback: any): Promise<void> {
    try {
      // 1. Crear DTO desde el request gRPC
      const dto = new ProcessPaymentDTO(call.request);

      // 2. Ejecutar use case (toda la logica esta ahi)
      const payment = await this.processPaymentUseCase.execute(dto);

      // 3. Responder con el resultado y los montos calculados
      callback(null, {
        success: true,
        message: `Pago procesado. GTQ: ${payment.amountGtq.toFixed(2)}, USD: ${payment.amountUsd.toFixed(2)}`,
        payment: this.mapToGrpc(payment)
      });
    } catch (error: any) {
      callback(null, {
        success: false,
        message: error.message || 'Error al procesar el pago',
        payment: null
      });
    }
  }

  // Convierte la entidad Payment al formato que define el .proto
  private mapToGrpc(payment: Payment): any {
    return {
      id: payment.id,
      order_id: payment.orderId,        // snake_case = nombres del .proto
      amount: payment.amount,
      currency: payment.currency,
      amount_gtq: payment.amountGtq,
      amount_usd: payment.amountUsd,
      exchange_rate: payment.exchangeRate,
      payment_method: payment.paymentMethod,
      status: payment.status,
      created_at: payment.createdAt.toISOString()
    };
  }
}
```

### Ejemplo real — FxServiceHandler (fx-service)

```typescript
export class FxServiceHandler {
  constructor(private readonly getExchangeRateUseCase: GetExchangeRateUseCase) {}

  async GetExchangeRate(call: any, callback: any): Promise<void> {
    try {
      const { from_currency, to_currency } = call.request;
      const result = await this.getExchangeRateUseCase.execute(from_currency, to_currency);

      callback(null, {
        success: true,
        rate: result.rate,
        source: result.source,  // 'CACHE', 'API' o 'CACHE_FALLBACK'
        timestamp: new Date().toISOString(),
        message: `Tasa ${from_currency}→${to_currency}: ${result.rate}`
      });
    } catch (error: any) {
      callback(null, { success: false, rate: 0, message: error.message });
    }
  }
}
```

---

## 6. Microservicios

### 6.1 Auth Service

**Directorio:** `auth-service/`
**Puerto gRPC:** 50052
**Base de datos:** PostgreSQL `auth_db` (:5432)

#### Estructura de archivos
```
auth-service/src/
├── domain/
│   ├── entities/User.ts
│   └── interfaces/
│       ├── IUserRepository.ts
│       ├── IPasswordHasher.ts
│       └── IJwtGenerator.ts
├── application/
│   ├── dtos/ (RegisterUserDTO, LoginUserDTO)
│   └── usecases/ (RegisterUserUseCase, LoginUserUseCase)
├── infrastructure/
│   ├── adapters/ (BcryptPasswordHasher, JwtService)
│   ├── database/postgres/ (config.ts, PostgresUserRepository)
│   ├── di/container.ts
│   └── grpc/
│       ├── handlers/AuthServiceHandler.ts
│       └── proto/auth.proto
└── server.ts
```

#### Roles disponibles

| Rol | Descripcion |
|---|---|
| `CLIENT` | Cliente que realiza ordenes |
| `RESTAURANT` | Dueno o empleado de restaurante (tiene restaurantId) |
| `DELIVERY` | Repartidor |
| `ADMIN` | Administrador del sistema |

#### Metodos gRPC
```
Register (RegisterRequest) → RegisterResponse
Login (LoginRequest) → LoginResponse
ValidateToken (ValidateTokenRequest) → ValidateTokenResponse
GetUserById (GetUserByIdRequest) → GetUserByIdResponse  (usado por notification)
```

#### Endpoints REST
```
POST /auth/register   — Registrar nuevo usuario
POST /auth/login      — Iniciar sesion, devuelve JWT
```

---

### 6.2 Catalog Service (restaurant-catalog-service)

**Directorio:** `restaurant-catalog-service/`
**Puerto gRPC:** 50051
**Base de datos:** PostgreSQL `catalog_db` (:5433)

#### Estructura de archivos
```
restaurant-catalog-service/src/
├── domain/
│   ├── entities/ (Restaurant.ts, Product.ts)
│   └── interfaces/ (IRestaurantRepository.ts, IProductRepository.ts)
├── application/
│   └── usecases/ (ValidateOrderUseCase.ts, CreateRestaurantUseCase.ts)
├── infrastructure/
│   ├── database/postgres/ (config, PostgresProductRepository, PostgresRestaurantRepository)
│   ├── di/container.ts
│   └── grpc/
│       ├── handlers/CatalogServiceHandler.ts
│       └── proto/catalog.proto
└── server.ts
```

#### Metodos gRPC
```
ValidateOrder    — Valida items de una orden (existencia, precio, disponibilidad, restaurante)
GetProduct       — Obtiene un producto por ID
GetRestaurantCatalog — Productos de un restaurante
ListRestaurants  — Lista restaurantes (filtrado por activos)
CreateProduct    — Crea producto (llamado por restaurante)
UpdateProduct    — Actualiza producto
DeleteProduct    — Elimina producto
CreateRestaurant — Crea restaurante al registrarse
```

#### Endpoints REST (via API Gateway)
```
GET  /catalog/restaurants                     — Lista restaurantes activos
GET  /catalog/restaurants/:id/products        — Productos de un restaurante
GET  /catalog/products/:id                    — Producto por ID
POST /catalog/menu                            — Crear producto (rol RESTAURANT)
PUT  /catalog/menu/:id                        — Editar producto (rol RESTAURANT)
DELETE /catalog/menu/:id                      — Eliminar producto (rol RESTAURANT)
```

---

### 6.3 Order Service

**Directorio:** `order-service/`
**Puerto gRPC:** 50053
**Base de datos:** PostgreSQL `order_db` (:5434)

#### Estructura de archivos
```
order-service/src/
├── domain/
│   ├── entities/Order.ts
│   └── interfaces/IOrderRepository.ts
├── application/
│   ├── dtos/CreateOrderDTO.ts
│   └── usecases/ (CreateOrderUseCase.ts, GetAllOrdersUseCase.ts)
├── infrastructure/
│   ├── database/postgres/ (config, PostgresOrderRepository)
│   ├── di/container.ts
│   └── grpc/
│       ├── clients/CatalogServiceClient.ts
│       └── proto/order.proto
└── server.ts
```

#### Estados de una orden
```
PENDING → CONFIRMED → PREPARING → IN_DELIVERY → DELIVERED
                                      ↓
                                  CANCELLED
(PAID es un estado intermedio que puede coexistir)
```

#### Metodos gRPC
```
CreateOrder (CreateOrderRequest) → CreateOrderResponse
GetOrder (GetOrderRequest) → GetOrderResponse
GetUserOrders (GetUserOrdersRequest) → GetUserOrdersResponse
GetAllOrders (GetAllOrdersRequest) → GetAllOrdersResponse   (acepta restaurant_id para filtrar)
UpdateOrderStatus (UpdateOrderStatusRequest) → UpdateOrderStatusResponse
```

#### Endpoints REST
```
POST /orders                          — Crear orden (requiere JWT CLIENT)
GET  /orders/:id                      — Ver orden por ID
GET  /orders/user/:userId             — Ordenes de un usuario
PATCH /orders/:id/cancel              — Cancelar orden (solo PENDING/CONFIRMED)
GET  /admin/orders                    — Todas las ordenes (ADMIN)
GET  /admin/restaurant-orders         — Ordenes del restaurante del usuario (RESTAURANT)
PATCH /admin/orders/:id/status        — Cambiar estado (ADMIN/RESTAURANT)
```

---

### 6.4 Delivery Service

**Directorio:** `delivery-service/`
**Puerto gRPC:** 50054
**Base de datos:** PostgreSQL `delivery_db` (:5435)

#### Estados de una entrega
```
PENDING → ACCEPTED → IN_TRANSIT → DELIVERED
                                    (requiere delivery_photo en base64)
```

#### Regla de negocio
Al marcar `DELIVERED`, el campo `delivery_photo` (base64) es **obligatorio**. Si se envia vacio, la operacion es rechazada.

#### Endpoints REST
```
GET  /deliveries/pending              — Entregas pendientes de asignar
GET  /deliveries/person/:id           — Mis entregas asignadas
POST /deliveries/:id/accept           — Aceptar una entrega
PUT  /deliveries/:id/status           — Actualizar estado (con foto si es DELIVERED)
```

---

### 6.5 FX Service

**Directorio:** `fx-service/`
**Puerto gRPC:** 50056
**Cache:** Redis (:6379)

#### Estructura de archivos
```
fx-service/src/
├── domain/
│   └── interfaces/ (IExchangeRateCache.ts, IExchangeRateApiClient.ts)
├── application/
│   └── usecases/GetExchangeRateUseCase.ts
├── infrastructure/
│   ├── cache/RedisExchangeRateCache.ts
│   ├── http/ExchangeRateApiClient.ts    (llama a open.er-api.com)
│   ├── di/DIContainer.ts
│   └── grpc/
│       ├── handlers/FxServiceHandler.ts
│       └── proto/fx.proto
└── server.ts
```

#### Logica de cache con triple nivel
```
1. Buscar en Redis con TTL (cache normal, 24 horas)
   → Si existe: devolver (source: 'CACHE')

2. Si no existe: llamar a API externa (open.er-api.com)
   → Guardar en Redis con TTL de 86400 segundos
   → Guardar copia permanente en fx:stale:... (sin TTL)
   → Devolver (source: 'API')

3. Si la API falla: buscar copia permanente en Redis
   → Si existe: devolver aunque este obsoleto (source: 'CACHE_FALLBACK')
   → Si no existe: lanzar error
```

#### Endpoint REST
```
GET /fx/rate?from=USD&to=GTQ    — Tipo de cambio actual con fuente (CACHE/API/CACHE_FALLBACK)
```

---

### 6.6 Payment Service

**Directorio:** `payment-service/`
**Puerto gRPC:** 50057
**Base de datos:** PostgreSQL `payment_db` (:5436)

#### Estructura de archivos
```
payment-service/src/
├── domain/
│   ├── entities/Payment.ts
│   └── interfaces/IPaymentRepository.ts
├── application/
│   ├── dtos/ProcessPaymentDTO.ts
│   └── usecases/ProcessPaymentUseCase.ts
├── infrastructure/
│   ├── database/postgres/ (config, PostgresPaymentRepository)
│   ├── di/DIContainer.ts
│   └── grpc/
│       ├── clients/
│       │   ├── FxServiceClient.ts        (llama a fx-service)
│       │   ├── OrderServiceClient.ts     (llama a order-service)
│       │   └── NotificationServiceClient.ts (llama a notification-service)
│       ├── handlers/PaymentServiceHandler.ts
│       └── proto/payment.proto
└── server.ts
```

#### Metodos de pago soportados
```
CREDIT_CARD     — Tarjeta de credito
DEBIT_CARD      — Tarjeta de debito
DIGITAL_WALLET  — Billetera digital
```

#### Flujo interno del ProcessPaymentUseCase

Este es el use case mas complejo del sistema porque orquesta 3 servicios externos:

```typescript
async execute(dto: ProcessPaymentDTO): Promise<Payment> {
  // 1. Validar DTO (campos requeridos, currency valida, amount > 0)
  const errors = dto.validate();
  if (errors.length > 0) throw new Error(errors.join(', '));

  // 2. Verificar que no exista pago previo para esta orden (idempotencia)
  const existing = await this.paymentRepository.findByOrderId(dto.orderId);
  if (existing) throw new Error(`Ya existe un pago para la orden ${dto.orderId}`);

  // 3. Obtener tipo de cambio USD→GTQ desde FX Service via gRPC
  //    FX Service primero busca en Redis, si no llama a open.er-api.com
  const fxResult = await this.fxClient.getExchangeRate('USD', 'GTQ');
  const exchangeRate = fxResult.rate;  // ej: 7.75

  // 4. Calcular monto en ambas monedas
  //    Ejemplo: si el cliente paga GTQ 100 → amountUsd = 100 / 7.75 = 12.90
  //    Ejemplo: si el cliente paga USD 10 → amountGtq = 10 * 7.75 = 77.50
  let amountGtq, amountUsd;
  if (dto.currency === 'GTQ') {
    amountGtq = dto.amount;
    amountUsd = parseFloat((dto.amount / exchangeRate).toFixed(2));
  } else {
    amountUsd = dto.amount;
    amountGtq = parseFloat((dto.amount * exchangeRate).toFixed(2));
  }

  // 5. Crear entidad Payment y persistir
  const payment = new Payment({
    orderId: dto.orderId, amount: dto.amount, currency: dto.currency,
    amountGtq, amountUsd, exchangeRate,
    paymentMethod: dto.paymentMethod, status: 'COMPLETED'
  });
  const savedPayment = await this.paymentRepository.save(payment);

  // 6. Actualizar estado de la orden a PAID via gRPC a Order Service
  //    Si falla no se revierte el pago (el pago ya fue registrado)
  try {
    await this.orderClient.updateOrderStatus(dto.orderId, 'PAID');
  } catch (error) {
    console.error('No se pudo actualizar la orden — pago registrado de todas formas');
  }

  // 7. Enviar email de confirmacion via Notification Service (no critico)
  if (this.notificationClient && dto.userEmail) {
    await this.notificationClient.sendPaymentConfirmed({
      userEmail: dto.userEmail,
      orderId: savedPayment.orderId,
      amount: savedPayment.amount,
      currency: savedPayment.currency,
      amountGtq: savedPayment.amountGtq,
      amountUsd: savedPayment.amountUsd,
      exchangeRate: savedPayment.exchangeRate,
      paymentMethod: savedPayment.paymentMethod
    });
  }

  return savedPayment;
}
```

#### Endpoints REST
```
POST /payments/process     — Procesar pago (requiere JWT)
GET  /payments/order/:id   — Pago de una orden especifica
```

---

### 6.7 Notification Service

**Directorio:** `notification-service/`
**Puerto gRPC:** 50055
**Sin base de datos** — solo envia emails via SMTP

#### Metodos gRPC
```
SendOrderCreatedNotification     — Al crear una orden
SendOrderCancelledNotification   — Al cancelar una orden
SendOrderInTransitNotification   — Cuando la orden sale a entregar
SendOrderRejectedNotification    — Cuando la orden es rechazada
SendOrderDeliveredNotification   — Cuando la orden es entregada
SendPaymentConfirmedNotification — Al confirmar el pago (desde Payment Service)
SendPaymentRefundedNotification  — Al realizar un reembolso
```

#### Configuracion SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=contraseña-de-16-caracteres-de-google
```

Para obtener la App Password de Gmail:
1. Activar verificacion en 2 pasos en tu cuenta Google
2. Ir a `Seguridad > Contrasenas de aplicacion`
3. Generar una para "Correo"

---

### 6.8 API Gateway

**Directorio:** `api-gateway/`
**Puerto HTTP:** 3000

#### Estructura de archivos
```
api-gateway/src/
├── grpc/
│   ├── clients/
│   │   ├── AuthServiceClient.ts
│   │   ├── CatalogServiceClient.ts
│   │   ├── OrderServiceClient.ts
│   │   ├── DeliveryServiceClient.ts
│   │   ├── FxServiceClient.ts
│   │   ├── PaymentServiceClient.ts
│   │   └── NotificationServiceClient.ts
│   └── proto/  (copias de todos los .proto)
├── middleware/
│   ├── authMiddleware.ts       — Valida JWT (cualquier usuario autenticado)
│   ├── adminMiddleware.ts      — Solo ADMIN o RESTAURANT
│   └── restaurantMiddleware.ts — Solo RESTAURANT con restaurantId
└── routes/
    ├── authRoutes.ts
    ├── catalogRoutes.ts
    ├── orderRoutes.ts
    ├── deliveryRoutes.ts
    ├── fxRoutes.ts
    ├── paymentRoutes.ts
    └── adminRoutes.ts
```

#### Middleware de autenticacion

El `authMiddleware` extrae el JWT del header `Authorization: Bearer <token>`, lo valida llamando al Auth Service via gRPC y agrega `req.user` con el payload del token al request.

```
GET /health  →  { "status": "OK", "service": "API Gateway", "timestamp": "..." }
```

---

## 7. Frontend Angular

**Directorio:** `frontend/`
**Puerto:** 4200 (dev) / 80 (Nginx en Docker)
**Framework:** Angular 17

### Estructura de modulos
```
src/app/
├── core/
│   ├── guards/
│   │   ├── admin.guard.ts         — ADMIN y RESTAURANT
│   │   ├── restaurant.guard.ts    — Solo RESTAURANT
│   │   └── delivery.guard.ts      — Solo DELIVERY
│   └── services/
│       └── auth.service.ts        — Login, registro, JWT
│
├── features/
│   ├── auth/components/
│   │   ├── login.component        — Formulario de login
│   │   └── register.component     — Registro con selector de restaurante
│   │
│   ├── client/
│   │   ├── components/
│   │   │   └── view-catalog.component  — Grid restaurantes + productos + carrito
│   │   └── services/
│   │       ├── catalog.service.ts
│   │       └── order.service.ts
│   │
│   ├── restaurant/components/
│   │   └── restaurant-menu.component  — Panel CRUD menu + pedidos activos
│   │
│   ├── admin/components/
│   │   └── admin-orders.component     — Panel de ordenes ADMIN
│   │
│   └── delivery/components/
│       └── delivery-dashboard.component — Panel del repartidor
│
└── shared/models/
    └── restaurant.model.ts
```

### Rutas y redireccion por rol

| Ruta | Componente | Guard | Redireccion desde login |
|---|---|---|---|
| `/login` | LoginComponent | Publico | — |
| `/register` | RegisterComponent | Publico | — |
| `/client/catalog` | ViewCatalogComponent | Ninguno | CLIENT |
| `/restaurant/menu` | RestaurantMenuComponent | RestaurantGuard | RESTAURANT |
| `/admin/orders` | AdminOrdersComponent | AdminGuard | ADMIN |
| `/delivery/dashboard` | DeliveryDashboardComponent | DeliveryGuard | DELIVERY |

### Funcionalidades del RestaurantMenuComponent

El panel del restaurante tiene dos tabs:

**Tab Menu**: Tabla de productos con acciones
- Crear nuevo producto (modal)
- Editar producto existente (modal)
- Toggle disponibilidad (sin recargar pagina)
- Eliminar producto con confirmacion

**Tab Pedidos**: Lista de ordenes activas del restaurante
- Aceptar orden (PENDING → CONFIRMED)
- Marcar en preparacion (CONFIRMED → PREPARING)
- Finalizar (PREPARING → IN_DELIVERY)
- Rechazar con confirmacion (→ CANCELLED)

---

## 8. Flujos de Negocio Completos

### Flujo 1: Cliente realiza una orden

```
1. LOGIN
   POST /auth/login { email, password }
   → JWT con rol CLIENT y userId

2. VER CATALOGO
   GET /catalog/restaurants
   → Lista de restaurantes desde catalog_db

   GET /catalog/restaurants/:id/products
   → Productos del restaurante seleccionado

3. CREAR ORDEN
   POST /orders { restaurantId, items: [{productId, quantity, price}], deliveryAddress }
   (con JWT)
      |
      v API Gateway
      |
      v Order Service (CreateOrderUseCase)
         |
         v Catalog Service gRPC (ValidateOrderUseCase)
            - Producto existe? SI/NO
            - Pertenece al restaurante? SI/NO
            - Esta disponible? SI/NO
            - Precio coincide (tolerancia 0.01)? SI/NO
         |
         Si isValid: new Order({ status: PENDING })
         |
         v order_db (INSERT)
         |
         v Notification Service gRPC → email "Tu orden fue creada"

4. PAGAR ORDEN
   POST /payments/process { orderId, amount, currency: 'GTQ', paymentMethod: 'CREDIT_CARD' }
   (con JWT)
      |
      v Payment Service (ProcessPaymentUseCase)
         |
         v FX Service gRPC → Redis → API externa
           tasa USD/GTQ: 7.75
         |
         Calcular: GTQ 100 = USD 12.90
         |
         v payment_db (INSERT COMPLETED)
         |
         v Order Service gRPC → UPDATE status = PAID
         |
         v Notification Service gRPC → email "Pago confirmado: Q100.00 / USD 12.90"
```

### Flujo 2: Restaurante gestiona pedidos

```
1. LOGIN como RESTAURANT
   → JWT con rol RESTAURANT y restaurantId

2. VER PEDIDOS
   GET /admin/restaurant-orders
   → Solo ordenes donde restaurant_id = restaurantId del JWT

3. CAMBIAR ESTADO
   PATCH /admin/orders/:id/status { status: 'CONFIRMED' }
   → Order Service actualiza estado

4. (Cuando sale a entregar) PATCH status: 'IN_DELIVERY'
   → Notification Service → email "Tu orden esta en camino"
```

### Flujo 3: Repartidor entrega un pedido

```
1. LOGIN como DELIVERY
   → JWT con rol DELIVERY

2. VER ENTREGAS PENDIENTES
   GET /deliveries/pending

3. ACEPTAR ENTREGA
   POST /deliveries/:id/accept
   → delivery_db: status = ACCEPTED, delivery_person_id = userId

4. MARCAR EN TRANSITO
   PUT /deliveries/:id/status { status: 'IN_TRANSIT' }
   → Notification Service → email "Tu orden esta en camino"

5. ENTREGAR (requiere foto)
   PUT /deliveries/:id/status {
     status: 'DELIVERED',
     delivery_photo: '/9j/4AAQSkZJRgABAQ...' // base64 de la foto
   }
   → Si delivery_photo esta vacio: ERROR rechazado
   → Si tiene foto: delivery_db actualiza, email de entrega
```

### Flujo 4: Conversion de moneda con cache

```
Solicitud: GET /fx/rate?from=USD&to=GTQ

En FX Service:
  ┌─ Redis tiene fx:USD:GTQ con TTL vigente?
  │   SI → devolver rate, source: 'CACHE' (rapido, ~1ms)
  │
  └─ NO
       ┌─ Llamar a open.er-api.com/v6/latest
       │   SI funciona → guardar en Redis (TTL 24h)
       │              → guardar copia permanente fx:stale:fx:USD:GTQ
       │              → devolver rate, source: 'API'
       │
       └─ NO funciona (error de red, timeout)
            ┌─ Redis tiene fx:stale:fx:USD:GTQ?
            │   SI → devolver rate, source: 'CACHE_FALLBACK' (dato obsoleto pero disponible)
            └─ NO → ERROR "Tipo de cambio no disponible"
```

---

## 9. Bases de Datos

### Resumen

| BD | Servicio | Puerto | Usuario | Nombre |
|---|---|---|---|---|
| PostgreSQL | Auth | 5432 | auth_user | auth_db |
| PostgreSQL | Catalog | 5433 | catalog_user | catalog_db |
| PostgreSQL | Order | 5434 | order_user | order_db |
| PostgreSQL | Delivery | 5435 | delivery_user | delivery_db |
| PostgreSQL | Payment | 5436 | payment_user | payment_db |
| Redis | FX cache | 6379 | — | — |

Cada servicio tiene su propia base de datos (patron *Database per Service*). Ningun servicio accede a la BD de otro — toda la comunicacion es via gRPC.

### Inicializacion automatica

Cada servicio crea sus tablas al arrancar con `CREATE TABLE IF NOT EXISTS`. No se requieren migraciones manuales.

### Tabla payments (payment-service)
```sql
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE,   -- un solo pago por orden
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(3) NOT NULL,    -- GTQ o USD
  amount_gtq      DECIMAL(10,2) NOT NULL,
  amount_usd      DECIMAL(10,2) NOT NULL,
  exchange_rate   DECIMAL(10,4) NOT NULL,
  payment_method  VARCHAR(50) NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Datos de prueba (restaurantes)
```bash
docker exec delivereats-catalog-db psql -U catalog_user -d catalog_db -c "
INSERT INTO restaurants (id, name, address, phone, email, schedule, is_active, created_at, updated_at)
VALUES
  ('99999999-9999-9999-9999-999999999999','Restaurante Central','Calle 1','5555-1234','c@mail.com','8am-10pm',true,NOW(),NOW()),
  ('88888888-8888-8888-8888-888888888888','Pizzeria Italia','Avenida 2','5555-5678','p@mail.com','11am-11pm',true,NOW(),NOW()),
  ('77777777-7777-7777-7777-777777777777','Burger House','Plaza 3','5555-9012','b@mail.com','10am-10pm',true,NOW(),NOW())
ON CONFLICT (id) DO NOTHING;"
```

### Usuarios de prueba
```
central@test.com  / password123  → rol RESTAURANT, restaurantId: 99999999-...
pizzeria@test.com / password123  → rol RESTAURANT, restaurantId: 88888888-...
burger@test.com   / password123  → rol RESTAURANT, restaurantId: 77777777-...
```

---

## 10. Docker y Docker Compose

### Levantar el sistema completo
```bash
# Primera vez (construye imagenes)
docker compose up -d --build

# Siguientes veces
docker compose up -d

# Ver estado de todos los servicios
docker compose ps

# Ver logs de un servicio especifico
docker compose logs -f payment-service

# Ver logs de todos en tiempo real
docker compose logs -f

# Detener (conserva datos en volumenes)
docker compose down

# Detener y borrar todos los datos
docker compose down -v
```

### Estructura del Dockerfile (todos los servicios Node.js)

Todos usan **multi-stage build** para generar una imagen liviana en produccion:

```dockerfile
# Stage 1: Compilar TypeScript
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json .
RUN npm run build

# Paso critico: tsc no copia .proto, se copian manualmente
RUN find src -name "*.proto" | while IFS= read -r f; do \
    dest="dist/${f#src/}"; mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; done

# Stage 2: Imagen de produccion (sin devDependencies ni TypeScript)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 50057
CMD ["node", "dist/server.js"]
```

El frontend usa Nginx:
```dockerfile
FROM node:18-alpine AS builder
RUN npm install -g @angular/cli@17
COPY . .
RUN ng build --configuration production

FROM nginx:alpine
COPY --from=builder /app/dist/delivereats /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 11. Kubernetes

### Estructura de manifiestos
```
k8s/
├── namespace/namespace.yaml
├── auth-service/
│   ├── auth-secret.yaml           — Secrets: passwords de BD, JWT
│   ├── auth-db-statefulset.yaml   — PostgreSQL con PVC
│   └── auth-service-deployment.yaml
├── catalog-service/catalog-service.yaml
├── order-service/order-service.yaml
├── delivery-service/delivery-service.yaml
├── fx-service/fx-service.yaml
├── payment-service/payment-service.yaml
├── notification-service/notification-service.yaml
├── api-gateway/api-gateway.yaml   — 2 replicas + Ingress
├── frontend/frontend.yaml
├── redis/
└── deploy.sh
```

### Conceptos usados

| Concepto | Para que se usa en Delivereats |
|---|---|
| **Namespace** | Agrupar todos los recursos bajo `delivereats` |
| **Deployment** | Microservicios sin estado (auth, catalog, order, etc.) |
| **StatefulSet** | Bases de datos PostgreSQL (necesitan identidad estable) |
| **PersistentVolumeClaim** | Almacenamiento persistente para las BDs |
| **Service (ClusterIP)** | Comunicacion interna entre pods |
| **Service (LoadBalancer)** | Exponer API Gateway al exterior |
| **Ingress** | Enrutamiento con hostname `api.delivereats.local` |
| **ConfigMap** | URLs de servicios, puertos (no sensibles) |
| **Secret** | Passwords de BD, JWT secret, App Password SMTP |
| **readinessProbe** | No enviar trafico hasta que el pod este listo |
| **livenessProbe** | Reiniciar pod si deja de responder |
| **resources.limits** | Limitar CPU/RAM por pod |

### Comandos
```bash
cd k8s

# Desplegar todo
./deploy.sh up

# Verificar
kubectl get pods -n delivereats
kubectl get svc -n delivereats

# Logs
kubectl logs -f deployment/api-gateway -n delivereats

# Eliminar todo
./deploy.sh down
```

---

## 12. Variables de Entorno

### API Gateway
```env
PORT=3000
JWT_SECRET=tu-secreto-jwt
CORS_ORIGIN=http://localhost:4200
AUTH_SERVICE_URL=auth-service:50052
CATALOG_SERVICE_URL=catalog-service:50051
ORDER_SERVICE_URL=order-service:50053
DELIVERY_SERVICE_URL=delivery-service:50054
FX_SERVICE_URL=fx-service:50056
PAYMENT_SERVICE_URL=payment-service:50057
NOTIFICATION_SERVICE_URL=notification-service:50055
```

### Payment Service
```env
GRPC_PORT=50057
DB_HOST=payment-db
DB_PORT=5432
DB_NAME=payment_db
DB_USER=payment_user
DB_PASSWORD=payment_pass
FX_SERVICE_URL=fx-service:50056
ORDER_SERVICE_URL=order-service:50053
NOTIFICATION_SERVICE_URL=notification-service:50055
```

### FX Service
```env
GRPC_PORT=50056
REDIS_HOST=redis
REDIS_PORT=6379
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
```

### Notification Service
```env
GRPC_PORT=50055
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=abcd-efgh-ijkl-mnop   # 16 chars de Google App Password
```

---

## 13. Guia Tecnica FX Service

### Descripcion

El **FX Service** (Foreign Exchange Service) es el microservicio encargado de proporcionar tipos de cambio de divisas a los demas servicios del sistema, en particular al Payment Service para convertir montos entre GTQ (Quetzal guatemalteco) y USD (Dolar estadounidense).

**Puerto gRPC:** 50056
**Dependencia externa:** open.er-api.com (ExchangeRate API gratuita)
**Cache:** Redis (compartido con el sistema)

### Arquitectura interna

```
fx-service/src/
├── domain/
│   ├── interfaces/
│   │   ├── IExchangeRateCache.ts    <- contrato de cache (Redis)
│   │   └── IExchangeRateApiClient.ts <- contrato de API externa
│   └── (sin entidades — el valor es solo un numero flotante)
├── application/
│   └── usecases/GetExchangeRateUseCase.ts  <- logica de cache + fallback
└── infrastructure/
    ├── cache/RedisExchangeRateCache.ts      <- implementacion con ioredis
    ├── http/ExchangeRateApiClient.ts        <- llamada a open.er-api.com con axios
    ├── grpc/
    │   ├── handlers/FxServiceHandler.ts    <- recibe llamadas gRPC
    │   └── proto/fx.proto
    └── di/DIContainer.ts
```

### Protocolo gRPC

```protobuf
service FxService {
  rpc GetExchangeRate (ExchangeRateRequest) returns (ExchangeRateResponse);
}

message ExchangeRateRequest {
  string from_currency = 1;  // Ej: "USD"
  string to_currency   = 2;  // Ej: "GTQ"
}

message ExchangeRateResponse {
  bool   success   = 1;
  double rate      = 2;       // Ej: 7.7423
  string source    = 3;       // "CACHE" | "API" | "CACHE_FALLBACK"
  string timestamp = 4;       // ISO 8601
  string message   = 5;
}
```

### Estrategia de cache con Redis (3 niveles)

El use case `GetExchangeRateUseCase` implementa una estrategia de **3 niveles**:

```typescript
async execute(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResult> {
  const cacheKey = `fx:${from}:${to}`;          // Ej: "fx:USD:GTQ"

  // NIVEL 1 — Cache con TTL vigente
  const cached = await this.cache.get(cacheKey);
  if (cached !== null) {
    return { rate: cached, source: 'CACHE' };   // responde en < 1ms
  }

  // NIVEL 2 — Consultar API externa
  try {
    const rate = await this.apiClient.fetchRate(from, to);
    await this.cache.set(cacheKey, rate, 86400); // TTL: 24 horas
    return { rate, source: 'API' };
  } catch (apiError) {
    // NIVEL 3 — Fallback: valor obsoleto sin TTL
    const stale = await this.cache.getStale(cacheKey);
    if (stale !== null) {
      return { rate: stale, source: 'CACHE_FALLBACK' };
    }
    throw new Error('Tipo de cambio no disponible');
  }
}
```

**Claves en Redis por cada par de monedas:**

| Clave Redis | TTL | Proposito |
|---|---|---|
| `fx:USD:GTQ` | 86400s (24h) | Cache normal con vencimiento |
| `fx:stale:fx:USD:GTQ` | SIN TTL | Fallback permanente (nunca expira) |

**Implementacion en `RedisExchangeRateCache.ts`:**
```typescript
async set(key: string, value: number, ttlSeconds: number): Promise<void> {
  await this.redis.setex(key, ttlSeconds, value.toString()); // con TTL
  await this.redis.set(`fx:stale:${key}`, value.toString()); // sin TTL (fallback)
}
```

### Guia de implementacion — como integrar FX Service

**Desde otro microservicio (Payment Service):**

1. Crear cliente gRPC con la libreria `@grpc/grpc-js`:
```typescript
// payment-service/src/infrastructure/grpc/clients/FxServiceClient.ts
import * as grpc from '@grpc/grpc-js';
const fxProto = grpc.loadPackageDefinition(packageDefinition).fx as any;
this.client = new fxProto.FxService(url, grpc.credentials.createInsecure());
```

2. Llamar al metodo `GetExchangeRate`:
```typescript
async getExchangeRate(from: string, to: string): Promise<{ success: boolean; rate: number; source: string }> {
  return new Promise((resolve, reject) => {
    this.client.GetExchangeRate({ from_currency: from, to_currency: to },
      (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      }
    );
  });
}
```

3. Usar en `ProcessPaymentUseCase.ts`:
```typescript
const fxResult = await this.fxClient.getExchangeRate('USD', 'GTQ');
const exchangeRate = fxResult.rate; // Ej: 7.7423

// Convertir segun la moneda del cliente
if (dto.currency === 'GTQ') {
  amountGtq = dto.amount;
  amountUsd = dto.amount / exchangeRate;
} else {
  amountUsd = dto.amount;
  amountGtq = dto.amount * exchangeRate;
}
```

### Variables de entorno requeridas

```env
GRPC_PORT=50056
REDIS_HOST=redis
REDIS_PORT=6379
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
```

### Comportamiento ante fallos

| Escenario | Comportamiento | Respuesta `source` |
|---|---|---|
| Redis tiene dato vigente | Devuelve inmediatamente, sin llamar API | `CACHE` |
| Redis expirado, API disponible | Consulta API, guarda en Redis, responde | `API` |
| Redis expirado, API caida | Usa copia permanente sin TTL | `CACHE_FALLBACK` |
| Redis expirado, API caida, primera vez | Lanza error — no hay fallback disponible | ERROR |

---

## 14. Logica de Aprobacion y Devolucion de Dinero

### Descripcion del flujo

El administrador del sistema puede aprobar la devolucion de dinero cuando una entrega fue cancelada (fallo en ruta, cliente no encontrado, etc.). El flujo completo es:

```
ADMIN solicita reembolso
     |
     v
POST /admin/orders/:orderId/refund  (adminMiddleware — solo ADMIN)
     |
     v
paymentServiceClient.refundPayment(orderId)  [gRPC]
     |
     v
payment-service: PaymentServiceHandler.RefundPayment()
     |
     v
PostgresPaymentRepository.refundByOrderId()
  UPDATE payments SET status = 'REFUNDED'
  WHERE order_id = $1 AND status = 'COMPLETED'
     |
     v
Notificacion email al cliente: PAYMENT_REFUNDED
     |
     v
Response: { success: true, payment: {..., status: 'REFUNDED'} }
```

### Reglas de negocio

1. **Solo ordenes CANCELADAS** pueden recibir reembolso (logica validada en la UI).
2. **Solo pagos en estado COMPLETED** pueden marcarse como REFUNDED (validado en la BD con `AND status = 'COMPLETED'`).
3. **Solo el rol ADMIN** puede aprobar reembolsos — protegido con `adminMiddleware`.
4. Si el pago ya fue reembolsado o no existe, se devuelve un error claro.

### Implementacion: capa por capa

**Domain — IPaymentRepository (contrato):**
```typescript
export interface IPaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
  refundByOrderId(orderId: string): Promise<Payment | null>;  // nuevo
}
```

**Domain — PaymentStatus (tipo extendido):**
```typescript
export type PaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';
```

**Infrastructure — PostgresPaymentRepository:**
```typescript
async refundByOrderId(orderId: string): Promise<Payment | null> {
  const result = await this.pool.query(
    `UPDATE payments SET status = 'REFUNDED'
     WHERE order_id = $1 AND status = 'COMPLETED'
     RETURNING *`,
    [orderId]
  );
  if (result.rows.length === 0) return null; // no habia pago completado
  return this.mapToEntity(result.rows[0]);
}
```

**gRPC — payment.proto:**
```protobuf
service PaymentService {
  rpc ProcessPayment    (ProcessPaymentRequest)  returns (PaymentResponse);
  rpc GetPaymentByOrder (GetPaymentByOrderRequest) returns (PaymentResponse);
  rpc RefundPayment     (RefundPaymentRequest)   returns (PaymentResponse);
}

message RefundPaymentRequest {
  string order_id = 1;
}
```

**Handler — PaymentServiceHandler:**
```typescript
async RefundPayment(call: any, callback: any): Promise<void> {
  const { order_id } = call.request;
  const payment = await this.paymentRepository.refundByOrderId(order_id);

  if (!payment) {
    callback(null, { success: false, message: 'No se encontro un pago COMPLETADO para esta orden' });
    return;
  }

  callback(null, { success: true, message: 'Reembolso aprobado', payment: this.mapToGrpc(payment) });
}
```

**API Gateway — adminRoutes.ts:**
```typescript
// POST /admin/orders/:orderId/refund — solo ADMIN
router.post('/orders/:orderId/refund', authMiddleware, adminMiddleware,
  async (req, res) => {
    const refundResp = await paymentServiceClient.refundPayment(req.params.orderId);
    if (!refundResp.success) {
      res.status(400).json({ success: false, message: refundResp.message });
      return;
    }
    // Enviar notificacion de reembolso al cliente (no bloqueante)
    notificationServiceClient.sendPaymentRefunded({...}).catch(() => {});
    res.json({ success: true, message: 'Reembolso aprobado', payment: refundResp.payment });
  }
);
```

### Panel de administrador

El componente `AdminOrdersComponent` muestra:
- Tabla de pedidos DELIVERED y CANCELLED con foto de entrega
- Para pedidos CANCELLED: boton **"Aprobar Reembolso"** (solo visible para rol ADMIN)
- Al aprobar: llama a `POST /admin/orders/:orderId/refund`, muestra confirmacion

### Notificacion de reembolso

Al aprobar un reembolso, se envia al cliente un email con:
- Numero de orden
- Monto reembolsado en GTQ y USD
- Metodo de pago original
- Estado: **REEMBOLSADO**

---

## 15. Justificacion Tecnica Almacenamiento de Fotos

### Contexto

Al marcar una entrega como **ENTREGADA**, el repartidor debe subir obligatoriamente una fotografia como prueba. El sistema debe almacenar y asociar esta imagen a la orden correspondiente.

### Opciones evaluadas

#### Opcion A — Base64 en base de datos (ELEGIDA)

La foto se convierte a Base64 en el cliente y se guarda directamente en la columna `delivery_photo TEXT` de la tabla `deliveries`.

**Implementacion:**
```sql
-- delivery-service: tabla deliveries
delivery_photo TEXT  -- almacena la imagen en formato Base64
```

```typescript
// UpdateDeliveryStatusUseCase.ts
case 'DELIVERED':
  if (!dto.deliveryPhoto || dto.deliveryPhoto.trim() === '') {
    throw new Error('Se requiere foto de entrega (base64) para marcar como ENTREGADO');
  }
  delivery.markAsDelivered(dto.deliveryPhoto); // guarda base64 en la entidad
  break;
```

```typescript
// DeliveryServiceHandler.ts — incluye la foto en la respuesta gRPC
private mapToGrpcDelivery(delivery: Delivery): any {
  return {
    ...
    delivery_photo: delivery.deliveryPhoto || '',  // base64
  };
}
```

**Ventajas:**
- **Simplicidad**: no requiere infraestructura adicional (no hay bucket, no hay servidor de archivos).
- **Atomicidad**: la foto y los datos de la entrega se guardan en una sola transaccion de base de datos. No puede quedar una entrega marcada como DELIVERED sin foto, ni viceversa.
- **Portabilidad**: funciona igual en desarrollo local, Docker Compose y Kubernetes sin cambiar configuracion.
- **Consistencia**: el panel del administrador puede acceder a la foto con la misma consulta que los datos de la entrega, sin llamadas adicionales a servicios externos.
- **Sin dependencias externas**: el sistema no falla si un servicio de almacenamiento externo esta caido.

**Desventajas:**
- La columna TEXT puede crecer mucho si hay muchas entregas (una imagen JPEG comprimida a 100KB = ~135KB en Base64).
- No es optimo para imagenes grandes o de alta resolucion.

#### Opcion B — File System local

Guardar la imagen en el sistema de archivos del contenedor y almacenar solo la ruta en la BD.

**Por que NO se eligio:** En un entorno con multiples replicas (Kubernetes), cada pod tendria su propio sistema de archivos. Una foto subida a un pod no seria accesible desde otro pod que atienda la consulta del administrador. Requeriria un volumen compartido (PersistentVolumeClaim) con modo ReadWriteMany, que no todos los proveedores de nube soportan facilmente.

#### Opcion C — Bucket en la nube (GCS, S3, etc.)

Subir la imagen a Google Cloud Storage o Amazon S3 y guardar la URL en la BD.

**Por que NO se eligio en esta practica:** Requiere configurar credenciales de proveedor de nube, permisos de IAM, politicas de acceso publico/privado, y una libreria cliente adicional. Para el alcance de esta practica, agrega complejidad sin beneficio practico dado el volumen de datos esperado. Es la opcion recomendada para produccion real con alto volumen.

### Conclusion

Para el alcance de la Practica 5, **Base64 en base de datos** es la estrategia optima por su **simplicidad de implementacion, atomicidad garantizada y ausencia de dependencias externas**. En un entorno de produccion con miles de entregas diarias, se recomendaria migrar a un bucket en la nube (GCS/S3) con URL firmadas de acceso temporal.

---

## 16. Flujo de Cancelacion de Entrega por el Repartidor

### Contexto

En el mundo real, un repartidor puede encontrar impedimentos que le impidan completar una entrega: el cliente no esta en el domicilio, la direccion es incorrecta, surgieron problemas de transito o seguridad, entre otros. El sistema debe contemplar este escenario para mantener la consistencia de los datos y notificar al cliente oportunamente.

### Estados en que se permite cancelar

El repartidor puede cancelar una entrega mientras esta en cualquiera de los siguientes estados activos:

| Estado       | Descripcion                                        |
|--------------|----------------------------------------------------|
| `ASSIGNED`   | El repartidor acepto la entrega pero aun no recoge |
| `PICKED_UP`  | El repartidor recogió el pedido en el restaurante  |
| `IN_TRANSIT` | El repartidor esta en camino al cliente            |

Los estados `DELIVERED` y `CANCELLED` son finales y no pueden modificarse.

### Diagrama del flujo completo

```
REPARTIDOR (Frontend)
       |
       | Presiona "Cancelar Entrega"
       v
  [Modal de cancelacion]
  - Solicita motivo (campo obligatorio)
  - Valida que no este vacio
       |
       | Confirma
       v
PUT /deliveries/:id/status
  body: { status: "CANCELLED", cancellationReason: "motivo..." }
       |
  API GATEWAY (api-gateway/src/routes/deliveryRoutes.ts)
       |
       +--- [1] DeliveryServiceClient.updateDeliveryStatus()
       |          |
       |          v
       |    DELIVERY SERVICE
       |    UpdateDeliveryStatusUseCase.execute()
       |    - Valida que cancellation_reason no este vacio
       |    - delivery.cancel(reason)   // domain entity method
       |    - Actualiza status='CANCELLED' en PostgreSQL
       |    - Devuelve delivery con order_id
       |
       +--- [2] OrderServiceClient.updateOrderStatus(orderId, 'CANCELLED')
       |          |
       |          v
       |    ORDER SERVICE
       |    - Actualiza status='CANCELLED' en PostgreSQL de ordenes
       |
       +--- [3] Notificacion al cliente (no bloqueante)
                  |
                  +--- OrderServiceClient.getOrder(orderId)
                  +--- AuthServiceClient.getUserById(userId)
                  +--- NotificationServiceClient.sendOrderCancelled({
                         cancelled_by: 'DELIVERY',
                         cancellation_reason: motivo,
                         status: 'CANCELADA'
                       })
                            |
                            v
                  NOTIFICATION SERVICE
                  - Envia email al cliente con:
                    * Numero de orden
                    * Productos del pedido
                    * Motivo de cancelacion ingresado por el repartidor
                    * Estado: CANCELADA
```

### Implementacion por capa

#### Capa Domain — `delivery-service/src/domain/entities/Delivery.ts`

La entidad `Delivery` ya cuenta con el metodo `cancel(reason)` que valida el motivo y establece el estado:

```typescript
cancel(cancellationReason: string): void {
  if (!cancellationReason || cancellationReason.trim() === '') {
    throw new Error('Se requiere un motivo de cancelacion');
  }
  this.status = DeliveryStatus.CANCELLED;
  this.cancellationReason = cancellationReason;
  this.updatedAt = new Date();
}
```

#### Capa Application — `delivery-service/src/application/usecases/UpdateDeliveryStatusUseCase.ts`

El caso de uso recibe el nuevo estado y delega al metodo correspondiente de la entidad:

```typescript
case 'CANCELLED':
  if (!dto.cancellationReason) {
    throw new Error('Se requiere motivo de cancelacion');
  }
  delivery.cancel(dto.cancellationReason);
  break;
```

#### Capa Infrastructure — `delivery-service/src/infrastructure/grpc/handlers/DeliveryServiceHandler.ts`

El handler gRPC deserializa la peticion y llama al caso de uso. El campo `cancellation_reason` se extrae del request y se pasa al DTO:

```typescript
async UpdateDeliveryStatus(call: any, callback: any) {
  const { delivery_id, status, cancellation_reason, delivery_photo } = call.request;
  const delivery = await this.updateDeliveryStatusUseCase.execute({
    deliveryId: delivery_id,
    status,
    cancellationReason: cancellation_reason,   // string del repartidor
    deliveryPhoto: delivery_photo
  });
  // ...
}
```

#### API Gateway — `api-gateway/src/routes/deliveryRoutes.ts`

El endpoint `PUT /deliveries/:id/status` orquesta la cancelacion en tres pasos:

```typescript
// Paso 1: Actualizar estado en Delivery Service
const response = await deliveryServiceClient.updateDeliveryStatus(
  req.params.id, 'CANCELLED', cancellationReason, undefined
);

// Paso 2: Marcar la orden como CANCELLED en Order Service
const orderId = response.delivery?.order_id;
orderServiceClient.updateOrderStatus(orderId, 'CANCELLED').catch(() => {});

// Paso 3: Notificar al cliente por email (no bloqueante)
orderServiceClient.getOrder(orderId).then(async (orderResp) => {
  const userResp = await authServiceClient.getUserById(order.user_id);
  notificationServiceClient.sendOrderCancelled({
    cancelled_by: 'DELIVERY',
    cancellation_reason: cancellationReason,
    status: 'CANCELADA'
    // ... otros campos
  }).catch(() => {});
}).catch(() => {});
```

El patron **no bloqueante** (`.catch(() => {})`) garantiza que, aunque el servicio de notificaciones este temporalmente caido, la respuesta al frontend llega inmediatamente y la cancelacion queda guardada en base de datos.

#### Frontend — Panel del Repartidor

**`delivery-dashboard.component.ts`:**

```typescript
// Estados en que se puede cancelar
isCancellable(delivery: any): boolean {
  return ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(delivery.status);
}

// Abrir modal de cancelacion
openCancelModal(delivery: any): void {
  this.deliveryIdForCancel = delivery.id;
  this.cancelReason = '';
  this.showCancelModal = true;
}

// Confirmar cancelacion (valida que el motivo no este vacio)
confirmCancel(): void {
  if (!this.deliveryIdForCancel || !this.cancelReason.trim()) {
    this.errorMessage = 'Debes ingresar el motivo de cancelacion';
    return;
  }
  this.showCancelModal = false;
  this.doUpdateStatus(this.deliveryIdForCancel, 'CANCELLED', this.cancelReason.trim());
}
```

**`delivery-dashboard.component.html`:**

- Boton rojo **"Cancelar Entrega"** visible para estados ASSIGNED, PICKED_UP, IN_TRANSIT
- Modal con textarea obligatorio para el motivo
- Boton de confirmacion deshabilitado si el motivo esta vacio
- Al cancelar exitosamente, la tarjeta muestra el motivo en rojo bajo los datos de la entrega

### Consistencia de datos garantizada

El flujo garantiza consistencia en tres bases de datos diferentes:

| Base de datos     | Tabla        | Campo actualizado              |
|-------------------|--------------|--------------------------------|
| `delivery-db`     | `deliveries` | `status='CANCELLED'`, `cancellation_reason=motivo` |
| `order-db`        | `orders`     | `status='CANCELLED'`           |

Ambas actualizaciones son independientes. Si la actualizacion de la orden falla (red, servicio caido), la entrega ya quedo cancelada en delivery-db. El administrador puede corregir el estado de la orden manualmente desde el panel si fuera necesario.

### Email al cliente

El email enviado al cliente cuando el repartidor cancela incluye:

- **Asunto**: Actualizacion de tu pedido #XXXXXXXX
- **Estado del pedido**: CANCELADA
- **Motivo**: el texto exacto que ingreso el repartidor
- **Cancelado por**: Repartidor (DELIVERY)

Esto permite al cliente saber exactamente que ocurrio con su pedido y tomar acciones (contactar al restaurante, solicitar reembolso, hacer un nuevo pedido).

---

## 17. Flujo Completo del Panel del Repartidor

### Descripcion General

El panel del repartidor (`/delivery/dashboard`) es la interfaz que usan los repartidores (rol `DELIVERY`) para gestionar todas sus entregas. Permite aceptar entregas disponibles, avanzar su estado paso a paso, marcarlas como entregadas con foto obligatoria, y cancelarlas con motivo cuando no es posible completarlas.

### Estados de una entrega y transiciones validas

```
                        [acepta el repartidor]
PENDING ──────────────────────────────────────► ASSIGNED
                                                    │
                              [recoge en restaurante]│
                                                    ▼
                                               PICKED_UP
                                                    │
                               [sale hacia el cliente]│
                                                    ▼
                                               IN_TRANSIT
                                                    │
                         ┌──────────────────────────┤
                         │                          │
              [no se pudo entregar]    [entregado con foto]
                         │                          │
                         ▼                          ▼
                     CANCELLED                  DELIVERED
                    (estado final)            (estado final)
```

`DELIVERED` y `CANCELLED` son estados finales — no pueden modificarse una vez alcanzados.

### Pantallas y funcionalidades

#### Seccion 1 — Entregas Disponibles

Muestra las entregas en estado `PENDING` que aun no tienen repartidor asignado. Cualquier repartidor autenticado puede aceptar una.

- **Boton "Aceptar Entrega"**: llama a `POST /deliveries/:id/accept`
- El API Gateway registra al repartidor (`delivery_person_id`, `delivery_person_name = email del usuario`)
- El estado pasa de `PENDING` a `ASSIGNED`

#### Seccion 2 — Mis Entregas

Muestra las entregas asignadas al repartidor autenticado (consulta por `delivery_person_id = userId del JWT`).

Para cada entrega activa se muestran:
- ID corto (primeros 8 caracteres del UUID)
- Direccion de recogida y entrega
- Tiempo estimado
- Estado actual con badge de color
- Boton de avance de estado
- Boton rojo "Cancelar Entrega" (solo si el estado es cancelable)

### Botones de avance de estado

| Estado actual | Boton visible          | Estado siguiente |
|---------------|------------------------|------------------|
| `ASSIGNED`    | Marcar como Recogido   | `PICKED_UP`      |
| `PICKED_UP`   | Marcar En Transito     | `IN_TRANSIT`     |
| `IN_TRANSIT`  | Marcar como Entregado  | abre modal foto  |
| `DELIVERED`   | (ninguno — estado final)| —               |
| `CANCELLED`   | (ninguno — estado final)| —               |

### Flujo de entrega exitosa (con foto obligatoria)

Cuando el repartidor presiona "Marcar como Entregado" desde el estado `IN_TRANSIT`, **no se actualiza el estado directamente**. En su lugar, se abre un modal de confirmacion con subida de foto:

```
[Repartidor presiona "Marcar como Entregado"]
         |
         v
  [Modal: "Foto de Entrega Obligatoria"]
  - Input file (accept="image/*")
  - Vista previa de la imagen seleccionada
  - Boton "Confirmar Entrega" (deshabilitado si no hay foto)
  - Boton "Cancelar" (cierra el modal sin cambiar estado)
         |
         | [Selecciona foto y presiona Confirmar]
         v
  FileReader.readAsDataURL(file)
  → extrae parte base64 (sin prefijo "data:image/...;base64,")
         |
         v
PUT /deliveries/:id/status
  body: { status: "DELIVERED", deliveryPhoto: "<base64>" }
         |
    API GATEWAY
         |
         +─── DeliveryServiceClient.updateDeliveryStatus()
         |         |
         |         v
         |   DELIVERY SERVICE
         |   UpdateDeliveryStatusUseCase:
         |   - Valida que deliveryPhoto no este vacio
         |   - delivery.markAsDelivered(photo)
         |   - Guarda base64 en columna delivery_photo TEXT
         |   - Registra actual_delivery_time = NOW()
         |
         +─── OrderServiceClient.updateOrderStatus(orderId, 'DELIVERED')
         |         |
         |         v
         |   ORDER SERVICE
         |   - Actualiza orders.status = 'DELIVERED'
         |
         +─── NotificationServiceClient.sendOrderDelivered() [no bloqueante]
                   |
                   v
             NOTIFICATION SERVICE
             - Envia email al cliente: "Tu pedido ha sido entregado"
             - Incluye monto total, productos, fecha/hora
```

**Por que la foto es obligatoria:** Sirve como evidencia de que la entrega se realizo correctamente. El administrador puede ver esta foto desde el panel admin junto con el detalle de la orden.

### Propagacion del estado DELIVERED al order-service

Este es un punto critico del sistema. Cuando el repartidor marca una entrega como DELIVERED en el **delivery-service**, el **order-service** debe ser notificado para actualizar el estado de la orden. Sin esta sincronizacion, el panel del administrador no encontraria la orden al filtrar por estado `DELIVERED`.

La sincronizacion se realiza en `api-gateway/src/routes/deliveryRoutes.ts`:

```typescript
// Despues de que delivery-service confirma el DELIVERED:
if (status === 'DELIVERED' && orderId) {
  // 1. Sincronizar estado en order-service
  orderServiceClient.updateOrderStatus(orderId, 'DELIVERED').catch(() => {});

  // 2. Notificar al cliente por email (no bloqueante)
  orderServiceClient.getOrder(orderId).then(async (orderResp) => {
    const userResp = await authServiceClient.getUserById(order.user_id);
    notificationServiceClient.sendOrderDelivered({ ... status: 'ENTREGADA' }).catch(() => {});
  }).catch(() => {});
}
```

### Foto en el panel administrativo

Una vez que la entrega esta marcada como `DELIVERED` con foto, el administrador puede verla en el panel de pedidos:

1. El endpoint `GET /admin/orders?status=DELIVERED` obtiene las ordenes del order-service
2. Para cada orden, llama a `DeliveryServiceClient.getDeliveryByOrder(order.id)` via gRPC
3. Si la entrega tiene `delivery_photo`, se adjunta al objeto de la orden en la respuesta REST
4. El frontend muestra una miniatura clicable; al hacer click abre la foto en tamano completo en un modal

**RPC usado:**
```protobuf
rpc GetDeliveryByOrder (GetDeliveryByOrderRequest) returns (DeliveryResponse);
message GetDeliveryByOrderRequest { string order_id = 1; }
```

### Bugs corregidos durante el desarrollo

Durante las pruebas del flujo del repartidor se identificaron y corrigieron los siguientes bugs criticos:

#### Bug 1 — `RefundPayment`: 12 UNIMPLEMENTED

**Causa**: El metodo `RefundPayment` estaba implementado en `PaymentServiceHandler` pero nunca se registro en el servidor gRPC de `payment-service`.

**Archivo**: `payment-service/src/server.ts`

```typescript
// ANTES (faltaba RefundPayment):
server.addService(paymentProto.PaymentService.service, {
  ProcessPayment: handler.ProcessPayment.bind(handler),
  GetPaymentByOrder: handler.GetPaymentByOrder.bind(handler)
  // RefundPayment no estaba aqui → error "12 UNIMPLEMENTED"
});

// DESPUES (corregido):
server.addService(paymentProto.PaymentService.service, {
  ProcessPayment: handler.ProcessPayment.bind(handler),
  GetPaymentByOrder: handler.GetPaymentByOrder.bind(handler),
  RefundPayment: handler.RefundPayment.bind(handler)   // ← agregado
});
```

#### Bug 2 — Foto de entrega no visible en panel admin

**Causa**: El metodo `GetDeliveryByOrder` estaba implementado en `DeliveryServiceHandler` pero nunca se registro en el servidor gRPC de `delivery-service`.

**Archivo**: `delivery-service/src/server.ts`

```typescript
// ANTES (faltaba GetDeliveryByOrder):
server.addService(deliveryProto.DeliveryService.service, {
  AcceptDelivery: handler.AcceptDelivery.bind(handler),
  UpdateDeliveryStatus: handler.UpdateDeliveryStatus.bind(handler),
  GetPendingDeliveries: handler.GetPendingDeliveries.bind(handler),
  GetDeliveryPersonDeliveries: handler.GetDeliveryPersonDeliveries.bind(handler),
  CreateDelivery: handler.CreateDelivery.bind(handler)
  // GetDeliveryByOrder no estaba → fotos nunca llegaban al admin
});

// DESPUES (corregido):
server.addService(deliveryProto.DeliveryService.service, {
  AcceptDelivery: handler.AcceptDelivery.bind(handler),
  UpdateDeliveryStatus: handler.UpdateDeliveryStatus.bind(handler),
  GetPendingDeliveries: handler.GetPendingDeliveries.bind(handler),
  GetDeliveryPersonDeliveries: handler.GetDeliveryPersonDeliveries.bind(handler),
  CreateDelivery: handler.CreateDelivery.bind(handler),
  GetDeliveryByOrder: handler.GetDeliveryByOrder.bind(handler)  // ← agregado
});
```

#### Bug 3 — Ordenes DELIVERED no aparecian en panel admin

**Causa**: Cuando el repartidor marcaba una entrega como `DELIVERED` en el delivery-service, el order-service nunca era notificado. Las ordenes quedaban en estado `IN_DELIVERY` en la BD de ordenes y el filtro del panel admin por `DELIVERED` no las encontraba.

**Solucion**: Se agrego la propagacion en `api-gateway/src/routes/deliveryRoutes.ts`: al recibir status `DELIVERED` del delivery-service, se llama inmediatamente a `orderServiceClient.updateOrderStatus(orderId, 'DELIVERED')`.

Adicionalmente, las ordenes afectadas existentes se corrigieron directamente en la base de datos:

```sql
UPDATE orders SET status = 'DELIVERED'
WHERE id IN (
  'fe151d19-...', '1219b0d5-...', '69702466-...', 'c7ad1351-...'
) AND status = 'IN_DELIVERY';
-- 4 rows updated
```

### Identificacion de quien cancelo la orden en el panel admin

El panel administrativo muestra una columna **"Cancelado por"** para todas las ordenes en estado `CANCELLED`. El sistema determina el origen de la cancelacion comparando los registros de ambas bases de datos:

| Condicion                                                        | Resultado mostrado |
|------------------------------------------------------------------|--------------------|
| Existe entrega en delivery-db con `status='CANCELLED'`           | **REPARTIDOR** (badge rojo) + motivo ingresado por el repartidor |
| No existe entrega cancelada en delivery-db                       | **RESTAURANTE** (badge amarillo) |

**Logica en `api-gateway/src/routes/adminRoutes.ts`:**

```typescript
const deliveryResp = await deliveryServiceClient.getDeliveryByOrder(order.id);
if (deliveryResp.success && deliveryResp.delivery) {
  const delivery = deliveryResp.delivery;
  if (order.status === 'CANCELLED' && delivery.status === 'CANCELLED') {
    extra.cancelled_by = 'REPARTIDOR';
    extra.cancellation_reason = delivery.cancellation_reason || '';
  } else if (order.status === 'CANCELLED') {
    extra.cancelled_by = 'RESTAURANTE';
  }
}
// Sin registro en delivery-service → restaurante cancelo antes de asignar repartidor
if (order.status === 'CANCELLED') {
  return { ...order, cancelled_by: 'RESTAURANTE' };
}
```

**Visualizacion en el frontend:**
- Badge **REPARTIDOR** en rojo con el motivo de cancelacion en italica debajo
- Badge **RESTAURANTE** en amarillo
- Si no es una orden cancelada, la celda muestra `—`

### Resumen de endpoints del repartidor

| Metodo | Endpoint                    | Descripcion                              |
|--------|-----------------------------|------------------------------------------|
| GET    | /deliveries/pending         | Listar entregas disponibles              |
| GET    | /deliveries/my              | Mis entregas asignadas                   |
| POST   | /deliveries/:id/accept      | Aceptar una entrega pendiente            |
| PUT    | /deliveries/:id/status      | Actualizar estado (PICKED_UP, IN_TRANSIT, DELIVERED, CANCELLED) |

Todos los endpoints requieren JWT con rol `DELIVERY`.

---

## 18. JWT: Autenticacion, Payload y JWT Secret

### Que es un JWT

Un **JSON Web Token (JWT)** es una cadena de texto compacta y firmada digitalmente que representa la identidad de un usuario autenticado. Tiene tres partes separadas por puntos:

```
eyJhbGciOiJIUzI1NiJ9  .  eyJ1c2VySWQiOiJhYmMiLCJyb2xlIjoiQURNSU4ifQ  .  xK8yZ...
       HEADER                          PAYLOAD                              SIGNATURE
   (algoritmo)                  (datos del usuario)                    (firma digital)
```

- **Header**: indica el algoritmo de firma (HS256)
- **Payload**: datos del usuario en JSON (no cifrados, solo codificados en Base64)
- **Signature**: garantiza que el token no fue alterado

### Como se genera el JWT al hacer login

En `auth-service/src/infrastructure/adapters/JwtService.ts`:

```typescript
generate(payload: JwtPayload): string {
  return jwt.sign(
    {
      userId:       payload.userId,       // UUID del usuario en auth_db
      email:        payload.email,        // email del usuario
      role:         payload.role,         // CLIENT | RESTAURANT | DELIVERY | ADMIN
      restaurantId: payload.restaurantId  // solo para rol RESTAURANT (igual al userId)
    },
    process.env.JWT_SECRET!,   // clave secreta compartida con el API Gateway
    { expiresIn: '24h' }       // el token expira en 24 horas
  );
}
```

El JWT generado se devuelve al frontend en la respuesta del login:

```json
POST /auth/login → { "success": true, "token": "eyJhbG...", "user": { ... } }
```

El frontend lo guarda en `localStorage` y lo incluye en **cada request** al API Gateway:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQi...
```

### Como el API Gateway valida el JWT

En `api-gateway/src/middleware/authMiddleware.ts`:

```typescript
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Extraer el token del header
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];   // "Bearer <token>" → "<token>"

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  // 2. Validar el token llamando al Auth Service via gRPC
  const response = await authServiceClient.validateToken(token);

  if (!response.valid) {
    return res.status(401).json({ message: 'Token invalido o expirado' });
  }

  // 3. Poblar req.user con el payload del token (ya validado)
  (req as any).user = {
    userId:       response.userId,
    email:        response.email,
    role:         response.role,
    restaurantId: response.restaurantId   // solo presente para RESTAURANT
  };

  next();   // continuar al handler de la ruta
};
```

En el Auth Service, `ValidateToken` usa el mismo `JWT_SECRET` para verificar la firma:

```typescript
// auth-service/src/infrastructure/adapters/JwtService.ts
validate(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return {
      userId:       decoded.userId,
      email:        decoded.email,
      role:         decoded.role,
      restaurantId: decoded.restaurantId
    };
  } catch {
    return null;   // token invalido, expirado o firmado con otra clave
  }
}
```

**Por que el JWT_SECRET debe ser el mismo en auth-service y api-gateway:**
Si la clave cambia, todos los tokens existentes se invalidan porque la firma no coincide. En produccion, este secreto se almacena como un Kubernetes Secret (no en el codigo fuente).

### Que datos lleva el JWT (payload completo)

```json
{
  "userId":       "4c270350-939d-47d3-a69e-2f1abb71e239",
  "email":        "ronaldo@gmail.com",
  "role":         "ADMIN",
  "restaurantId": null,
  "iat":          1740000000,    // issued at (Unix timestamp)
  "exp":          1740086400     // expira en 24 horas
}
```

Para un usuario RESTAURANT:

```json
{
  "userId":       "9a811a2a-c934-4a43-9661-81b48a921130",
  "email":        "ronaldo@hamburguesaselgordo.com",
  "role":         "RESTAURANT",
  "restaurantId": "9a811a2a-c934-4a43-9661-81b48a921130",
  "iat":          1740000000,
  "exp":          1740086400
}
```

Notar que `restaurantId === userId` para los usuarios de tipo RESTAURANT. Esto es intencional (ver Seccion 19).

### Como los middlewares usan req.user

Una vez que `authMiddleware` valida el token y puebla `req.user`, los middlewares de roles adicionales simplemente leen ese campo:

```typescript
// adminMiddleware.ts — permite solo ADMIN y RESTAURANT
export const adminMiddleware = (req, res, next) => {
  const role = (req as any).user?.role;
  if (role !== 'ADMIN' && role !== 'RESTAURANT') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  next();
};

// restaurantMiddleware.ts — permite solo RESTAURANT con restaurantId valido
export const restaurantMiddleware = (req, res, next) => {
  const user = (req as any).user;
  if (user?.role !== 'RESTAURANT' || !user?.restaurantId) {
    return res.status(403).json({ message: 'Solo restaurantes con ID valido' });
  }
  next();
};
```

Y en las rutas, los datos del usuario se usan directamente para filtrar datos:

```typescript
// adminRoutes.ts — el restaurante solo ve SUS pedidos
const restaurantId = (req as any).user.restaurantId;
const response = await orderServiceClient.getAllOrders({ restaurantId });
```

### Flujo completo de una peticion autenticada

```
FRONTEND                    API GATEWAY                  AUTH SERVICE
   |                              |                            |
   |  GET /admin/restaurant-orders|                            |
   |  Authorization: Bearer <jwt> |                            |
   |─────────────────────────────►|                            |
   |                              |  ValidateToken(<jwt>)      |
   |                              |───────────────────────────►|
   |                              |                    jwt.verify(token, JWT_SECRET)
   |                              |◄──────────────────────────|
   |                              |  { valid:true, role:'RESTAURANT', restaurantId:'...' }
   |                              |                            |
   |                              |  restaurantMiddleware ✓    |
   |                              |  orderServiceClient.getAllOrders({ restaurantId })
   |                              |                            |
   |◄─────────────────────────────|                            |
   |  { orders: [ ... ] }         |                            |
```

---

## 19. Asociacion Restaurante-Usuario

### El problema de diseno

En el sistema existen dos entidades separadas:

- **Usuario** (`auth_db.users`): representa a la persona con email y password
- **Restaurante** (`catalog_db.restaurants`): representa el negocio con nombre, direccion, etc.

Cuando un dueno de restaurante se registra, necesitamos que:
1. El usuario pueda autenticarse (auth-service)
2. El sistema sepa que restaurante le pertenece (para filtrar sus pedidos y productos)

### La decision de diseno: `user.id === restaurant.id`

La solucion implementada es que el **UUID del usuario y el UUID del restaurante son exactamente el mismo**. Esto elimina la necesidad de una tabla de relacion separada.

### Como se implementa en el registro

En `auth-service/src/application/usecases/RegisterUserUseCase.ts`:

```typescript
async execute(dto: RegisterUserDTO): Promise<{ user: User; message: string }> {
  // 1. Validar y verificar que el email no exista
  const errors = dto.validate();
  if (errors.length > 0) throw new Error(errors.join(', '));

  const existingUser = await this.userRepository.findByEmail(dto.email);
  if (existingUser) throw new Error('El email ya esta registrado');

  // 2. Pre-generar el UUID (antes de crear el usuario)
  const userId = uuidv4();   // ej: "9a811a2a-c934-4a43-9661-81b48a921130"

  // 3. Para rol RESTAURANT: restaurantId = userId (mismo UUID)
  const user = new User({
    id:           userId,
    email:        dto.email,
    password:     await this.passwordHasher.hash(dto.password),
    firstName:    dto.firstName,
    lastName:     dto.lastName,
    role:         dto.role,
    restaurantId: dto.role === UserRole.RESTAURANT ? userId : undefined
    //            ↑ Si es RESTAURANT, restaurantId = su propio userId
  });

  const savedUser = await this.userRepository.save(user);
  return { user: savedUser, message: 'Usuario registrado exitosamente' };
}
```

El campo `restaurant_id` se guarda en la tabla `users`:

```sql
-- auth_db.users
id            | 9a811a2a-c934-4a43-9661-81b48a921130
email         | ronaldo@hamburguesaselgordo.com
role          | RESTAURANT
restaurant_id | 9a811a2a-c934-4a43-9661-81b48a921130   ← igual al id
```

### Como el restaurantId viaja en el JWT

En `auth-service/src/infrastructure/grpc/handlers/AuthServiceHandler.ts`, al hacer Login:

```typescript
const token = this.jwtService.generate({
  userId:       user.id,
  email:        user.email,
  role:         user.role,
  restaurantId: user.restaurantId   // incluido en el JWT payload
});
```

De esta forma, el API Gateway sabe el restaurantId del usuario autenticado **sin necesidad de hacer una consulta adicional a la BD**. El restaurantId ya viene dentro del token firmado.

### Como se usa restaurantId en cada capa

```
JWT payload: { userId, email, role: 'RESTAURANT', restaurantId: '9a811a...' }
                                                          │
                                   ┌──────────────────────┤
                                   │                      │
                          restaurantMiddleware    adminRoutes.ts
                          - verifica que          - usa restaurantId para
                            restaurantId            filtrar ordenes:
                            no sea null             getAllOrders({ restaurantId })
                                                  - usa restaurantId para
                                                    crear productos en catalogo
```

### Relacion con catalog-service

En el catalogo, los productos tienen una FK a restaurantes:

```sql
-- catalog_db.products
restaurant_id | 9a811a2a-c934-4a43-9661-81b48a921130
```

Cuando el restaurante crea un producto via `POST /catalog/menu`, el API Gateway toma el `restaurantId` del JWT y lo pasa como parametro:

```typescript
router.post('/menu', authMiddleware, restaurantMiddleware, async (req, res) => {
  const restaurantId = (req as any).user.restaurantId;
  // restaurantId viene del JWT — no puede ser falsificado
  await catalogServiceClient.createProduct({ ...req.body, restaurantId });
});
```

### Por que este diseno es seguro

El `restaurantId` viaja dentro del JWT que esta **firmado con JWT_SECRET**. Si alguien intenta modificar el token para poner un `restaurantId` diferente, la firma digital no coincidira y el token sera rechazado. El restaurante solo puede ver y gestionar sus propios datos.

### Bug conocido y correguido

Durante el desarrollo se detecto que nuevos usuarios RESTAURANT registrados no podian ver sus pedidos activos. El problema era doble:

**Causa 1 — `RegisterUserUseCase.ts`**: El `restaurantId` no se asignaba al crear el usuario:
```typescript
// INCORRECTO (antes):
const user = new User({ id: uuidv4(), ..., restaurantId: undefined });

// CORRECTO (despues):
const userId = uuidv4();
const user = new User({ id: userId, ..., restaurantId: role === 'RESTAURANT' ? userId : undefined });
```

**Causa 2 — `PostgresUserRepository.ts`**: El INSERT no incluia la columna `restaurant_id`:
```typescript
// INCORRECTO (antes):
INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

// CORRECTO (despues):
INSERT INTO users (id, email, password, first_name, last_name, role, restaurant_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
-- values incluye: user.restaurantId || null
```

Los usuarios RESTAURANT existentes que ya habian sido registrados con el bug fueron corregidos directamente en la BD:

```sql
UPDATE users SET restaurant_id = id WHERE role = 'RESTAURANT' AND restaurant_id IS NULL;
-- 5 rows updated
```

---

*Delivereats — Software Avanzado, USAC 2026 — Practica 5 — Carnet 201114493*
