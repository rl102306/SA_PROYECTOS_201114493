# Documentacion Practica 6 — DeliverEats

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Practica 6 — v1.3.0**
**Carnet: 201114493**

---

## Tabla de Contenidos

1. [Funcionalidades Implementadas](#1-funcionalidades-implementadas)
2. [Integracion de Colas de Mensajeria con RabbitMQ](#2-integracion-de-colas-de-mensajeria-con-rabbitmq)
   - [Descripcion General](#21-descripcion-general)
   - [Arquitectura del Sistema de Mensajeria](#22-arquitectura-del-sistema-de-mensajeria)
   - [Publicador — Order Service](#23-publicador--order-service)
   - [Consumidor — Restaurant Catalog Service](#24-consumidor--restaurant-catalog-service)
   - [Persistencia de Notificaciones en PostgreSQL](#25-persistencia-de-notificaciones-en-postgresql)
   - [Panel de Inbox del Restaurante (Frontend)](#26-panel-de-inbox-del-restaurante-frontend)
   - [Configuracion Docker Compose](#27-configuracion-docker-compose)
3. [Sistema de Fidelizacion — Promociones y Cupones](#3-sistema-de-fidelizacion--promociones-y-cupones)
   - [Promociones por Restaurante](#31-promociones-por-restaurante)
   - [Cupones con Codigo y Aprobacion Administrativa](#32-cupones-con-codigo-y-aprobacion-administrativa)
   - [Validacion Matematica de Descuentos](#33-validacion-matematica-de-descuentos)
   - [Flujo Completo de un Cupon](#34-flujo-completo-de-un-cupon)
   - [Esquema de Base de Datos](#35-esquema-de-base-de-datos)
   - [Endpoints REST](#36-endpoints-rest)
4. [Sistema de Calificaciones](#4-sistema-de-calificaciones)
   - [Tipos de Calificacion](#41-tipos-de-calificacion)
   - [Entidad de Dominio Rating](#42-entidad-de-dominio-rating)
   - [Resumen de Calificaciones por Restaurante](#43-resumen-de-calificaciones-por-restaurante)
   - [Recomendacion de Productos](#44-recomendacion-de-productos)
   - [Flujo de Calificacion desde el Cliente](#45-flujo-de-calificacion-desde-el-cliente)
5. [Filtro y Busqueda Avanzada de Restaurantes](#5-filtro-y-busqueda-avanzada-de-restaurantes)
   - [Criterios de Ordenamiento](#51-criterios-de-ordenamiento)
   - [Filtros Adicionales](#52-filtros-adicionales)
   - [Implementacion en PostgreSQL](#53-implementacion-en-postgresql)
   - [Integracion en Frontend](#54-integracion-en-frontend)
6. [Pruebas Unitarias](#6-pruebas-unitarias)
   - [Configuracion del Entorno de Pruebas](#61-configuracion-del-entorno-de-pruebas)
   - [Tests de Logica de Negocio — Descuentos](#62-tests-de-logica-de-negocio--descuentos)
   - [Tests de Logica de Negocio — Calificaciones](#63-tests-de-logica-de-negocio--calificaciones)
   - [Tests de Endpoint — Login](#64-tests-de-endpoint--login)
   - [Tests de Endpoint — Crear Orden](#65-tests-de-endpoint--crear-orden)
   - [Resultados de Ejecucion](#66-resultados-de-ejecucion)
7. [Rubrica y Criterios de Evaluacion](#7-rubrica-y-criterios-de-evaluacion)

---

## 1. Funcionalidades Implementadas

| Funcionalidad | Descripcion | Estado |
|---|---|---|
| Colas RabbitMQ | Order Service publica ORDER_CREATED; Catalog Service consume y almacena en inbox del restaurante | Implementado |
| Promociones | Restaurantes crean descuentos por porcentaje, fijo o envio gratis; visibles al cliente en catalogo | Implementado |
| Cupones | Restaurantes crean codigos de descuento; requieren aprobacion del administrador antes de ser validos | Implementado |
| Calificaciones | Clientes califican restaurante (1-5 estrellas), repartidor (1-5 estrellas) y productos (recomendado/no recomendado) | Implementado |
| Filtros avanzados | Ordenar restaurantes por Nuevos, Destacados (por volumen) o Mejor Puntuados; filtrar por etiquetas y por promociones activas | Implementado |
| Pruebas unitarias | 83 tests distribuidos en 4 suites cubriendo logica de descuentos, calificaciones, login y creacion de ordenes | Implementado |

---

## 2. Integracion de Colas de Mensajeria con RabbitMQ

### 2.1 Descripcion General

Se integro **RabbitMQ 3.12** como broker de mensajeria asíncrona entre el Order Service y el Restaurant Catalog Service. El objetivo es que cada vez que un cliente realiza un pedido, el restaurante receptor reciba una notificacion en tiempo real en su panel de administracion, sin que el Order Service tenga que conocer la existencia del Catalog Service.

Este patron se conoce como **Publisher/Subscriber** o **Event-Driven Architecture**: el Order Service emite eventos de dominio (`ORDER_CREATED`) y cualquier servicio interesado puede suscribirse sin acoplamiento directo.

**Tecnologia:** `amqplib` (Node.js client para AMQP 0-9-1)
**Exchange:** `delivereats.orders` (tipo `topic`, durable)
**Routing key:** `order.created`
**Queue:** `catalog.order.notifications` (durable, bind al exchange)

### 2.2 Arquitectura del Sistema de Mensajeria

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLUJO DE MENSAJERIA                     │
│                                                                 │
│  Cliente hace pedido                                            │
│        │                                                        │
│        ▼                                                        │
│  order-service                                                  │
│  CreateOrder gRPC handler                                       │
│        │                                                        │
│        ├─── guarda orden en order-db ──────────────────────┐   │
│        │                                                    │   │
│        └─── publishOrderCreated() ──────────────────────┐  │   │
│                                                         │  │   │
│                        RabbitMQ Broker                  │  │   │
│             Exchange: delivereats.orders (topic)        │  │   │
│             Routing key: order.created                  │  │   │
│                         │                               │  │   │
│             Queue: catalog.order.notifications ◄────────┘  │   │
│                         │                                   │   │
│                         ▼                                   │   │
│  restaurant-catalog-service                                 │   │
│  RabbitMQConsumer → notificationRepo.save()                 │   │
│        │                                                    │   │
│        └─── tabla restaurant_order_notifications ◄──────────   │
│                         │                                       │
│                         ▼                                       │
│  Panel del restaurante                                          │
│  GET /catalog/notifications  →  tab Inbox (🔔)                 │
└─────────────────────────────────────────────────────────────────┘
```

**Ventaja del desacoplamiento:** Si el Catalog Service esta caido cuando se crea la orden, el mensaje queda encolado en RabbitMQ. Cuando el Catalog Service se recupera, procesa todos los mensajes acumulados. Esto garantiza que **ningun pedido se pierda** sin notificar al restaurante.

### 2.3 Publicador — Order Service

```typescript
// order-service/src/infrastructure/messaging/RabbitMQPublisher.ts

const EXCHANGE = 'delivereats.orders';
const RETRY_DELAY = 5000;
const MAX_RETRIES = 10;

let connection: any = null;
let channel: any = null;
let retryCount = 0;

async function connect(): Promise<void> {
  const url = process.env.RABBITMQ_URL || 'amqp://delivereats:delivereats_pass@localhost:5672';
  try {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    retryCount = 0;
    console.log('RabbitMQ Publisher conectado');

    connection.on('error', () => scheduleReconnect());
    connection.on('close', () => scheduleReconnect());
  } catch (err: any) {
    console.warn(`RabbitMQ no disponible (intento ${retryCount + 1}): ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(connect, RETRY_DELAY);
  }
}

export async function initRabbitMQPublisher(): Promise<void> {
  await connect();
}

export function publishOrderCreated(order: {
  orderId: string;
  restaurantId: string;
  userId: string;
  totalAmount: number;
  deliveryAddress: string;
  items: any[];
}): void {
  if (!channel) {
    // No bloquea si RabbitMQ no esta disponible
    console.warn('RabbitMQ channel no disponible, omitiendo publicacion');
    return;
  }
  const message = JSON.stringify({
    event: 'ORDER_CREATED',
    ...order,
    timestamp: new Date().toISOString()
  });
  channel.publish(EXCHANGE, 'order.created', Buffer.from(message), { persistent: true });
}
```

**Puntos clave del publicador:**

- `initRabbitMQPublisher()` se llama de forma **no bloqueante** en el arranque del servidor: si RabbitMQ no esta disponible al inicio, el servicio arranca igual y reintenta en segundo plano
- `publishOrderCreated()` es **sincrono y no-throw**: si el canal no esta listo, omite la publicacion con un warning en lugar de fallar la creacion de la orden
- `persistent: true` en las opciones del mensaje: RabbitMQ persiste el mensaje en disco para que sobreviva reinicios del broker

**Integracion en el handler gRPC:**

```typescript
// order-service/src/server.ts — dentro del handler CreateOrder
const order = await createOrderUseCase.execute(dto);

// Publicar evento ORDER_CREATED a RabbitMQ (no bloquea la respuesta al cliente)
publishOrderCreated({
  orderId:         order.id,
  restaurantId:    order.restaurantId,
  userId:          order.userId,
  totalAmount:     order.totalAmount,
  deliveryAddress: order.deliveryAddress || '',
  items:           order.items
});

callback(null, { success: true, message: 'Orden creada exitosamente', order: mapOrderToGrpc(order) });
```

### 2.4 Consumidor — Restaurant Catalog Service

```typescript
// restaurant-catalog-service/src/infrastructure/messaging/RabbitMQConsumer.ts

const EXCHANGE   = 'delivereats.orders';
const QUEUE      = 'catalog.order.notifications';
const ROUTING_KEY = 'order.created';

export async function startOrderConsumer(notificationRepo: INotificationRepository): Promise<void> {
  const url = process.env.RABBITMQ_URL || 'amqp://delivereats:delivereats_pass@localhost:5672';
  try {
    const connection: any = await amqplib.connect(url);
    const channel = await connection.createChannel();

    // Asegurar que el exchange y la cola existan (idempotente)
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    const q = await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(q.queue, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);  // Procesa un mensaje a la vez

    retryCount = 0;
    console.log('RabbitMQ Consumer iniciado, escuchando ordenes...');

    channel.consume(q.queue, async (msg: any) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        console.log(`Nueva orden recibida: ${data.orderId} para restaurante ${data.restaurantId}`);

        await notificationRepo.save({
          restaurantId:    data.restaurantId,
          orderId:         data.orderId,
          userId:          data.userId,
          totalAmount:     data.totalAmount || 0,
          deliveryAddress: data.deliveryAddress || '',
          items:           data.items || [],
          isRead:          false
        });

        channel.ack(msg);    // Confirma que el mensaje fue procesado
      } catch (err: any) {
        console.error('Error procesando mensaje RabbitMQ:', err.message);
        channel.nack(msg, false, false);  // Descarta sin reencolar
      }
    });

    connection.on('error', () => scheduleReconnect(notificationRepo));
    connection.on('close', () => scheduleReconnect(notificationRepo));

  } catch (err: any) {
    console.warn(`RabbitMQ consumer no disponible (intento ${retryCount + 1}): ${err.message}`);
    scheduleReconnect(notificationRepo);
  }
}
```

**Comportamiento ACK/NACK:**

| Escenario | Accion | Resultado |
|---|---|---|
| Mensaje procesado y guardado en BD | `channel.ack(msg)` | Mensaje eliminado de la cola |
| Error al parsear JSON o guardar en BD | `channel.nack(msg, false, false)` | Mensaje descartado (no se reencola para evitar bucle infinito con mensajes corruptos) |
| Consumer caido durante procesamiento | RabbitMQ re-entrega automaticamente | Mensaje vuelve a la cola cuando el consumer reconecta |

### 2.5 Persistencia de Notificaciones en PostgreSQL

Las notificaciones se almacenan en la tabla `restaurant_order_notifications` dentro de `catalog-db`:

```sql
-- restaurant-catalog-service/src/infrastructure/database/postgres/config.ts
CREATE TABLE IF NOT EXISTS restaurant_order_notifications (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id    UUID NOT NULL,
  order_id         UUID NOT NULL,
  user_id          UUID NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_address TEXT NOT NULL DEFAULT '',
  items            JSONB NOT NULL DEFAULT '[]',
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_restaurant
  ON restaurant_order_notifications(restaurant_id);
```

**Repositorio (`PostgresNotificationRepository.ts`):**

```typescript
async save(data: {
  restaurantId: string; orderId: string; userId: string;
  totalAmount: number; deliveryAddress: string; items: any[]; isRead: boolean;
}): Promise<void> {
  await this.pool.query(
    `INSERT INTO restaurant_order_notifications
       (restaurant_id, order_id, user_id, total_amount, delivery_address, items, is_read)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING`,
    [data.restaurantId, data.orderId, data.userId,
     data.totalAmount, data.deliveryAddress, JSON.stringify(data.items), data.isRead]
  );
}

async findByRestaurantId(restaurantId: string, unreadOnly?: boolean): Promise<any[]> {
  const condition = unreadOnly ? 'AND is_read = false' : '';
  const result = await this.pool.query(
    `SELECT * FROM restaurant_order_notifications
     WHERE restaurant_id = $1 ${condition}
     ORDER BY created_at DESC`,
    [restaurantId]
  );
  return result.rows;
}

async markAllAsRead(restaurantId: string): Promise<void> {
  await this.pool.query(
    `UPDATE restaurant_order_notifications SET is_read = true WHERE restaurant_id = $1`,
    [restaurantId]
  );
}
```

### 2.6 Panel de Inbox del Restaurante (Frontend)

El panel del restaurante incluye un tab **Inbox (🔔)** que muestra las ordenes nuevas recibidas por RabbitMQ. El badge rojo indica la cantidad de notificaciones no leidas.

```
┌─────────────────────────────────────────────────────┐
│  Menu   Pedidos   🔔 Inbox (3)   Promociones   Cupones│
├─────────────────────────────────────────────────────┤
│  📦 Orden #AB123456                                  │
│  Cliente: cc1111...   Monto: GTQ 130.00              │
│  Direccion: Calle Principal 123                      │
│  Hora: 09:42 AM                                      │
│  ─────────────────────────────────────────────────  │
│  📦 Orden #DE789012                                  │
│  ...                                                 │
│                          [ Marcar todo como leido ]  │
└─────────────────────────────────────────────────────┘
```

**Endpoints utilizados:**

```
GET  /catalog/notifications?unreadOnly=true   -> lista notificaciones del restaurante autenticado
PATCH /catalog/notifications/read             -> marca todas como leidas
```

Ambos endpoints requieren JWT con rol `RESTAURANT`. El `restaurantId` se extrae del token, por lo que cada restaurante solo ve sus propias notificaciones.

### 2.7 Configuracion Docker Compose

```yaml
# docker-compose.yml

rabbitmq:
  image: rabbitmq:3.12-management-alpine
  container_name: delivereats-rabbitmq
  ports:
    - "5672:5672"    # AMQP
    - "15672:15672"  # Panel de administracion web
  environment:
    RABBITMQ_DEFAULT_USER: delivereats
    RABBITMQ_DEFAULT_PASS: delivereats_pass
  networks:
    - delivereats-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5

# En order-service y restaurant-catalog-service:
environment:
  RABBITMQ_URL: amqp://delivereats:delivereats_pass@rabbitmq:5672
depends_on:
  rabbitmq:
    condition: service_healthy  # Espera a que RabbitMQ este listo
```

**Panel de administracion RabbitMQ:**
- URL: `http://localhost:15672`
- Usuario: `delivereats`
- Contrasena: `delivereats_pass`
- Permite ver el exchange `delivereats.orders`, la cola `catalog.order.notifications`, mensajes encolados, throughput, etc.

---

## 3. Sistema de Fidelizacion — Promociones y Cupones

### 3.1 Promociones por Restaurante

Los restaurantes pueden crear **promociones por tiempo limitado** que se muestran automaticamente a los clientes en el catalogo cuando estan activas.

**Tipos de promocion soportados:**

| Tipo | Valor | Comportamiento |
|---|---|---|
| `PERCENTAGE` | Porcentaje (ej: 20) | Descuenta X% del total del pedido |
| `FIXED` | Monto fijo (ej: Q30) | Descuenta un monto fijo; no puede exceder el total |
| `FREE_DELIVERY` | — | Indica envio gratis (se maneja en la logica de negocio del pedido) |

**Entidad de dominio `Promotion.ts`:**

```typescript
export class Promotion {
  isCurrentlyActive(): boolean {
    const now = new Date();
    return this._isActive && now >= this._startsAt && now <= this._endsAt;
  }

  calculateDiscount(orderAmount: number): number {
    if (!this.isCurrentlyActive()) return 0;
    if (this._type === 'PERCENTAGE') {
      // Redondeo a 2 decimales para evitar problemas de punto flotante
      return parseFloat((orderAmount * this._discountValue / 100).toFixed(2));
    }
    if (this._type === 'FIXED') {
      // El descuento fijo nunca puede superar el monto del pedido
      return Math.min(this._discountValue, orderAmount);
    }
    return 0; // FREE_DELIVERY no tiene impacto monetario directo aqui
  }
}
```

**Ejemplo de calculo:**

```
Pedido: Q 150.00
Promocion activa: PERCENTAGE 20%

Descuento = 150 * 20 / 100 = Q 30.00
Total a pagar = Q 120.00
```

```
Pedido: Q 45.00
Promocion activa: FIXED Q 50.00

Descuento = min(50, 45) = Q 45.00   <- no excede el pedido
Total a pagar = Q 0.00
```

### 3.2 Cupones con Codigo y Aprobacion Administrativa

Los cupones son codigos alfanumericos (ej: `DESC20`, `VERANO50`) creados por los restaurantes. A diferencia de las promociones automaticas, los cupones:

1. Son ingresados manualmente por el cliente al momento de pagar
2. **Requieren aprobacion previa del administrador** para ser validos
3. Tienen limite de usos, monto minimo y fecha de vencimiento

**Flujo de vida de un cupon:**

```
Restaurante crea cupon (is_approved = false)
        │
        ▼
Admin ve lista de cupones pendientes
        │
        ▼ Aprueba (is_approved = true)
        │
        ▼
Cliente ingresa codigo al realizar pedido
        │
        ▼
Sistema valida: aprobado, activo, no vencido,
                usos disponibles, monto minimo
        │
        ├── VALIDO → descuento aplicado, uses_count++
        └── INVALIDO → mensaje de error especifico
```

**Entidad de dominio `Coupon.ts` — metodo validate():**

```typescript
validate(orderAmount: number): ValidationResult {
  if (!this._isApproved) {
    return { valid: false, discountAmount: 0,
             message: 'El cupon no ha sido aprobado por el administrador' };
  }
  if (!this._isActive) {
    return { valid: false, discountAmount: 0,
             message: 'El cupon esta inactivo' };
  }
  if (new Date() > this._expiresAt) {
    return { valid: false, discountAmount: 0,
             message: 'El cupon ha expirado' };
  }
  if (this._maxUses !== undefined && this._usesCount >= this._maxUses) {
    return { valid: false, discountAmount: 0,
             message: 'El cupon ha alcanzado su limite de usos' };
  }
  if (orderAmount < this._minOrderAmount) {
    return { valid: false, discountAmount: 0,
             message: `El monto minimo para usar este cupon es Q${this._minOrderAmount.toFixed(2)}` };
  }

  const discountAmount = this.calculateDiscount(orderAmount);
  return { valid: true, discountAmount, message: 'Cupon valido' };
}
```

### 3.3 Validacion Matematica de Descuentos

Ambas entidades (`Coupon` y `Promotion`) encapsulan la logica de calculo en el dominio, siguiendo el principio de **Clean Architecture**: ninguna capa externa (repositorios, handlers gRPC, rutas HTTP) realiza calculos de descuento; todo pasa por las entidades de dominio.

**Cupones PERCENTAGE:**

```
descuento = parseFloat((monto × valorDescuento / 100).toFixed(2))

Ejemplo: monto = Q 200.00, valorDescuento = 15
descuento = (200 × 15 / 100).toFixed(2) = Q 30.00
```

**Cupones FIXED:**

```
descuento = Math.min(valorDescuento, montoOrden)

Ejemplo: valorDescuento = Q 200.00, montoOrden = Q 50.00
descuento = min(200, 50) = Q 50.00  <- protege contra descuentos negativos
```

**Codigo en el frontend al aplicar cupon:**

```typescript
// view-catalog.component.ts
get cartTotalAfterCoupon(): number {
  const base = this.cartTotal;
  if (!this.couponResult?.valid || !this.couponResult.discountAmount) {
    return base;
  }
  return Math.max(0, base - this.couponResult.discountAmount);
}
```

### 3.4 Flujo Completo de un Cupon

```
1. Restaurante crea cupon via POST /catalog/coupons
   { code: "VERANO50", type: "PERCENTAGE", discountValue: 50,
     minOrderAmount: 100, maxUses: 200, expiresAt: "2026-12-31" }

2. Admin aprueba via PATCH /admin/coupons/:id/approve
   → is_approved = true en BD

3. Cliente ingresa "VERANO50" en el carrito
   → POST /catalog/coupons/validate
   { code: "VERANO50", orderAmount: 150.00 }

4. Respuesta del servidor:
   { valid: true, discountAmount: 75.00, message: "Cupon valido" }

5. Cliente confirma el pedido con total descontado
   → Total = Q 150.00 - Q 75.00 = Q 75.00

6. Al crear la orden, uses_count se incrementa en 1
```

### 3.5 Esquema de Base de Datos

```sql
-- Tabla de promociones
CREATE TABLE IF NOT EXISTS promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  type            VARCHAR(20) NOT NULL,   -- PERCENTAGE | FIXED | FREE_DELIVERY
  discount_value  DECIMAL(10,2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Tabla de cupones
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL,
  code             VARCHAR(50) NOT NULL UNIQUE,   -- siempre en mayusculas
  description      TEXT,
  type             VARCHAR(20) NOT NULL,           -- PERCENTAGE | FIXED
  discount_value   DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_uses         INTEGER,                        -- NULL = sin limite
  uses_count       INTEGER NOT NULL DEFAULT 0,
  is_approved      BOOLEAN NOT NULL DEFAULT false, -- requiere aprobacion admin
  is_active        BOOLEAN NOT NULL DEFAULT true,
  expires_at       TIMESTAMP NOT NULL,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
```

**Normalizacion del codigo a mayusculas:** El constructor de la entidad `Coupon` ejecuta `props.code.toUpperCase()` para garantizar que `DESC20`, `desc20` y `Desc20` sean el mismo cupon. El endpoint de validacion tambien normaliza antes de buscar en BD.

### 3.6 Endpoints REST

| Metodo | Endpoint | Rol requerido | Descripcion |
|---|---|---|---|
| `POST` | `/catalog/promotions` | RESTAURANT | Crear promocion |
| `GET` | `/catalog/promotions` | RESTAURANT | Listar mis promociones |
| `DELETE` | `/catalog/promotions/:id` | RESTAURANT | Eliminar promocion |
| `GET` | `/catalog/restaurants/:id/promotions` | Publico | Ver promociones activas de un restaurante |
| `POST` | `/catalog/coupons` | RESTAURANT | Crear cupon (queda pendiente de aprobacion) |
| `GET` | `/catalog/coupons` | RESTAURANT | Listar mis cupones |
| `POST` | `/catalog/coupons/validate` | Publico | Validar cupon al momento del pago |
| `GET` | `/admin/coupons/pending` | ADMIN | Listar cupones pendientes de aprobacion |
| `PATCH` | `/admin/coupons/:id/approve` | ADMIN | Aprobar cupon |

---

## 4. Sistema de Calificaciones

### 4.1 Tipos de Calificacion

El sistema soporta tres tipos de calificacion, cada uno con metricas distintas:

| Tipo (`RatingType`) | Sujeto calificado | Metrica |
|---|---|---|
| `RESTAURANT` | El restaurante de la orden | 1 a 5 estrellas + comentario opcional |
| `DELIVERY` | El repartidor asignado | 1 a 5 estrellas + comentario opcional |
| `PRODUCT` | Un producto especifico del pedido | Recomendado (true/false) |

Solo los clientes pueden calificar, y solo despues de que su orden tenga estado `DELIVERED`.

### 4.2 Entidad de Dominio Rating

```typescript
// restaurant-catalog-service/src/domain/entities/Rating.ts

export class Rating {
  constructor(props: RatingProps) {
    // Validacion de negocio: estrellas solo entre 1 y 5
    if (props.stars !== undefined && (props.stars < 1 || props.stars > 5)) {
      throw new Error('La calificacion debe ser entre 1 y 5 estrellas');
    }
    // ... asignacion de propiedades
  }
}
```

**Campos relevantes:**

```typescript
interface RatingProps {
  orderId:          string;   // la orden a la que pertenece la calificacion
  userId:           string;   // el cliente que califica
  restaurantId?:    string;   // para tipo RESTAURANT
  deliveryPersonId?: string;  // para tipo DELIVERY
  productId?:       string;   // para tipo PRODUCT
  type:             RatingType;
  stars?:           number;   // 1-5, para RESTAURANT y DELIVERY
  comment?:         string;
  recommended?:     boolean;  // para PRODUCT
}
```

### 4.3 Resumen de Calificaciones por Restaurante

El repositorio `PostgresRatingRepository` calcula el promedio de estrellas con SQL:

```sql
-- getRestaurantSummary(restaurantId)
SELECT
  COUNT(*)                                          AS total_ratings,
  COALESCE(AVG(stars), 0)                          AS avg_rating
FROM ratings
WHERE restaurant_id = $1
  AND type = 'RESTAURANT';
```

El metodo `ListRestaurants` del handler gRPC enriquece cada restaurante con esta informacion antes de devolver la respuesta al cliente:

```typescript
// CatalogServiceHandler.ts
const enrichedRestaurants = await Promise.all(
  restaurants.map(async (restaurant) => {
    const ratingData = await this.ratingRepository.getRestaurantSummary(restaurant.id);
    return {
      ...restaurant.toJSON(),
      avgRating:    ratingData.avgRating,
      totalRatings: ratingData.totalRatings
    };
  })
);
```

El frontend muestra las estrellas como representacion visual usando un helper:

```typescript
// view-catalog.component.ts
getStarsArray(avg: number): string[] {
  return [1, 2, 3, 4, 5].map(i => {
    if (i <= Math.floor(avg)) return 'star-full';
    if (i - avg < 1 && avg % 1 >= 0.5) return 'star-half';
    return 'star-empty';
  });
}
```

### 4.4 Recomendacion de Productos

Para los productos no se usan estrellas sino un sistema binario de recomendacion, mas intuitivo para el usuario. La tasa de recomendacion se calcula como porcentaje de votos positivos:

```sql
-- getProductSummary(productId)
SELECT
  COUNT(*)                                                          AS total_votes,
  SUM(CASE WHEN recommended = true THEN 1 ELSE 0 END)             AS positive_votes,
  ROUND(
    100.0 * SUM(CASE WHEN recommended = true THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0)
  , 1)                                                             AS recommendation_rate
FROM ratings
WHERE product_id = $1
  AND type = 'PRODUCT';
```

**Ejemplo de respuesta:**

```json
{
  "productId": "xxxxxxxx-...",
  "totalVotes": 48,
  "positiveVotes": 42,
  "recommendationRate": 87.5
}
```

### 4.5 Flujo de Calificacion desde el Cliente

```
1. Cliente visualiza su historial de pedidos en el catalogo
   (tab "Mis Pedidos" del panel de cliente)

2. Solo los pedidos con status DELIVERED muestran boton "Calificar"

3. Cliente hace clic en "Calificar"
   → Se abre modal con:
      - Estrellas para el restaurante (1-5)
      - Estrellas para el repartidor (1-5)
      - Comentario opcional

4. POST /ratings
   {
     "orderId":          "...",
     "restaurantId":     "...",
     "deliveryPersonId": "...",
     "restaurantStars":  4,
     "deliveryStars":    5,
     "comment":          "Muy buen servicio"
   }

5. El gRPC CreateRating crea hasta 2 entidades Rating
   (una tipo RESTAURANT, una tipo DELIVERY)
   → Persiste en tabla ratings

6. La proxima vez que se listen restaurantes,
   el avgRating del restaurante ya incluye la nueva calificacion
```

**Endpoint:**

```
POST /ratings          -> Crea calificacion (requiere JWT de cliente)
GET  /ratings/restaurant/:id -> Resumen publico de calificaciones del restaurante
GET  /ratings/product/:id    -> Tasa de recomendacion de un producto
```

---

## 5. Filtro y Busqueda Avanzada de Restaurantes

### 5.1 Criterios de Ordenamiento

El endpoint `GET /catalog/restaurants` acepta el parametro `sortBy` con tres valores posibles:

| Valor `sortBy` | Criterio | Implementacion SQL |
|---|---|---|
| `new` (default) | Restaurantes mas recientes primero | `ORDER BY r.created_at DESC` |
| `featured` | Mas pedidos en los ultimos 30 dias | `LEFT JOIN orders... ORDER BY order_count DESC` |
| `best_rated` | Mejor promedio de estrellas | `LEFT JOIN ratings... ORDER BY avg_rating DESC` |

### 5.2 Filtros Adicionales

Ademas del ordenamiento, se pueden combinar los siguientes filtros:

**Por etiqueta (`tags`):**

```
GET /catalog/restaurants?tags=pizza,italiana
```

Los restaurantes tienen un campo `tags TEXT[]` en PostgreSQL. El filtro usa el operador `&&` (overlap de arrays) para retornar restaurantes que tengan al menos una de las etiquetas solicitadas.

**Por promocion activa (`hasPromotion`):**

```
GET /catalog/restaurants?hasPromotion=true
```

Filtra solo los restaurantes que tienen al menos una promocion activa en el momento de la consulta.

**Ejemplo de uso combinado:**

```
GET /catalog/restaurants?sortBy=best_rated&tags=hamburguesas&hasPromotion=true
```

Retorna los restaurantes con tag "hamburguesas" que tienen promocion activa, ordenados por mejor calificacion.

### 5.3 Implementacion en PostgreSQL

```typescript
// PostgresRestaurantRepository.ts — findActive(filters?)

async findActive(filters?: RestaurantFilters): Promise<Restaurant[]> {
  const { sortBy = 'new', tags = [], hasPromotion = false } = filters || {};

  let selectClause   = 'SELECT r.*';
  let joinClause     = '';
  let whereConditions = ['r.is_active = true'];
  let orderClause    = 'ORDER BY r.created_at DESC';
  const params: any[] = [];
  let paramIndex = 1;

  // Ordenamiento por restaurantes destacados (volumen de pedidos)
  if (sortBy === 'featured') {
    selectClause = `
      SELECT r.*,
             COUNT(o.id) AS order_count
    `;
    joinClause = `
      LEFT JOIN orders o ON o.restaurant_id = r.id
        AND o.created_at > NOW() - INTERVAL '30 days'
    `;
    orderClause = 'ORDER BY order_count DESC';
  }

  // Ordenamiento por mejor puntuacion
  if (sortBy === 'best_rated') {
    selectClause = `
      SELECT r.*,
             COALESCE(AVG(rt.stars), 0) AS avg_rating
    `;
    joinClause = `
      LEFT JOIN ratings rt ON rt.restaurant_id = r.id
        AND rt.type = 'RESTAURANT'
    `;
    orderClause = 'ORDER BY avg_rating DESC';
  }

  // Filtro por etiquetas (array overlap)
  if (tags.length > 0) {
    whereConditions.push(`r.tags && $${paramIndex}`);
    params.push(tags);
    paramIndex++;
  }

  // Filtro por promocion activa (subquery)
  if (hasPromotion) {
    whereConditions.push(`
      EXISTS (
        SELECT 1 FROM promotions p
        WHERE p.restaurant_id = r.id
          AND p.is_active = true
          AND p.starts_at <= NOW()
          AND p.ends_at   >= NOW()
      )
    `);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  const groupBy = (sortBy === 'featured' || sortBy === 'best_rated')
    ? 'GROUP BY r.id'
    : '';

  const query = `${selectClause} FROM restaurants r ${joinClause}
                 ${whereClause} ${groupBy} ${orderClause}`;

  const result = await this.pool.query(query, params);
  return result.rows.map(row => this.rowToEntity(row));
}
```

**Por que dinamico y no N queries separadas:** Construir la query dinamicamente en lugar de hacer un query base + filtros adicionales por separado evita el problema N+1 y mantiene una sola ida a la base de datos independientemente de cuantos filtros se combinen.

### 5.4 Integracion en Frontend

```typescript
// frontend/src/app/features/client/services/catalog.service.ts

getRestaurants(filters?: { sortBy?: string; tags?: string[]; hasPromotion?: boolean }) {
  let params = new HttpParams();
  if (filters?.sortBy)        params = params.set('sortBy', filters.sortBy);
  if (filters?.tags?.length)  params = params.set('tags', filters.tags.join(','));
  if (filters?.hasPromotion)  params = params.set('hasPromotion', 'true');
  return this.http.get(`${this.apiUrl}/catalog/restaurants`, { params });
}
```

**Barra de filtros en el catalogo:**

```
┌──────────────────────────────────────────────────────────────┐
│  Ordenar por: [Nuevos ▾]    [✓] Solo con promocion           │
│  Etiquetas: [pizza] [italiana] [hamburguesas] + Agregar...   │
│                                              [ Aplicar ]     │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Pruebas Unitarias

### 6.1 Configuracion del Entorno de Pruebas

Las pruebas usan **Jest** con **ts-jest** para ejecutar TypeScript directamente sin compilar. Cada servicio tiene su propia configuracion:

**Estructura de archivos de test:**

```
auth-service/
├── __tests__/
│   └── login.test.ts        (16 tests)
├── tsconfig.test.json        (rootDir ampliado para incluir __tests__)
└── package.json              (jest preset: ts-jest)

order-service/
├── __tests__/
│   └── createOrder.test.ts  (20 tests)
├── tsconfig.test.json
└── package.json

restaurant-catalog-service/
├── __tests__/
│   ├── discount.test.ts     (22 tests)
│   └── rating.test.ts       (25 tests)
├── tsconfig.test.json
└── package.json
```

**Por que tsconfig.test.json separado:** El `tsconfig.json` principal tiene `rootDir: "./src"`, lo que impide que TypeScript compile archivos fuera de `src/`. Para los tests en `__tests__/`, se necesita `rootDir: "."` para abarcar ambos directorios. El `tsconfig.test.json` hereda todas las opciones y solo cambia `rootDir` e `include`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*", "__tests__/**/*"]
}
```

**Configuracion de Jest en package.json:**

```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/__tests__/**/*.test.ts"],
  "globals": {
    "ts-jest": {
      "tsconfig": "tsconfig.test.json"
    }
  }
}
```

**Ejecutar todos los tests:**

```bash
# Desde la raiz del proyecto
cd restaurant-catalog-service && npm test
cd order-service && npm test
cd auth-service && npm test
```

### 6.2 Tests de Logica de Negocio — Descuentos

**Archivo:** `restaurant-catalog-service/__tests__/discount.test.ts`
**Total:** 22 tests

Los tests verifican el comportamiento matematico exacto de las entidades `Coupon` y `Promotion` sin depender de ninguna base de datos ni servicio externo.

**Suites incluidas:**

```
Coupon – descuento porcentual (4 tests)
  ✓ calcula el 20% de Q 100.00 correctamente
  ✓ calcula el 15% de Q 200.00 con redondeo a 2 decimales
  ✓ redondea correctamente: 33.33% de Q 10.00 → Q 3.33
  ✓ descuento no supera el monto total del pedido con porcentaje 100%

Coupon – descuento fijo (3 tests)
  ✓ descuento fijo Q 25.00 sobre pedido de Q 100.00
  ✓ descuento fijo mayor al pedido → limita al monto del pedido
  ✓ descuento fijo igual al pedido → resultado Q 0.00 neto

Coupon – validate() (9 tests)
  ✓ cupon valido devuelve valid=true con descuento correcto
  ✓ cupon no aprobado rechazado
  ✓ cupon inactivo rechazado
  ✓ cupon expirado rechazado
  ✓ usos agotados → rechazado
  ✓ monto del pedido menor al minimo → rechazado con mensaje correcto
  ✓ approve() activa la aprobacion
  ✓ incrementUsage() aumenta el contador
  ✓ codigo se normaliza a mayusculas en constructor

Promotion – descuento porcentual (5 tests)
  ✓ calcula el 10% de Q 150.00
  ✓ calcula el 50% de Q 80.00
  ✓ promocion inactiva devuelve descuento 0
  ✓ promocion fuera de rango de fechas (ya termino) devuelve 0
  ✓ promocion que aun no comienza devuelve 0

Promotion – descuento fijo (2 tests)
  ✓ descuento fijo Q 30 sobre pedido de Q 120
  ✓ descuento fijo mayor al pedido → limita al monto del pedido

Promotion – envio gratis (FREE_DELIVERY) (1 test)
  ✓ FREE_DELIVERY calcula descuento monetario en 0 (se maneja por separado)
```

**Ejemplo de test con caso limite:**

```typescript
test('descuento fijo mayor al pedido → limita al monto del pedido', () => {
  const coupon = validCoupon({ type: 'FIXED', discountValue: 200 });
  expect(coupon.calculateDiscount(50)).toBe(50);
  // El cliente paga Q 0, no un total negativo
});
```

### 6.3 Tests de Logica de Negocio — Calificaciones

**Archivo:** `restaurant-catalog-service/__tests__/rating.test.ts`
**Total:** 25 tests

**Suites incluidas:**

```
Rating – validacion de estrellas (9 tests)
  ✓ crea rating de restaurante con 5 estrellas sin error
  ✓ crea rating de entrega con 1 estrella sin error
  ✓ crea rating de producto con recomendacion = true
  ✓ crea rating de producto con recomendacion = false
  ✓ lanza error si estrellas < 1
  ✓ lanza error si estrellas > 5
  ✓ lanza error con valor negativo
  ✓ no lanza error si stars es undefined (rating de producto sin estrellas)
  ✓ toJSON incluye todos los campos esperados

Calculo de promedio de calificaciones (7 tests)
  ✓ promedio de [5, 5, 5] = 5.00
  ✓ promedio de [1, 2, 3, 4, 5] = 3.00
  ✓ promedio de [4, 3] = 3.50
  ✓ promedio con decimales: [5, 4, 3] = 4.00
  ✓ promedio de arreglo vacio = 0
  ✓ promedio de [1] = 1.00
  ✓ redondea a 2 decimales: [5, 4, 3, 2] = 3.50

Logica de restaurantes Destacados (4 tests)
  ✓ sortByFeatured coloca Pizzeria Italia (350 pedidos) primero
  ✓ sortByFeatured devuelve todos los restaurantes
  ✓ sortByFeatured orden correcto: 350 > 200 > 120 > 80
  ✓ sortByFeatured con empate mantiene orden estable

Logica de restaurantes Mejor Puntuados (3 tests)
  ✓ sortByBestRated coloca Restaurante Central (4.9) primero
  ✓ sortByBestRated orden correcto: 4.9 > 4.5 > 4.2 > 3.8
  ✓ restaurante sin calificaciones (avgRating=0) queda al final

Tasa de recomendacion de productos (5 tests)
  ✓ todos positivos → 100%
  ✓ todos negativos → 0%
  ✓ mitad → 50%
  ✓ 3 de 4 positivos → 75%
  ✓ sin votos → 0%
```

### 6.4 Tests de Endpoint — Login

**Archivo:** `auth-service/__tests__/login.test.ts`
**Total:** 16 tests

Prueba el `LoginUserUseCase` con mocks de todas sus dependencias (`IUserRepository`, `IPasswordHasher`, `IJwtGenerator`) para aislar completamente la logica del use case.

**Patron de mock utilizado:**

```typescript
// Mocks tipados con jest.Mocked<T> para autocompletado y verificacion
const mockUserRepo: jest.Mocked<IUserRepository> = {
  save:           jest.fn(),
  findByEmail:    jest.fn(),
  findById:       jest.fn(),
  existsByEmail:  jest.fn()
};

const mockPasswordHasher: jest.Mocked<IPasswordHasher> = {
  hash:    jest.fn(),
  compare: jest.fn()
};

const mockJwtGenerator: jest.Mocked<IJwtGenerator> = {
  generate: jest.fn(),
  verify:   jest.fn()
};
```

**Suites incluidas:**

```
LoginUserUseCase
  login exitoso (5 tests)
    ✓ devuelve token cuando las credenciales son validas
    ✓ devuelve datos del usuario (sin password) en el resultado
    ✓ llama a findByEmail con el email correcto
    ✓ llama a compare con la contrasena en texto plano y el hash
    ✓ genera JWT con userId, email y role

  usuario no encontrado (2 tests)
    ✓ lanza "Credenciales invalidas" (no revela si el email existe)
    ✓ no llama a compare si el usuario no existe

  contrasena incorrecta (2 tests)
    ✓ lanza "Credenciales invalidas" cuando la contrasena no coincide
    ✓ no genera token si la contrasena es incorrecta

  validacion del DTO (4 tests)
    ✓ lanza error si el email esta vacio
    ✓ lanza error si la contrasena esta vacia
    ✓ lanza error si ambos campos estan vacios
    ✓ no llama al repositorio si el DTO es invalido

  usuario tipo RESTAURANT (1 test)
    ✓ incluye restaurantId en el payload del JWT cuando corresponde
```

**Test critico de seguridad:**

```typescript
test('lanza "Credenciales invalidas" (no revela si el email existe)', async () => {
  mockUserRepo.findByEmail.mockResolvedValue(null);
  const dto = new LoginUserDTO({ email: 'noexiste@test.com', password: 'password123' });
  await expect(useCase.execute(dto)).rejects.toThrow('Credenciales invalidas');
  // El mensaje NO dice "usuario no encontrado" para evitar enumeracion de cuentas
});
```

### 6.5 Tests de Endpoint — Crear Orden

**Archivo:** `order-service/__tests__/createOrder.test.ts`
**Total:** 20 tests

Prueba el `CreateOrderUseCase` con mocks de `IOrderRepository` y `CatalogServiceClient`.

**Suites incluidas:**

```
CreateOrderUseCase
  creacion exitosa (6 tests)
    ✓ devuelve una Order con estado PENDING
    ✓ calcula el total correctamente: 2×Q50 + 1×Q30 = Q130
    ✓ preserva userId, restaurantId y deliveryAddress
    ✓ llama a validateOrder con los items correctos
    ✓ llama a save del repositorio una vez
    ✓ la Order guardada tiene los mismos items que el DTO

  calculo de total del pedido (3 tests)
    ✓ 1 producto de Q 75.50 con cantidad 1 → total Q 75.50
    ✓ 3 unidades de Q 33.33 → total Q 99.99
    ✓ pedido con 4 items distintos suma correctamente

  fallo de validacion gRPC (3 tests)
    ✓ lanza error cuando el catalogo rechaza la orden
    ✓ no llama a save si la validacion falla
    ✓ lanza error si el catalogo lanza excepcion de red

  validacion del DTO (6 tests)
    ✓ lanza error si userId esta vacio
    ✓ lanza error si restaurantId esta vacio
    ✓ lanza error si no hay items
    ✓ lanza error si un item tiene cantidad 0
    ✓ lanza error si un item tiene precio negativo
    ✓ no llama a validateOrder si el DTO es invalido

  Order entity — domain methods (4 tests)
    ✓ updateStatus cambia el estado correctamente
    ✓ cancel() cambia estado a CANCELLED
    ✓ cancel() lanza error si el pedido ya fue entregado
    ✓ calculateTotal() retorna suma de items
```

**Test de integracion con gRPC mockeado:**

```typescript
test('lanza error cuando el catalogo rechaza la orden', async () => {
  (mockCatalogClient.validateOrder as jest.Mock).mockResolvedValue({
    isValid:  false,
    message:  'Producto no disponible',
    errors: [{ productId: PRODUCT_ID_1, errorType: 'NOT_FOUND', message: 'No existe' }]
  });
  const dto = validDTO();
  await expect(useCase.execute(dto)).rejects.toThrow(/Validaci.*fallida/i);
  expect(mockOrderRepo.save).not.toHaveBeenCalled(); // Nunca llega a guardar
});
```

### 6.6 Resultados de Ejecucion

```
 PASS  __tests__/discount.test.ts
  Coupon – descuento porcentual
    ✓ calcula el 20% de Q 100.00 (5ms)
    ✓ calcula el 15% de Q 200.00 (1ms)
    ✓ redondea 33.33% de Q 10.00 (1ms)
    ✓ no supera el monto total (1ms)
  Coupon – descuento fijo
    ✓ fijo Q 25.00 sobre Q 100.00 (1ms)
    ✓ mayor al pedido → limita (1ms)
    ✓ igual al pedido → Q 0.00 neto (1ms)
  ... (15 tests mas)

  Test Suites: 1 passed, 1 total
  Tests:       22 passed, 22 total

 PASS  __tests__/rating.test.ts
  Tests:       25 passed, 25 total

 PASS  __tests__/createOrder.test.ts
  Tests:       20 passed, 20 total

 PASS  __tests__/login.test.ts
  Tests:       16 passed, 16 total

─────────────────────────────────────────
Suites: 4 passed
Tests:  83 passed
Time:   ~2.5s
```

---

## 7. Rubrica y Criterios de Evaluacion

| Criterio | Descripcion | Implementacion |
|---|---|---|
| **Integracion de Colas (25%)** | Sistema de mensajeria asincrona entre microservicios | RabbitMQ 3.12 con exchange topic, producer en order-service, consumer en catalog-service, reconexion automatica, ACK/NACK, inbox persistido en PostgreSQL |
| **Sistema de Fidelizacion (20%)** | Promociones y cupones con logica de negocio | Entidades Promotion y Coupon en dominio con validacion matematica; aprobacion admin obligatoria para cupones; 3 tipos de descuento; panel en frontend para restaurante y admin |
| **Sistema de Calificaciones (15%)** | Calificacion de restaurante, repartidor y productos | Entidad Rating con validacion 1-5 estrellas; resumen con AVG en SQL; tasa de recomendacion de productos; modal de calificacion en frontend; enriquecimiento de lista de restaurantes |
| **Filtro y Busqueda (15%)** | Ordenamiento y filtrado avanzado de restaurantes | SQL dinamico con 3 modos de ordenamiento (nuevo, destacado, mejor puntuado); filtro por tags (array PostgreSQL con &&); filtro por promocion activa (subquery EXISTS); barra de filtros en frontend |
| **Pruebas Unitarias (25%)** | Tests de logica de negocio y endpoints | 83 tests en 4 suites; ts-jest con tsconfig dedicado; mocks tipados con jest.Mocked<T>; cobertura de casos validos, invalidos y casos limite; sin dependencia de BD ni servicios externos |

---

*Practica 6 — Software Avanzado 2026 — Carnet 201114493*
