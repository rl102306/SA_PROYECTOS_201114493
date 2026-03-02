# Tutorial Completo: Delivereats - Sistema de Comida a Domicilio con Microservicios

**Proyecto:** Delivereats
**Tecnologías:** Node.js, gRPC, Protocol Buffers, PostgreSQL, Redis, Angular, Docker, Kubernetes
**Arquitectura:** Microservicios con Arquitectura Limpia (Clean Architecture)

---

## Tabla de Contenidos

1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [¿Qué es gRPC?](#2-qué-es-grpc)
3. [¿Qué es un archivo Proto?](#3-qué-es-un-archivo-proto)
4. [¿Qué es un Handler gRPC?](#4-qué-es-un-handler-grpc)
5. [¿Qué es Redis y cómo se usa aquí?](#5-qué-es-redis-y-cómo-se-usa-aquí)
6. [Arquitectura Limpia (Clean Architecture)](#6-arquitectura-limpia-clean-architecture)
7. [Kubernetes vs Docker Compose](#7-kubernetes-vs-docker-compose)
8. [Flujo Completo de Pago](#8-flujo-completo-de-pago)
9. [Flujo de Entrega con Foto](#9-flujo-de-entrega-con-foto)
10. [Flujo del Caché Redis con Fallback](#10-flujo-del-caché-redis-con-fallback)
11. [Archivos Nuevos y Modificados](#11-archivos-nuevos-y-modificados)
12. [Guía de Pruebas Locales](#12-guía-de-pruebas-locales)

---

## 1. Estructura del Proyecto

Delivereats es un sistema de comida a domicilio construido sobre una arquitectura de microservicios. Cada microservicio es independiente, tiene su propia base de datos y se comunica con los demás a través de gRPC.

### Microservicios y Puertos

| Servicio | Protocolo | Puerto | Base de Datos |
|---|---|---|---|
| `auth-service` | gRPC | 50052 | PostgreSQL :5432 |
| `catalog-service` (restaurant-catalog) | gRPC | 50051 | PostgreSQL :5433 |
| `order-service` | gRPC | 50053 | PostgreSQL :5434 |
| `delivery-service` | gRPC | 50054 | PostgreSQL :5435 |
| `notification-service` | gRPC | 50055 | Email SMTP |
| `fx-service` | gRPC | 50056 | Redis |
| `payment-service` | gRPC | 50057 | PostgreSQL :5436 |
| `api-gateway` | REST HTTP | 3000 | — |
| `frontend` (Angular) | HTTP | 4200 | — |

El `api-gateway` es el único punto de entrada para el cliente. Recibe peticiones HTTP REST desde el frontend (o cualquier cliente HTTP) y las convierte en llamadas gRPC hacia los microservicios internos.

### Estructura de Directorios General

```
SA_PROYECTOS_201114493/
├── api-gateway/
├── auth-service/
├── catalog-service/   (restaurant-catalog-service)
├── order-service/
├── delivery-service/
├── notification-service/
├── fx-service/
├── payment-service/
├── frontend/
├── docker-compose.yml
└── TUTORIAL.md
```

### Estructura Interna de Cada Microservicio (Arquitectura Limpia)

Cada microservicio sigue el mismo patrón de capas:

```
<nombre>-service/
└── src/
    ├── domain/
    │   ├── entities/          # Entidades del negocio (clases puras, sin dependencias externas)
    │   └── interfaces/        # Contratos/interfaces que deben cumplir los repositorios
    ├── application/
    │   ├── dtos/              # Objetos de transferencia de datos (Data Transfer Objects)
    │   └── usecases/          # Lógica de negocio (casos de uso)
    └── infrastructure/
        ├── database/
        │   └── postgres/      # Implementación concreta con PostgreSQL
        ├── grpc/
        │   ├── proto/         # Definiciones .proto (contrato del servicio gRPC)
        │   ├── handlers/      # Implementación del servidor gRPC
        │   └── clients/       # Clientes para llamar a otros microservicios gRPC
        └── di/                # Inyección de dependencias (composición de objetos)
```

Este patrón garantiza que el dominio y la lógica de negocio no dependan de detalles de infraestructura como la base de datos o el protocolo de red.

---

## 2. ¿Qué es gRPC?

### Definición

**gRPC** (Google Remote Procedure Call) es un framework moderno de comunicación de alto rendimiento desarrollado por Google. Permite que un programa cliente llame a funciones en un servidor remoto como si fueran funciones locales.

### Diferencias con REST

| Característica | REST (HTTP/1.1 + JSON) | gRPC (HTTP/2 + Protobuf) |
|---|---|---|
| Protocolo | HTTP/1.1 | HTTP/2 |
| Formato de datos | JSON (texto) | Protocol Buffers (binario) |
| Velocidad | Moderada | Muy alta (5-10x más rápido) |
| Tipado | Débil (JSON) | Fuerte (esquema obligatorio) |
| Streaming | No nativo | Nativo (bidireccional) |
| Contrato de API | OpenAPI/Swagger (opcional) | .proto (obligatorio) |
| Uso ideal | APIs públicas, navegadores | Comunicación interna entre microservicios |

### Por qué Delivereats usa gRPC internamente

En Delivereats, la comunicación entre microservicios (por ejemplo, entre `payment-service` y `fx-service`) usa gRPC porque:

- **Rendimiento:** Los mensajes en binario (Protobuf) son más pequeños y rápidos de serializar/deserializar que JSON.
- **Contrato fuerte:** El archivo `.proto` define exactamente qué campos existen, sus tipos y si son obligatorios. Esto previene errores de integración.
- **Generación de código:** A partir del `.proto`, se genera automáticamente el código cliente y servidor en cualquier lenguaje.
- **HTTP/2:** Permite multiplexar múltiples llamadas sobre una sola conexión TCP, reduciendo la latencia.

### Ejemplo Real: fx.proto

El `fx-service` expone un único método gRPC para obtener la tasa de cambio entre dos monedas:

```protobuf
syntax = "proto3";
package fx;

// Definición del servicio: qué RPCs expone
service FxService {
  rpc GetExchangeRate (ExchangeRateRequest) returns (ExchangeRateResponse);
}

// Mensaje de entrada: qué datos recibe el servidor
message ExchangeRateRequest {
  string from_currency = 1;   // Moneda origen (ej: "USD")
  string to_currency   = 2;   // Moneda destino (ej: "GTQ")
}

// Mensaje de salida: qué datos devuelve el servidor
message ExchangeRateResponse {
  bool   success   = 1;   // true si la operación fue exitosa
  double rate      = 2;   // Tasa de cambio (ej: 7.75)
  string source    = 3;   // "API", "CACHE" o "CACHE_FALLBACK"
  string timestamp = 4;   // Momento de la consulta
  string message   = 5;   // Mensaje de error si success=false
}
```

Cuando el `payment-service` quiere saber cuántos GTQ equivalen a 100 USD, hace una llamada gRPC al `fx-service` con `from_currency: "USD"` y `to_currency: "GTQ"`. El `fx-service` responde con `rate: 7.75` (por ejemplo), y el `payment-service` multiplica: `100 * 7.75 = 775 GTQ`.

### Flujo gRPC en Delivereats

```
Frontend (Angular :4200)
        |
        | HTTP REST
        v
api-gateway (:3000)
        |
        | gRPC calls (HTTP/2 + Protobuf)
        |
   +----+------+----------+----------+-----------+
   |           |          |          |           |
   v           v          v          v           v
auth-service  catalog  order-service  delivery  payment-service
(:50052)    (:50051)   (:50053)     (:50054)   (:50057)
                                                   |
                                         +---------+--------+
                                         |                  |
                                         v                  v
                                    fx-service        notification-service
                                    (:50056)           (:50055)
```

---

## 3. ¿Qué es un archivo Proto?

### Definición

Un archivo `.proto` (Protocol Buffer) es un **lenguaje de definición de interfaz** (IDL) que describe:
- Los **mensajes** (estructuras de datos) que se intercambian
- Los **servicios** (colecciones de métodos remotos que se pueden invocar)

Es el "contrato" entre el cliente y el servidor. Tanto el cliente como el servidor deben usar el mismo `.proto` para comunicarse correctamente.

### Sintaxis Proto3

```protobuf
syntax = "proto3";        // Versión del lenguaje (proto3 es la actual)
package nombre_paquete;   // Namespace para evitar colisiones de nombres

// Un "message" es como una clase/struct de datos
message NombreDelMensaje {
  tipo_de_dato nombre_campo = numero_de_campo;
}

// Un "service" define los métodos remotos disponibles
service NombreDelServicio {
  rpc NombreDelMetodo (TipoRequest) returns (TipoResponse);
}
```

### Tipos de Datos Disponibles en Proto3

| Tipo Proto | Equivalente TypeScript/JS | Descripción |
|---|---|---|
| `string` | `string` | Texto UTF-8 |
| `int32` | `number` | Entero 32 bits |
| `int64` | `string` o `Long` | Entero 64 bits |
| `double` | `number` | Número de punto flotante doble precisión |
| `float` | `number` | Número de punto flotante simple precisión |
| `bool` | `boolean` | Verdadero/falso |
| `bytes` | `Buffer` | Datos binarios crudos |
| `repeated T` | `T[]` | Arreglo de elementos de tipo T |

### Importancia de los Números de Campo

Cada campo tiene un **número de campo** (1, 2, 3...). Estos números son críticos porque:
- Se usan en la codificación binaria (no los nombres)
- **NUNCA se deben reusar** una vez que el servicio está en producción
- Al añadir nuevos campos, siempre usar el siguiente número disponible
- Al eliminar campos, marcarlos como `reserved` para evitar reusos accidentales

```protobuf
message Ejemplo {
  string nombre = 1;    // Número 1: se codifica como campo #1 en binario
  int32  edad   = 2;    // Número 2: se codifica como campo #2 en binario
  // Si se elimina "edad", se debe reservar:
  // reserved 2;
  // reserved "edad";
}
```

### Ejemplo Real: payment.proto

El `payment-service` define los siguientes mensajes y servicios:

```protobuf
syntax = "proto3";
package payment;

service PaymentService {
  rpc ProcessPayment  (ProcessPaymentRequest)  returns (ProcessPaymentResponse);
  rpc GetPayment      (GetPaymentRequest)       returns (GetPaymentResponse);
  rpc RefundPayment   (RefundPaymentRequest)    returns (RefundPaymentResponse);
}

// Solicitud para procesar un pago
message ProcessPaymentRequest {
  string order_id        = 1;   // ID del pedido a pagar
  double amount          = 2;   // Monto en la moneda indicada
  string currency        = 3;   // Moneda: "GTQ" o "USD"
  string payment_method  = 4;   // "CREDIT_CARD", "DEBIT_CARD", "CASH"
  string card_holder     = 5;   // Nombre en la tarjeta
  string card_last_four  = 6;   // Últimos 4 dígitos
  string user_id         = 7;   // ID del usuario que paga
  string user_email      = 8;   // Email para la notificación
}

// Respuesta del procesamiento de pago
message ProcessPaymentResponse {
  bool   success          = 1;
  string payment_id       = 2;
  string status           = 3;   // "COMPLETED", "FAILED"
  double amount_gtq       = 4;   // Monto en GTQ
  double amount_usd       = 5;   // Monto en USD
  double exchange_rate    = 6;   // Tasa usada
  string message          = 7;
}
```

### Diferencia entre Service y Message

- **`message`**: Define la **estructura de los datos**. Es equivalente a una clase de datos o un DTO. No tiene comportamiento, solo campos.
- **`service`**: Define los **métodos remotos** disponibles. Cada `rpc` dentro del servicio es una función que el cliente puede llamar remotamente. Siempre recibe un `message` de entrada y devuelve un `message` de salida.

---

## 4. ¿Qué es un Handler gRPC?

### Definición

Un **Handler gRPC** (también llamado handler del servidor o implementación del servicio) es la clase que implementa los métodos definidos en el archivo `.proto`. Es el equivalente al "controlador" en una arquitectura REST, pero para gRPC.

El handler:
1. Recibe la llamada gRPC del cliente (con los datos del `request`)
2. Delega la lógica al caso de uso correspondiente (UseCase)
3. Transforma el resultado en un `response` gRPC
4. Llama al `callback` con la respuesta (o el error)

### Estructura del Handler

```
Handler gRPC
    |
    |-- Recibe: call.request (datos del cliente)
    |
    |-- Delega a: UseCase.execute(...)
    |
    |-- Responde con: callback(null, responseObject)
    |                  o
    |-- Error con:    callback(error)
```

### Ejemplo Real: FxServiceHandler.ts

```typescript
// infrastructure/grpc/handlers/FxServiceHandler.ts

import { GetExchangeRateUseCase } from '../../../application/usecases/GetExchangeRateUseCase';

export class FxServiceHandler {
  // Se inyecta el caso de uso en el constructor (Dependency Injection)
  constructor(private readonly getExchangeRateUseCase: GetExchangeRateUseCase) {}

  /**
   * Implementa el RPC "GetExchangeRate" definido en fx.proto
   *
   * @param call  - Contiene call.request con los datos del cliente
   * @param callback - Función para enviar la respuesta de vuelta al cliente
   */
  async GetExchangeRate(call: any, callback: any): Promise<void> {
    try {
      // 1. Extraer datos del request gRPC
      const { from_currency, to_currency } = call.request;

      // 2. Delegar al caso de uso (lógica de negocio)
      const result = await this.getExchangeRateUseCase.execute(
        from_currency,
        to_currency
      );

      // 3. Responder con éxito
      callback(null, {
        success:   true,
        rate:      result.rate,
        source:    result.source,      // "API", "CACHE", "CACHE_FALLBACK"
        timestamp: result.timestamp,
        message:   ''
      });

    } catch (error: any) {
      // 4. En caso de error, responder con success: false
      callback(null, {
        success: false,
        rate:    0,
        source:  '',
        message: error.message
      });
    }
  }
}
```

### Convención Importante: callback(null, response) vs callback(error)

En gRPC con Node.js existen dos formas de responder:

```typescript
// Forma 1: Respuesta exitosa (el primer argumento es null = sin error gRPC)
callback(null, { success: true, data: "..." });

// Forma 2: Error a nivel de protocolo gRPC (corta la conexión)
callback(new Error("Error interno del servidor"));

// Patrón usado en Delivereats: siempre usar Forma 1
// Se usa success: false en el campo del response para indicar errores de negocio
// Esto evita que el cliente gRPC lance una excepción no controlada
callback(null, { success: false, message: "Orden no encontrada" });
```

Delivereats usa la convención de **siempre pasar `null` como primer argumento** y manejar los errores de negocio con `success: false` dentro del objeto response. Esto simplifica el manejo de errores en el cliente.

### Registro del Handler en el Servidor

```typescript
// infrastructure/di/container.ts o server.ts

const fxHandler = new FxServiceHandler(getExchangeRateUseCase);

// Se registra el handler en el servidor gRPC
server.addService(FxServiceDefinition, {
  GetExchangeRate: fxHandler.GetExchangeRate.bind(fxHandler)
  // El nombre del método debe coincidir EXACTAMENTE con el definido en .proto
});
```

---

## 5. ¿Qué es Redis y cómo se usa aquí?

### ¿Qué es Redis?

**Redis** (Remote Dictionary Server) es una base de datos **en memoria** (in-memory) de tipo clave-valor (key-value). Sus características principales son:

- **Velocidad extrema:** Los datos viven en RAM, por lo que las operaciones son del orden de microsegundos.
- **TTL (Time To Live):** Cada clave puede tener un tiempo de expiración. Redis la elimina automáticamente al vencerse.
- **Estructuras de datos:** Soporta strings, listas, sets, hashes, sorted sets, etc.
- **Persistencia opcional:** Puede guardar snapshots en disco, pero su principal uso es como caché.

### Comandos Básicos de Redis

```bash
# Guardar una clave con valor (sin expiración)
SET mi_clave "mi_valor"

# Obtener el valor de una clave
GET mi_clave

# Guardar con TTL de 86400 segundos (24 horas)
SETEX mi_clave 86400 "mi_valor"

# Ver cuántos segundos le quedan a una clave
TTL mi_clave
# Devuelve: tiempo en segundos, -1 si no tiene TTL, -2 si no existe

# Eliminar una clave manualmente
DEL mi_clave

# Listar todas las claves que coincidan con un patrón
KEYS "fx:*"
```

### Cómo usa Redis el fx-service

El `fx-service` usa Redis para **cachear las tasas de cambio**. Consultar la API externa (`open.er-api.com`) en cada solicitud sería lento e innecesario, ya que las tasas de cambio no cambian segundo a segundo.

#### Estrategia Dual-Key (Dos Claves por Tasa)

El `fx-service` guarda **dos claves** en Redis por cada par de monedas:

| Clave | TTL | Propósito |
|---|---|---|
| `fx:USD:GTQ` | 24 horas | Clave principal con expiración |
| `fx:stale:fx:USD:GTQ` | Sin TTL (permanente) | Clave de respaldo ("stale") |

Esto permite manejar tres escenarios:

1. **CACHE HIT:** La clave `fx:USD:GTQ` existe → devolver directamente (source: `CACHE`)
2. **API OK:** La clave no existe → consultar API → guardar en ambas claves → devolver (source: `API`)
3. **CACHE_FALLBACK:** La clave expiró Y la API falló → usar `fx:stale:fx:USD:GTQ` → devolver último valor conocido (source: `CACHE_FALLBACK`)

### Flujo Completo del fx-service (4 Pasos)

```
Paso 1: Cliente pide tasa USD → GTQ
        (payment-service llama gRPC GetExchangeRate)
               |
               v
Paso 2: fx-service busca en Redis
        GET "fx:USD:GTQ"
               |
        +------+------+
        |             |
       HIT           MISS
        |             |
        v             v
   Responder     Paso 3: Llamar API externa
 (source:CACHE)  open.er-api.com/v6/latest/USD
                       |
                 +-----+------+
                 |            |
               OK           FAIL
                 |            |
                 v            v
           Guardar en    Paso 4: Buscar clave stale
           Redis:        GET "fx:stale:fx:USD:GTQ"
           SETEX fx:USD:GTQ 86400 rate         |
           SET fx:stale:fx:USD:GTQ rate   +----+----+
                 |                        |        |
                 v                       HIT      MISS
           Responder               Responder   Error 503:
          (source:API)          (source:         "No hay
                               CACHE_FALLBACK)  tasa disponible"
```

### Implementación Real: RedisExchangeRateCache

```typescript
// infrastructure/cache/RedisExchangeRateCache.ts

export class RedisExchangeRateCache {
  private readonly TTL_SECONDS = 86400;       // 24 horas para la clave normal
  private readonly STALE_PREFIX = 'fx:stale:'; // Prefijo de la clave stale

  constructor(private readonly redisClient: RedisClient) {}

  /**
   * Construye la clave principal: "fx:USD:GTQ"
   */
  private buildKey(from: string, to: string): string {
    return `fx:${from}:${to}`;
  }

  /**
   * Intenta obtener la tasa del caché normal (con TTL)
   */
  async get(from: string, to: string): Promise<number | null> {
    const key = this.buildKey(from, to);
    const value = await this.redisClient.get(key);
    return value ? parseFloat(value) : null;
  }

  /**
   * Guarda la tasa en ambas claves:
   * - Principal con TTL de 24h
   * - Stale sin TTL (permanente, como respaldo)
   */
  async set(from: string, to: string, rate: number): Promise<void> {
    const key      = this.buildKey(from, to);
    const staleKey = `${this.STALE_PREFIX}${key}`;
    const value    = rate.toString();

    // Clave principal: expira en 24 horas
    await this.redisClient.setEx(key, this.TTL_SECONDS, value);
    // Clave stale: nunca expira (siempre tiene el último valor conocido)
    await this.redisClient.set(staleKey, value);
  }

  /**
   * Obtiene la clave stale cuando la API y el caché normal fallan
   */
  async getStale(from: string, to: string): Promise<number | null> {
    const key      = this.buildKey(from, to);
    const staleKey = `${this.STALE_PREFIX}${key}`;
    const value    = await this.redisClient.get(staleKey);
    return value ? parseFloat(value) : null;
  }
}
```

### Configuración de Redis en Docker Compose

```yaml
# docker-compose.yml (fragmento)
redis:
  image: redis:7-alpine
  container_name: delivereats-redis
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --save 60 1 --loglevel warning
```

---

## 6. Arquitectura Limpia (Clean Architecture)

### ¿Qué es la Arquitectura Limpia?

La **Arquitectura Limpia** (Clean Architecture), propuesta por Robert C. Martin (Uncle Bob), organiza el código en capas concéntricas donde **las dependencias solo fluyen hacia adentro**. Las capas internas no saben nada de las externas.

```
+--------------------------------------------------+
|  Infrastructure (detalles técnicos)               |
|   +------------------------------------------+   |
|   |  Application (casos de uso)              |   |
|   |   +----------------------------------+   |   |
|   |   |  Domain (reglas del negocio)    |   |   |
|   |   |                                  |   |   |
|   |   |   Entities / Interfaces          |   |   |
|   |   +----------------------------------+   |   |
|   |                                          |   |
|   |   UseCases / DTOs                        |   |
|   +------------------------------------------+   |
|                                                  |
|   gRPC Handlers / PostgreSQL / Redis / HTTP      |
+--------------------------------------------------+
```

### Las Tres Capas en Delivereats

#### Capa 1: Domain (Dominio)

Contiene las reglas de negocio puras. No depende de ninguna librería externa.

```typescript
// domain/entities/Order.ts
export class Order {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly items: OrderItem[],
    public status: OrderStatus,           // 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED'
    public readonly deliveryAddress: string,
    public readonly totalAmount: number,
    public readonly createdAt: Date
  ) {}

  // Lógica de negocio pura: sin base de datos, sin HTTP
  canBeCancelled(): boolean {
    return this.status === 'PENDING';
  }

  markAsPaid(): void {
    if (this.status !== 'PENDING') {
      throw new Error(`No se puede marcar como PAID un pedido en estado ${this.status}`);
    }
    this.status = 'PAID';
  }
}

// domain/interfaces/IOrderRepository.ts
export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  findAll(filters?: OrderFilters): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
}
```

#### Capa 2: Application (Casos de Uso)

Orquesta la lógica de negocio. Depende del dominio, pero no de la infraestructura.

```typescript
// application/usecases/ProcessPaymentUseCase.ts
export class ProcessPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,   // Interfaz (dominio)
    private readonly fxServiceClient: IFxServiceClient,       // Interfaz (dominio)
    private readonly orderServiceClient: IOrderServiceClient, // Interfaz (dominio)
    private readonly notificationClient: INotificationClient  // Interfaz (dominio)
  ) {}

  async execute(dto: ProcessPaymentDTO): Promise<PaymentResult> {
    // 1. Obtener tasa de cambio
    const fxResult = await this.fxServiceClient.getExchangeRate('USD', 'GTQ');

    // 2. Calcular montos
    const amountGTQ = dto.currency === 'GTQ' ? dto.amount : dto.amount * fxResult.rate;
    const amountUSD = dto.currency === 'USD' ? dto.amount : dto.amount / fxResult.rate;

    // 3. Crear y guardar el pago
    const payment = new Payment(uuid(), dto.orderId, amountGTQ, amountUSD, 'COMPLETED');
    await this.paymentRepository.save(payment);

    // 4. Actualizar estado del pedido
    await this.orderServiceClient.updateOrderStatus(dto.orderId, 'PAID');

    // 5. Enviar notificación por email
    await this.notificationClient.sendPaymentConfirmation({
      email:    dto.userEmail,
      orderId:  dto.orderId,
      amountGTQ,
      amountUSD,
      rate:     fxResult.rate
    });

    return { paymentId: payment.id, status: 'COMPLETED', amountGTQ, amountUSD };
  }
}
```

#### Capa 3: Infrastructure (Infraestructura)

Implementa los contratos del dominio con tecnologías concretas.

```typescript
// infrastructure/database/postgres/PostgresOrderRepository.ts
// Implementación concreta de IOrderRepository usando PostgreSQL

export class PostgresOrderRepository implements IOrderRepository {
  constructor(private readonly pool: Pool) {}  // Pool de conexiones PostgreSQL

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(filters?: OrderFilters): Promise<Order[]> {
    let query  = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (filters?.status) {
      query += ` AND status = ANY($${paramIdx++})`;
      params.push(filters.status);
    }
    if (filters?.from) {
      query += ` AND created_at >= $${paramIdx++}`;
      params.push(filters.from);
    }
    if (filters?.to) {
      query += ` AND created_at <= $${paramIdx++}`;
      params.push(filters.to);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  private mapRowToEntity(row: any): Order {
    return new Order(
      row.id,
      row.user_id,
      row.restaurant_id,
      JSON.parse(row.items),
      row.status,
      row.delivery_address,
      row.total_amount,
      row.created_at
    );
  }
}
```

### Flujo Completo de una Petición

```
[1] Cliente HTTP (Frontend Angular)
         |
         | POST /payments  (HTTP REST + JSON)
         v
[2] api-gateway (Express.js :3000)
         |
         | Valida JWT, extrae userId/email
         | Llama gRPC PaymentService.ProcessPayment
         v
[3] payment-service Handler (FxServiceHandler.ts)
         |
         | Desempaqueta call.request
         | Llama ProcessPaymentUseCase.execute(dto)
         v
[4] ProcessPaymentUseCase (Lógica de negocio)
         |
         +---> FxServiceClient.getExchangeRate(USD, GTQ)
         |           |
         |           v (gRPC call)
         |     fx-service → Redis → API externa
         |
         +---> PaymentRepository.save(payment)
         |           |
         |           v
         |     PostgreSQL (payment-db :5436)
         |
         +---> OrderServiceClient.updateOrderStatus(orderId, PAID)
         |           |
         |           v (gRPC call)
         |     order-service → PostgreSQL (order-db :5434)
         |
         +---> NotificationClient.sendPaymentConfirmation(...)
                     |
                     v (gRPC call)
               notification-service → SMTP (Email)
```

---

## 7. Kubernetes vs Docker Compose

### Docker Compose

**Docker Compose** es una herramienta para definir y ejecutar aplicaciones multi-contenedor en una **sola máquina**. Usa un archivo `docker-compose.yml` para describir todos los servicios, redes y volúmenes.

```yaml
# docker-compose.yml (fragmento de Delivereats)
version: '3.8'

services:
  fx-service:
    build: ./fx-service
    container_name: delivereats-fx-service
    environment:
      - REDIS_URL=redis://redis:6379
      - EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
    ports:
      - "50056:50056"
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    container_name: delivereats-redis
    ports:
      - "6379:6379"

  payment-service:
    build: ./payment-service
    container_name: delivereats-payment-service
    environment:
      - DB_HOST=payment-db
      - FX_SERVICE_URL=fx-service:50056
      - ORDER_SERVICE_URL=order-service:50053
    depends_on:
      - payment-db
      - fx-service

  payment-db:
    image: postgres:15-alpine
    container_name: delivereats-payment-db
    environment:
      POSTGRES_DB: payment_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5436:5432"
```

### Kubernetes

**Kubernetes** (K8s) es un sistema de orquestación de contenedores para **entornos de producción**. Administra múltiples máquinas (nodos) y garantiza que los servicios estén siempre corriendo, escalados y actualizados.

Componentes principales en Kubernetes:

- **Pod:** La unidad mínima. Contiene uno o más contenedores.
- **Deployment:** Gestiona réplicas de Pods y actualizaciones.
- **Service:** Punto de entrada estable para acceder a los Pods.
- **ConfigMap / Secret:** Configuración y datos sensibles.
- **HorizontalPodAutoscaler:** Escala automáticamente según carga.

### Tabla Comparativa

| Característica | Docker Compose | Kubernetes |
|---|---|---|
| Caso de uso principal | Desarrollo local | Producción |
| Número de máquinas | 1 (local) | N (cluster) |
| Alta disponibilidad | No | Si (múltiples réplicas) |
| Self-healing | No | Si (reinicia Pods caídos) |
| Autoescalado | No | Si (HPA) |
| Rolling updates | No | Si (sin downtime) |
| Complejidad | Baja | Alta |
| Tiempo para levantar | Segundos | Minutos |
| Ideal para | Desarrollo, CI/CD, demos | Producción, staging |
| Networking | Red interna Docker | Red de cluster (CNI) |
| Almacenamiento | Volúmenes Docker | PersistentVolumeClaims |

### ¿Cuándo usar cada uno?

**Usar Docker Compose cuando:**
- Estás desarrollando localmente y necesitas levantar todo el stack rápido
- Haces demos o presentaciones
- El proyecto es pequeño y no requiere alta disponibilidad
- Quieres simplicidad de configuración

**Usar Kubernetes cuando:**
- El sistema está en producción y necesita 99.9%+ de disponibilidad
- El tráfico varía y necesitas autoescalado automático
- Quieres hacer deploys sin downtime (rolling updates)
- Tienes múltiples desarrolladores y equipos
- Necesitas gestión avanzada de secretos y configuración

### Ejemplo de Deployment en Kubernetes (para referencia)

```yaml
# k8s/fx-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fx-service
spec:
  replicas: 2           # 2 réplicas para HA
  selector:
    matchLabels:
      app: fx-service
  template:
    metadata:
      labels:
        app: fx-service
    spec:
      containers:
      - name: fx-service
        image: delivereats/fx-service:latest
        ports:
        - containerPort: 50056
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: fx-secrets
              key: redis-url
---
apiVersion: v1
kind: Service
metadata:
  name: fx-service
spec:
  selector:
    app: fx-service
  ports:
  - port: 50056
    targetPort: 50056
```

---

## 8. Flujo Completo de Pago

### Descripción

Cuando un cliente realiza un pago en Delivereats, se desencadena una cadena de llamadas entre varios microservicios. El `payment-service` actúa como orquestador: consulta la tasa de cambio, actualiza el pedido y envía la notificación.

### Diagrama ASCII del Flujo de Pago

```
CLIENTE (Frontend Angular)
  |
  |  POST /payments
  |  Body: { orderId, amount: 100, currency: "GTQ",
  |          paymentMethod: "CREDIT_CARD",
  |          cardHolder: "Juan Pérez", cardLastFour: "1234" }
  |
  v
API-GATEWAY (:3000)
  |-- Middleware: Verifica JWT → extrae userId, userEmail, userRole
  |-- Valida que el usuario sea CLIENT o ADMIN
  |
  |  gRPC: PaymentService.ProcessPayment(request)
  v
PAYMENT-SERVICE (:50057)
  |
  |-- [Paso 4] gRPC: FxService.GetExchangeRate(USD, GTQ)
  |    |
  |    v
  |   FX-SERVICE (:50056)
  |    |-- Redis GET "fx:USD:GTQ"
  |    |   ├─ HIT  → devuelve rate (source: CACHE)
  |    |   └─ MISS → llama open.er-api.com
  |    |              ├─ OK   → guarda en Redis, devuelve (source: API)
  |    |              └─ FAIL → usa stale key (source: CACHE_FALLBACK)
  |    |
  |    └─> Responde: { success: true, rate: 7.75, source: "CACHE" }
  |
  |-- Calcula: amountGTQ = 100, amountUSD = 100 / 7.75 = 12.90
  |
  |-- Crea registro en payment-db (PostgreSQL :5436)
  |   INSERT INTO payments (id, order_id, amount_gtq, amount_usd, status)
  |
  |-- [Paso 5] gRPC: OrderService.UpdateOrderStatus(orderId, "PAID")
  |    |
  |    v
  |   ORDER-SERVICE (:50053)
  |    |-- UPDATE orders SET status = 'PAID' WHERE id = orderId
  |    └─> Responde: { success: true }
  |
  |-- [Paso 6] gRPC: NotificationService.SendPaymentConfirmation(...)
  |    |
  |    v
  |   NOTIFICATION-SERVICE (:50055)
  |    |-- Genera email con template:
  |    |   "Tu pago de Q100.00 (USD $12.90) fue confirmado"
  |    |-- Envía via SMTP (Nodemailer)
  |    └─> Responde: { success: true }
  |
  └─> Responde al api-gateway:
      { success: true, paymentId: "uuid", amountGTQ: 100, amountUSD: 12.90, rate: 7.75 }

API-GATEWAY
  └─> Responde al cliente:
      HTTP 200 { paymentId, amountGTQ: 100.00, amountUSD: 12.90, exchangeRate: 7.75 }
```

### Template del Email de Confirmación

El `notification-service` genera un email HTML cuando el tipo es `PAYMENT_CONFIRMED`:

```typescript
// application/usecases/SendNotificationUseCase.ts (fragmento)

private generatePaymentConfirmedTemplate(data: NotificationData): string {
  return `
    <h2>Pago Confirmado - Delivereats</h2>
    <p>Tu pedido #${data.orderId} ha sido pagado exitosamente.</p>
    <table>
      <tr><td>Monto en GTQ:</td><td>Q${data.amountGTQ?.toFixed(2)}</td></tr>
      <tr><td>Monto en USD:</td><td>$${data.amountUSD?.toFixed(2)}</td></tr>
      <tr><td>Tasa de cambio:</td><td>${data.exchangeRate} GTQ/USD</td></tr>
      <tr><td>Método de pago:</td><td>${data.paymentMethod}</td></tr>
    </table>
    <p>Pronto recibirás tu pedido. ¡Gracias por usar Delivereats!</p>
  `;
}
```

---

## 9. Flujo de Entrega con Foto

### Descripción

Cuando el repartidor completa una entrega, debe subir una foto como evidencia. El frontend convierte la imagen a Base64 y la envía al `delivery-service` que la guarda en PostgreSQL.

### Diagrama ASCII del Flujo de Entrega

```
REPARTIDOR (Frontend Angular :4200)
  |
  |  1. Ver entregas disponibles (GET /deliveries/available)
  |     └─> Lista de pedidos en estado PAID asignables
  |
  |  2. Aceptar entrega (PUT /deliveries/:id/accept)
  |     └─> Estado cambia a ASSIGNED
  |
  |  3. Marcar recolectado (PUT /deliveries/:id/status)
  |     Body: { status: "PICKED_UP" }
  |     └─> Estado cambia a PICKED_UP
  |
  |  4. Marcar en camino (PUT /deliveries/:id/status)
  |     Body: { status: "IN_TRANSIT" }
  |     └─> Estado cambia a IN_TRANSIT
  |
  |  5. Modal "Confirmar Entrega" aparece en el frontend
  |     └─> Usuario selecciona imagen del sistema
  |
  |  6. Frontend convierte imagen a Base64:
  |     ┌─────────────────────────────────────────────────┐
  |     │  const reader = new FileReader();                │
  |     │  reader.onload = (e) => {                        │
  |     │    const base64 = e.target.result as string;     │
  |     │    // base64 = "data:image/jpeg;base64,/9j/4..." │
  |     │    this.deliveryPhoto = base64;                  │
  |     │  };                                              │
  |     │  reader.readAsDataURL(selectedFile);             │
  |     └─────────────────────────────────────────────────┘
  |
  |  7. PUT /deliveries/:id/status
  |     Body: { status: "DELIVERED", delivery_photo: "<base64>" }
  |
  v
API-GATEWAY (:3000)
  |-- Valida JWT (rol DELIVERY o ADMIN)
  |
  |  gRPC: DeliveryService.UpdateDeliveryStatus(request)
  |  request: { deliveryId, status: "DELIVERED", deliveryPhoto: "<base64>" }
  v
DELIVERY-SERVICE (:50054)
  |
  |-- Handler: DeliveryServiceHandler.UpdateDeliveryStatus(call, callback)
  |
  |-- UseCase: UpdateDeliveryStatusUseCase.execute(dto)
  |   |
  |   |-- Valida: si status === "DELIVERED" y deliveryPhoto está vacío → Error
  |   |   "Se requiere foto de entrega para marcar como DELIVERED"
  |   |
  |   |-- Actualiza entidad: delivery.status = "DELIVERED"
  |   |                      delivery.deliveryPhoto = base64String
  |   |
  |   └─> Repository.update(delivery)
  |
  |-- PostgreSQL (delivery-db :5435):
  |   UPDATE deliveries
  |   SET status = 'DELIVERED',
  |       delivery_photo = '<base64_string_muy_largo>',
  |       updated_at = NOW()
  |   WHERE id = :deliveryId
  |
  └─> Responde: { success: true, message: "Entrega completada" }

API-GATEWAY
  └─> HTTP 200 { message: "Estado actualizado exitosamente" }

ADMIN (Frontend Angular)
  |
  |  GET /admin/orders?status=DELIVERED
  |  └─> Lista pedidos con delivery_photo thumbnail
  |
  |  Renderiza thumbnail:
  |  <img [src]="order.deliveryPhoto" class="thumbnail" />
  └─>  (Base64 se muestra directamente como fuente de imagen)
```

### Entidad Delivery con el Campo delivery_photo

```typescript
// domain/entities/Delivery.ts
export class Delivery {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly deliveryPersonId: string,
    public status: DeliveryStatus,    // ASSIGNED | PICKED_UP | IN_TRANSIT | DELIVERED
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deliveryPhoto?: string     // Imagen en Base64 (solo cuando DELIVERED)
  ) {}
}
```

### Esquema de la Tabla en PostgreSQL

```sql
-- infrastructure/database/postgres/config.ts
CREATE TABLE IF NOT EXISTS deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL,
  delivery_person_id UUID NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
  delivery_photo    TEXT,          -- TEXT permite strings muy largos (Base64)
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

---

## 10. Flujo del Caché Redis con Fallback

### Diagrama Completo

```
Cliente llama: GET /fx/rate?from=USD&to=GTQ
                        |
                        v
             api-gateway → gRPC → FxService.GetExchangeRate
                        |
                        v
             GetExchangeRateUseCase.execute("USD", "GTQ")
                        |
                        v
             RedisCache.get("USD", "GTQ")
             → Redis GET "fx:USD:GTQ"
                        |
           +------------+------------+
           |                         |
          HIT                       MISS
           |                         |
           v                         v
    Retornar rate              Llamar API externa:
    source: "CACHE"            GET open.er-api.com/v6/latest/USD
    (TTL aún vigente)                    |
                               +--------+---------+
                               |                  |
                           HTTP 200           HTTP Error
                           rates.GTQ=7.75    (timeout, 503, etc.)
                               |                  |
                               v                  v
                     RedisCache.set(           RedisCache.getStale("USD","GTQ")
                       "USD","GTQ",7.75)       → Redis GET "fx:stale:fx:USD:GTQ"
                       |                               |
                  SETEX fx:USD:GTQ                +----+----+
                    86400 "7.75"                  |         |
                  SET fx:stale:fx:USD:GTQ        HIT       MISS
                    "7.75"                        |         |
                       |                          v         v
                       v                    Retornar    Lanzar Error:
                  Retornar rate             rate        "No exchange rate
                  source: "API"             source:      available for
                                           "CACHE_FALLBACK"  USD:GTQ"
```

### Código del Caso de Uso

```typescript
// application/usecases/GetExchangeRateUseCase.ts

export class GetExchangeRateUseCase {
  constructor(
    private readonly cache: IExchangeRateCache,    // RedisExchangeRateCache
    private readonly apiClient: IExchangeRateAPI   // ExchangeRateApiClient
  ) {}

  async execute(from: string, to: string): Promise<ExchangeRateResult> {
    // 1. Intentar desde caché (clave con TTL)
    const cachedRate = await this.cache.get(from, to);
    if (cachedRate !== null) {
      return {
        rate:      cachedRate,
        source:    'CACHE',
        timestamp: new Date().toISOString()
      };
    }

    // 2. Llamar a la API externa
    try {
      const apiRate = await this.apiClient.getRate(from, to);

      // 3. Guardar en Redis (normal + stale)
      await this.cache.set(from, to, apiRate);

      return {
        rate:      apiRate,
        source:    'API',
        timestamp: new Date().toISOString()
      };
    } catch (apiError) {
      // 4. API falló → intentar clave stale
      const staleRate = await this.cache.getStale(from, to);
      if (staleRate !== null) {
        return {
          rate:      staleRate,
          source:    'CACHE_FALLBACK',
          timestamp: new Date().toISOString()
        };
      }

      // 5. Sin datos disponibles → error crítico
      throw new Error(
        `No hay tasa de cambio disponible para ${from}:${to}. ` +
        `La API está caída y no hay datos en caché.`
      );
    }
  }
}
```

### Verificar el Comportamiento del Caché

Para observar el campo `source` en las respuestas:

```bash
# Primera llamada: source debería ser "API" (o "CACHE" si ya fue consultada antes)
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# Respuesta: { "success": true, "rate": 7.75, "source": "API", "timestamp": "..." }

# Segunda llamada inmediata: source es "CACHE" (Redis tiene la clave)
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# Respuesta: { "success": true, "rate": 7.75, "source": "CACHE", "timestamp": "..." }
```

---

## 11. Archivos Nuevos y Modificados

Esta sección lista todos los archivos creados o modificados para implementar las funcionalidades de pago, tipo de cambio, panel de administración y flujo de entrega con foto.

### Archivos Nuevos

#### fx-service/ (servicio completo - 12 archivos)

```
fx-service/
├── src/
│   ├── domain/
│   │   ├── entities/ExchangeRate.ts
│   │   └── interfaces/
│   │       ├── IExchangeRateCache.ts
│   │       └── IExchangeRateAPI.ts
│   ├── application/
│   │   ├── dtos/ExchangeRateDTO.ts
│   │   └── usecases/GetExchangeRateUseCase.ts
│   ├── infrastructure/
│   │   ├── cache/RedisExchangeRateCache.ts
│   │   ├── api/ExchangeRateApiClient.ts
│   │   ├── grpc/
│   │   │   ├── proto/fx.proto
│   │   │   └── handlers/FxServiceHandler.ts
│   │   └── di/container.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

#### payment-service/ (servicio completo - 17 archivos)

```
payment-service/
├── src/
│   ├── domain/
│   │   ├── entities/Payment.ts
│   │   └── interfaces/
│   │       ├── IPaymentRepository.ts
│   │       ├── IFxServiceClient.ts
│   │       ├── IOrderServiceClient.ts
│   │       └── INotificationClient.ts
│   ├── application/
│   │   ├── dtos/
│   │   │   ├── ProcessPaymentDTO.ts
│   │   │   └── PaymentResponseDTO.ts
│   │   └── usecases/
│   │       ├── ProcessPaymentUseCase.ts
│   │       ├── GetPaymentUseCase.ts
│   │       └── RefundPaymentUseCase.ts
│   ├── infrastructure/
│   │   ├── database/postgres/
│   │   │   ├── config.ts
│   │   │   └── PostgresPaymentRepository.ts
│   │   ├── grpc/
│   │   │   ├── proto/payment.proto
│   │   │   ├── handlers/PaymentServiceHandler.ts
│   │   │   └── clients/
│   │   │       ├── FxServiceClient.ts
│   │   │       ├── OrderServiceClient.ts
│   │   │       └── NotificationServiceClient.ts
│   │   └── di/container.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

#### api-gateway/ (archivos nuevos)

```
api-gateway/src/
├── grpc/clients/
│   ├── FxServiceClient.ts
│   ├── PaymentServiceClient.ts
│   └── DeliveryServiceClient.ts   (modificado para añadir métodos de foto)
├── routes/
│   ├── fxRoutes.ts
│   ├── paymentRoutes.ts
│   ├── adminRoutes.ts
│   └── deliveryRoutes.ts
└── middleware/
    └── adminMiddleware.ts
```

#### frontend/ (archivos nuevos)

```
frontend/src/app/
├── core/guards/
│   ├── admin.guard.ts
│   └── delivery.guard.ts
└── features/
    ├── admin/
    │   ├── admin.module.ts
    │   ├── components/
    │   │   ├── orders-list/
    │   │   │   ├── orders-list.component.ts
    │   │   │   ├── orders-list.component.html
    │   │   │   └── orders-list.component.scss
    │   │   └── order-detail/
    │   │       ├── order-detail.component.ts
    │   │       ├── order-detail.component.html
    │   │       └── order-detail.component.scss
    │   └── services/admin.service.ts
    └── delivery/
        ├── delivery.module.ts
        ├── components/
        │   ├── dashboard/
        │   │   ├── dashboard.component.ts
        │   │   ├── dashboard.component.html
        │   │   └── dashboard.component.scss
        │   └── delivery-detail/
        │       ├── delivery-detail.component.ts
        │       ├── delivery-detail.component.html
        │       └── delivery-detail.component.scss
        └── services/delivery.service.ts
```

### Archivos Modificados

#### delivery-service/

| Archivo | Cambio |
|---|---|
| `src/domain/entities/Delivery.ts` | Añadido campo `deliveryPhoto?: string` |
| `src/application/usecases/UpdateDeliveryStatusUseCase.ts` | Validación: si status=DELIVERED y sin foto → error |
| `src/infrastructure/database/postgres/config.ts` | Añadida columna `delivery_photo TEXT` en CREATE TABLE |
| `src/infrastructure/database/postgres/PostgresDeliveryRepository.ts` | Mapeado de `delivery_photo` en queries SELECT/UPDATE |
| `src/infrastructure/grpc/handlers/DeliveryServiceHandler.ts` | Extracción de `delivery_photo` del request gRPC |
| `src/infrastructure/grpc/proto/delivery.proto` | Añadido campo `delivery_photo` en `UpdateDeliveryStatusRequest` |

#### order-service/

| Archivo | Cambio |
|---|---|
| `src/domain/entities/Order.ts` | Añadido estado `PAID` al enum `OrderStatus` |
| `src/domain/interfaces/IOrderRepository.ts` | Añadido método `findAll(filters?)` |
| `src/infrastructure/database/postgres/PostgresOrderRepository.ts` | Implementación de `findAll` con filtros de estado y fecha |
| `src/application/usecases/GetAllOrdersUseCase.ts` | Nuevo caso de uso para admin (obtener todos los pedidos) |
| `src/server.ts` | Registro del handler `GetAllOrders` |
| `src/infrastructure/grpc/proto/order.proto` | Nuevo RPC `GetAllOrders` y mensaje `GetAllOrdersRequest` |

#### notification-service/

| Archivo | Cambio |
|---|---|
| `src/domain/entities/Notification.ts` | Nuevos tipos: `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED` |
| `src/infrastructure/grpc/proto/notification.proto` | Nuevos RPCs: `SendPaymentConfirmation`, `SendPaymentRefund` |
| `src/application/usecases/SendNotificationUseCase.ts` | Templates HTML para emails de pago |
| `src/infrastructure/grpc/handlers/NotificationServiceHandler.ts` | Handlers para nuevos RPCs de pago |
| `src/server.ts` | Registro de nuevos handlers |

#### api-gateway/

| Archivo | Cambio |
|---|---|
| `src/grpc/clients/OrderServiceClient.ts` | Añadido método `getAllOrders(filters)` |
| `src/grpc/proto/order.proto` | Sincronizado con el proto del order-service |
| `src/grpc/proto/delivery.proto` | Añadido campo `delivery_photo` |
| `src/server.ts` | Registro de nuevas rutas: `/fx`, `/payments`, `/admin`, `/deliveries` |

#### frontend/

| Archivo | Cambio |
|---|---|
| `src/app/app.module.ts` | Nuevas rutas `/admin` y `/delivery`, guards, componentes |
| `src/app/features/auth/components/login.component.ts` | Routing por rol: ADMIN → `/admin/orders`, DELIVERY → `/delivery/dashboard`, CLIENT → `/orders` |
| `src/app/features/auth/components/register.component.html` | Selector de rol: CLIENT, DELIVERY, ADMIN |

#### docker-compose.yml

Añadidos los siguientes servicios:
- `redis` (Redis 7 Alpine, puerto 6379)
- `payment-db` (PostgreSQL 15, puerto 5436)
- `fx-service` (puerto gRPC 50056)
- `payment-service` (puerto gRPC 50057)

---

## 12. Guía de Pruebas Locales

### Prerrequisitos

- Docker Desktop instalado y corriendo
- Docker Compose v2.x o superior
- Puerto 3000, 4200, 6379, 5432-5436, 50051-50057 disponibles

### Iniciar el Sistema

```bash
# 1. Clonar el repositorio (si no lo tienes)
git clone <url-del-repo>
cd SA_PROYECTOS_201114493

# 2. Levantar todos los servicios (construir imágenes + iniciar contenedores)
docker-compose up --build

# Si solo quieres iniciar sin reconstruir (segunda vez en adelante):
docker-compose up

# Para correr en background (detached mode):
docker-compose up -d --build
```

### Verificar que Todo Está Corriendo

```bash
# 2. Ver el estado de todos los contenedores
docker-compose ps

# Deberías ver algo así:
# NAME                          STATUS          PORTS
# delivereats-api-gateway       running         0.0.0.0:3000->3000/tcp
# delivereats-auth-service      running         50052/tcp
# delivereats-catalog-service   running         50051/tcp
# delivereats-order-service     running         50053/tcp
# delivereats-delivery-service  running         50054/tcp
# delivereats-notification-svc  running         50055/tcp
# delivereats-fx-service        running         50056/tcp
# delivereats-payment-service   running         50057/tcp
# delivereats-redis             running         0.0.0.0:6379->6379/tcp
# delivereats-auth-db           running         0.0.0.0:5432->5432/tcp
# delivereats-catalog-db        running         0.0.0.0:5433->5432/tcp
# delivereats-order-db          running         0.0.0.0:5434->5432/tcp
# delivereats-delivery-db       running         0.0.0.0:5435->5432/tcp
# delivereats-payment-db        running         0.0.0.0:5436->5432/tcp

# 3. Verificar que el api-gateway responde
curl http://localhost:3000/health
# Respuesta esperada: { "status": "ok", "timestamp": "..." }

# Ver logs de un servicio específico
docker-compose logs -f fx-service
docker-compose logs -f payment-service
```

### Pruebas de Autenticación

```bash
# 4. Registrar usuario ADMIN
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "Test",
    "role": "ADMIN"
  }'
# Respuesta: { "userId": "uuid", "message": "Usuario registrado" }

# Registrar usuario CLIENT
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@test.com",
    "password": "Cliente123!",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "CLIENT"
  }'

# Registrar usuario DELIVERY
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "repartidor@test.com",
    "password": "Repartidor123!",
    "firstName": "Carlos",
    "lastName": "López",
    "role": "DELIVERY"
  }'

# 5. Login con usuario CLIENT y guardar token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@test.com",
    "password": "Cliente123!"
  }'
# Respuesta: { "token": "eyJhbGciOiJIUzI1NiIsInR5c...", "user": {...} }
# Copiar el valor de "token"

# Guardar token como variable de entorno
export CLIENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5c..."

# Login con ADMIN
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin123!"}'
export ADMIN_TOKEN="<token del admin>"
```

### Pruebas del Servicio de Tipo de Cambio (fx-service)

```bash
# 6. Verificar tipo de cambio USD a GTQ
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# Respuesta primera vez (source: API):
# { "success": true, "rate": 7.75, "source": "API", "timestamp": "2026-03-01T..." }

# 7. Llamar de nuevo (debería venir del caché)
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# Respuesta segunda vez (source: CACHE):
# { "success": true, "rate": 7.75, "source": "CACHE", "timestamp": "2026-03-01T..." }

# Probar otras monedas
curl http://localhost:3000/fx/rate?from=USD&to=EUR
curl http://localhost:3000/fx/rate?from=EUR&to=GTQ
```

### Pruebas del Catálogo y Pedidos

```bash
# Ver restaurantes disponibles
curl http://localhost:3000/catalog/restaurants \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Guardar el ID del primer restaurante
export RESTAURANT_ID="<id-del-restaurante>"

# Ver productos del restaurante
curl http://localhost:3000/catalog/restaurants/$RESTAURANT_ID/products \
  -H "Authorization: Bearer $CLIENT_TOKEN"

export PRODUCT_ID="<id-del-producto>"

# 8. Crear pedido como CLIENT
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"restaurantId\": \"$RESTAURANT_ID\",
    \"items\": [{\"productId\": \"$PRODUCT_ID\", \"quantity\": 2, \"price\": 50}],
    \"deliveryAddress\": \"Zona 10, Guatemala City\"
  }"
# Respuesta: { "orderId": "uuid", "status": "PENDING", "totalAmount": 100 }

export ORDER_ID="<id-del-pedido>"
```

### Pruebas del Servicio de Pagos

```bash
# 9. Procesar pago con tarjeta de crédito
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"amount\": 100,
    \"currency\": \"GTQ\",
    \"paymentMethod\": \"CREDIT_CARD\",
    \"cardHolder\": \"Juan Pérez\",
    \"cardLastFour\": \"1234\"
  }"
# Respuesta:
# {
#   "success": true,
#   "paymentId": "uuid",
#   "status": "COMPLETED",
#   "amountGTQ": 100.00,
#   "amountUSD": 12.90,
#   "exchangeRate": 7.75,
#   "message": "Pago procesado exitosamente"
# }
# Además se enviará un email de confirmación al usuario
```

### Pruebas del Panel de Administración

```bash
# 10. Ver todos los pedidos como ADMIN (sin filtros)
curl http://localhost:3000/admin/orders \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Ver solo pedidos PAID
curl "http://localhost:3000/admin/orders?status=PAID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 11. Filtrar por múltiples estados y rango de fechas
curl "http://localhost:3000/admin/orders?status=DELIVERED,CANCELLED&from=2026-01-01&to=2026-12-31" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Respuesta:
# {
#   "orders": [
#     {
#       "id": "uuid",
#       "userId": "uuid",
#       "status": "DELIVERED",
#       "totalAmount": 100,
#       "deliveryPhoto": "data:image/jpeg;base64,...",
#       "createdAt": "2026-03-01T..."
#     }
#   ],
#   "total": 1
# }

# Intentar acceder como CLIENT (debe fallar con 403)
curl http://localhost:3000/admin/orders \
  -H "Authorization: Bearer $CLIENT_TOKEN"
# Respuesta: { "error": "Acceso no autorizado. Se requiere rol ADMIN." }
```

### Pruebas del Servicio de Entrega

```bash
# Listar entregas disponibles (como DELIVERY)
export DELIVERY_TOKEN="<token del repartidor>"

curl http://localhost:3000/deliveries/available \
  -H "Authorization: Bearer $DELIVERY_TOKEN"

export DELIVERY_ID="<id-de-la-entrega>"

# Aceptar entrega
curl -X PUT http://localhost:3000/deliveries/$DELIVERY_ID/accept \
  -H "Authorization: Bearer $DELIVERY_TOKEN"

# Avanzar estado a PICKED_UP
curl -X PUT http://localhost:3000/deliveries/$DELIVERY_ID/status \
  -H "Authorization: Bearer $DELIVERY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PICKED_UP"}'

# Avanzar estado a IN_TRANSIT
curl -X PUT http://localhost:3000/deliveries/$DELIVERY_ID/status \
  -H "Authorization: Bearer $DELIVERY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_TRANSIT"}'

# Marcar como DELIVERED con foto (base64 de una imagen pequeña de prueba)
curl -X PUT http://localhost:3000/deliveries/$DELIVERY_ID/status \
  -H "Authorization: Bearer $DELIVERY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DELIVERED",
    "delivery_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }'
# Respuesta: { "success": true, "message": "Entrega completada" }

# Intentar marcar DELIVERED sin foto (debe fallar)
curl -X PUT http://localhost:3000/deliveries/$DELIVERY_ID/status \
  -H "Authorization: Bearer $DELIVERY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "DELIVERED"}'
# Respuesta: { "error": "Se requiere foto de entrega para marcar como DELIVERED" }
```

### Probar Redis Fallback (Simular Falla de la API)

```bash
# 1. Hacer primera petición para cachear la tasa
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# source: "API" → la tasa se guardó en Redis

# 2. Segunda petición → source: "CACHE" (TTL de 24h activo)
curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# source: "CACHE"

# 3. Ver las claves en Redis
docker exec delivereats-redis redis-cli KEYS "fx:*"
# Debería mostrar:
# 1) "fx:USD:GTQ"
# 2) "fx:stale:fx:USD:GTQ"

# 4. Ver el TTL de la clave normal (cuántos segundos le quedan)
docker exec delivereats-redis redis-cli TTL "fx:USD:GTQ"
# Devuelve: algo como 86350 (24h - los segundos transcurridos)

# 5. Ver la clave stale (sin TTL)
docker exec delivereats-redis redis-cli TTL "fx:stale:fx:USD:GTQ"
# Devuelve: -1 (sin expiración)

# 6. Ver el valor de la tasa cacheada
docker exec delivereats-redis redis-cli GET "fx:USD:GTQ"
# Devuelve: "7.75" (o la tasa actual)

docker exec delivereats-redis redis-cli GET "fx:stale:fx:USD:GTQ"
# Devuelve: "7.75" (mismo valor, pero persistente)

# 7. Simular falla de API: eliminar la clave normal y usar URL inválida
docker exec delivereats-redis redis-cli DEL "fx:USD:GTQ"
# Ahora la clave normal no existe, pero la stale sí

# La próxima petición intentará la API → fallará → usará CACHE_FALLBACK
# Para simular sin cambiar el contenedor, puedes bloquear la URL temporalmente:
# (Esto es solo para desarrollo, no para producción)
docker exec delivereats-fx-service sh -c "EXCHANGE_RATE_API_URL=http://url-invalida node dist/server.js &"

curl http://localhost:3000/fx/rate?from=USD&to=GTQ
# Si la clave normal expiró y la API falla:
# { "success": true, "rate": 7.75, "source": "CACHE_FALLBACK", "timestamp": "..." }
```

### Pruebas del Frontend en el Navegador

#### Flujo del Administrador

```
1. Abrir http://localhost:4200 en el navegador

2. Ir a la pantalla de Registro
   - Ingresar email, nombre, contraseña
   - Seleccionar Rol: ADMIN
   - Click "Registrarse"

3. Hacer Login con las credenciales de ADMIN
   - La aplicación detecta el rol ADMIN en el JWT
   - Redirige automáticamente a /admin/orders

4. Panel de Administración:
   - Ver lista de todos los pedidos del sistema
   - Usar filtros:
     * Estado: PENDING | PAID | DELIVERED | CANCELLED (múltiple selección)
     * Desde: selector de fecha
     * Hasta: selector de fecha
   - Click "Aplicar Filtros"

5. Pedidos en estado DELIVERED muestran un thumbnail de la foto
   - Click en el thumbnail para ver la imagen completa
   - La imagen se muestra directamente desde el Base64 almacenado
```

#### Flujo del Repartidor

```
1. Registrar cuenta con Rol: DELIVERY
2. Hacer Login → redirige automáticamente a /delivery/dashboard

3. Dashboard del Repartidor:
   - Sección "Entregas Disponibles": pedidos PAID sin asignar
   - Click "Aceptar Entrega" en uno de los pedidos
   - El pedido pasa a "Mis Entregas Activas" con estado ASSIGNED

4. Gestionar la entrega:
   - Click "Marcar Recolectado" → estado: PICKED_UP
   - Click "En Camino" → estado: IN_TRANSIT
   - Click "Confirmar Entrega" → aparece modal

5. Modal de Confirmación de Entrega:
   - Título: "Subir Foto de Entrega"
   - Botón "Seleccionar Foto" → abre explorador de archivos
   - Seleccionar imagen JPG/PNG del equipo
   - Preview de la imagen aparece en el modal
   - Click "Confirmar Entrega"
   - El sistema convierte la imagen a Base64 y la envía
   - Estado cambia a DELIVERED
   - La entrega desaparece de "Mis Entregas Activas"
```

#### Flujo del Cliente

```
1. Registrar cuenta con Rol: CLIENT (default)
2. Hacer Login → redirige a /orders (listado de pedidos)

3. Ver restaurantes disponibles en /catalog

4. Crear pedido:
   - Seleccionar restaurante
   - Agregar productos al carrito
   - Ingresar dirección de entrega
   - Click "Realizar Pedido"

5. Pagar pedido:
   - Ir a la vista del pedido
   - Click "Pagar"
   - Ingresar datos de tarjeta
   - Click "Confirmar Pago"
   - Recibir email de confirmación con montos en GTQ y USD

6. Seguir estado del pedido:
   - PENDING → PAID → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

### Apagar el Sistema

```bash
# Detener todos los contenedores (mantiene los datos en volúmenes)
docker-compose down

# Detener y eliminar volúmenes (borra todos los datos de BD y Redis)
docker-compose down -v

# Ver los volúmenes existentes
docker volume ls | grep delivereats
```

### Solución de Problemas Comunes

```bash
# Si un servicio no arranca, revisar sus logs
docker-compose logs auth-service
docker-compose logs payment-service
docker-compose logs fx-service

# Si PostgreSQL no acepta conexiones:
# Esperar 10-15 segundos para que inicialice, luego:
docker-compose restart auth-service order-service delivery-service payment-service

# Si Redis no responde:
docker exec delivereats-redis redis-cli PING
# Respuesta esperada: PONG

# Si el api-gateway devuelve 502 (Bad Gateway):
# Algún microservicio gRPC no está respondiendo
docker-compose ps  # Verificar cuáles están "running"
docker-compose restart <nombre-del-servicio>

# Reconstruir solo un servicio específico:
docker-compose up --build fx-service
docker-compose up --build payment-service

# Ver uso de recursos de los contenedores:
docker stats

# Limpiar todo (CUIDADO: elimina imágenes, contenedores y volúmenes)
docker-compose down -v
docker system prune -a
```

---

## Resumen de la Arquitectura

```
+------------------------------------------------------------------+
|                    CLIENTE (Navegador)                            |
|              Angular SPA en http://localhost:4200                 |
|    Roles: CLIENT | DELIVERY | ADMIN                              |
+------------------------------------------------------------------+
                              |
                         HTTP REST
                              |
+------------------------------------------------------------------+
|                       API GATEWAY                                 |
|                   http://localhost:3000                           |
|   Rutas: /auth /catalog /orders /deliveries /fx /payments /admin |
+------------------------------------------------------------------+
       |          |          |           |          |          |
      gRPC       gRPC       gRPC        gRPC       gRPC       gRPC
       |          |          |           |          |          |
  +--------+ +--------+ +--------+ +----------+ +------+ +--------+
  | auth   | |catalog | | order  | | delivery | |notify| |payment |
  |:50052  | |:50051  | |:50053  | | :50054   | |:50055| |:50057  |
  |        | |        | |        | |          | |      | |        |
  | PG     | | PG     | | PG     | | PG       | |SMTP  | | PG     |
  |:5432   | |:5433   | |:5434   | | :5435    | |      | |:5436   |
  +--------+ +--------+ +--------+ +----------+ +------+ +--------+
                                                              |
                                                             gRPC
                                                              |
                                                         +--------+
                                                         |  fx    |
                                                         |:50056  |
                                                         |        |
                                                         | Redis  |
                                                         |:6379   |
                                                         +--------+
                                                              |
                                                     (si MISS en Redis)
                                                              |
                                                    open.er-api.com
```

---

*Tutorial generado para el proyecto Delivereats - Sistema de Análisis y Diseño de Software*
*Universidad de San Carlos de Guatemala - 1S 2026*
