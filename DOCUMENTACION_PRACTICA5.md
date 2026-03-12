# Documentacion Practica 5 — DeliverEats

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Practica 5 — v1.2.0**
**Carnet: 201114493**

---

## Tabla de Contenidos

1. [Funcionalidades Implementadas](#1-funcionalidades-implementadas)
2. [FX Service — Consumo de API Externa y Cache Redis](#2-fx-service--consumo-de-api-externa-y-cache-redis)
   - [Descripcion General](#21-descripcion-general)
   - [Arquitectura Interna](#22-arquitectura-interna)
   - [Consumo de API Externa (open.er-api.com)](#23-consumo-de-api-externa-openerapi)
   - [Implementacion de Redis: Cache y Fallback](#24-implementacion-de-redis-cache-y-fallback)
   - [Configuracion Docker y Variables de Entorno](#25-configuracion-docker-y-variables-de-entorno)
   - [Guia de Integracion desde Otro Servicio](#26-guia-de-integracion-desde-otro-servicio)
3. [Payment Service — Pagos Simulados](#3-payment-service--pagos-simulados)
   - [Metodos de Pago Soportados](#31-metodos-de-pago-soportados)
   - [Flujo de Procesamiento de Pago](#32-flujo-de-procesamiento-de-pago)
   - [Esquema de Base de Datos](#33-esquema-de-base-de-datos)
   - [Actualizacion de Estado de Orden](#34-actualizacion-de-estado-de-orden)
4. [Evidencia de Entrega — Subida de Fotografia](#4-evidencia-de-entrega--subida-de-fotografia)
   - [Justificacion de Almacenamiento](#41-justificacion-de-almacenamiento)
   - [Implementacion Tecnica](#42-implementacion-tecnica)
   - [Flujo de Subida y Almacenamiento](#43-flujo-de-subida-y-almacenamiento)
5. [Panel Administrativo — Evidencias y Reembolsos](#5-panel-administrativo--evidencias-y-reembolsos)
   - [Visualizacion de Foto de Entrega](#51-visualizacion-de-foto-de-entrega)
   - [Flujo Tecnico de Reembolso](#52-flujo-tecnico-de-reembolso)
   - [Notificacion de Reembolso](#53-notificacion-de-reembolso)
6. [Rubrica y Criterios de Evaluacion](#6-rubrica-y-criterios-de-evaluacion)

---

## 1. Funcionalidades Implementadas

| Funcionalidad | Descripcion | Estado |
|---|---|---|
| FX Service | Tipo de cambio USD/GTQ via API externa con cache Redis | Implementado |
| Payment Service | Pagos simulados con tarjeta de credito, debito y cartera digital | Implementado |
| Evidencia de entrega | Foto obligatoria al marcar ENTREGADO (base64 en PostgreSQL) | Implementado |
| Panel admin — evidencias | Vista de pedidos DELIVERED/CANCELLED con foto del repartidor | Implementado |
| Reembolsos | Admin aprueba reembolso: cambia estado a REFUNDED + notificacion email | Implementado |

---

## 2. FX Service — Consumo de API Externa y Cache Redis

### 2.1 Descripcion General

El **FX Service** es el microservicio encargado de proveer tipos de cambio de divisas al resto del sistema, en particular al **Payment Service** para convertir montos entre GTQ (Quetzal guatemalteco) y USD (Dolar estadounidense).

- **Puerto gRPC:** 50056
- **Dependencia externa:** `https://open.er-api.com/v6/latest` (ExchangeRate API gratuita)
- **Cache:** Redis 7 (StatefulSet en Kubernetes, contenedor en Docker Compose)

### 2.2 Arquitectura Interna

```
fx-service/src/
├── domain/
│   └── interfaces/
│       ├── IExchangeRateCache.ts     <- Contrato de cache (abstraccion Redis)
│       └── IExchangeRateApiClient.ts <- Contrato de API externa
├── application/
│   └── usecases/
│       └── GetExchangeRateUseCase.ts <- Logica de 3 niveles: cache → API → fallback
└── infrastructure/
    ├── cache/
    │   └── RedisExchangeRateCache.ts <- Implementacion con ioredis
    ├── http/
    │   └── ExchangeRateApiClient.ts  <- Llamada HTTP a open.er-api.com con axios
    ├── grpc/
    │   ├── proto/fx.proto
    │   └── handlers/FxServiceHandler.ts
    └── di/DIContainer.ts
```

**Principio Clean Architecture aplicado:** el dominio (`IExchangeRateCache`) no conoce Redis. El use case tampoco. Solo la capa de infrastructure implementa la dependencia concreta con `ioredis`.

### 2.3 Consumo de API Externa (open.er-api.com)

El cliente HTTP (`ExchangeRateApiClient.ts`) llama a la API gratuita de tipo de cambio:

```typescript
// fx-service/src/infrastructure/http/ExchangeRateApiClient.ts
const url = `${this.baseUrl}/${baseCurrency}`;
const response = await axios.get(url, { timeout: 5000 });
const rate = response.data.rates[targetCurrency];
```

**Respuesta tipica de la API:**
```json
{
  "base_code": "USD",
  "rates": {
    "GTQ": 7.75,
    "EUR": 0.92,
    ...
  },
  "time_next_update_utc": "2026-03-03T00:00:00+00:00"
}
```

**Proto gRPC del FX Service:**
```proto
// fx-service/src/infrastructure/grpc/proto/fx.proto
service FxService {
  rpc GetExchangeRate (ExchangeRateRequest) returns (ExchangeRateResponse);
}

message ExchangeRateRequest {
  string from_currency = 1;
  string to_currency   = 2;
}

message ExchangeRateResponse {
  bool   success = 1;
  double rate    = 2;
  string source  = 3;  // "CACHE" | "API" | "CACHE_FALLBACK"
  string message = 4;
}
```

### 2.4 Implementacion de Redis: Cache y Fallback

#### Estrategia de 3 niveles

```
Solicitud: GetExchangeRate("USD", "GTQ")

Nivel 1: Redis con TTL (clave fx:USD:GTQ, vence en 24h)
  SI existe  →  devolver rate, source: "CACHE"  (rapido, ~1ms)

Nivel 2: API externa (si Redis esta vacio o expiro)
  SI funciona → guardar en Redis TTL 86400s
              → guardar copia permanente fx:stale:fx:USD:GTQ (sin TTL)
              → devolver rate, source: "API"

Nivel 3: Fallback permanente (si la API externa falla)
  SI existe fx:stale:...  →  devolver aunque este obsoleto, source: "CACHE_FALLBACK"
  NO existe               →  lanzar error "Tipo de cambio no disponible"
```

#### Implementacion en RedisExchangeRateCache.ts

```typescript
// fx-service/src/infrastructure/cache/RedisExchangeRateCache.ts
import Redis from 'ioredis';

export class RedisExchangeRateCache implements IExchangeRateCache {
  private readonly redis: Redis;
  private stalePrefix = 'fx:stale:';

  constructor(host: string, port: number) {
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.on('error', (err) => console.error('Redis error:', err));
    this.redis.on('connect', () => console.log('Redis conectado'));
  }

  async get(key: string): Promise<number | null> {
    const value = await this.redis.get(key);
    return value ? parseFloat(value) : null;
  }

  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    // Guardar con TTL para cache normal (expira en 24h)
    await this.redis.setex(key, ttlSeconds, value.toString());
    // Guardar copia permanente para fallback (NUNCA expira)
    await this.redis.set(`${this.stalePrefix}${key}`, value.toString());
  }

  async getStale(key: string): Promise<number | null> {
    const value = await this.redis.get(`${this.stalePrefix}${key}`);
    return value ? parseFloat(value) : null;
  }
}
```

#### Claves en Redis por par de monedas

| Clave Redis | TTL | Proposito |
|---|---|---|
| `fx:USD:GTQ` | 86400 s (24 h) | Cache normal, se refresca cada dia |
| `fx:stale:fx:USD:GTQ` | SIN TTL | Fallback permanente ante fallo de API |

#### Tabla de comportamiento por escenario

| Escenario | Comportamiento | Campo `source` en respuesta |
|---|---|---|
| Redis tiene dato vigente | Devuelve inmediatamente sin llamar API | `CACHE` |
| Redis expirado, API disponible | Consulta API, guarda en Redis, responde | `API` |
| Redis expirado, API caida | Usa copia permanente sin TTL | `CACHE_FALLBACK` |
| Redis expirado, API caida, primera vez | Lanza error — no hay fallback todavia | `ERROR` |

### 2.5 Configuracion Docker y Variables de Entorno

#### docker-compose.yml — servicio redis

```yaml
redis:
  image: redis:7-alpine
  container_name: delivereats-redis
  command: redis-server --appendonly yes
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  networks:
    - delivereats-network
```

**Por que `--appendonly yes`:** activa el modo AOF (Append-Only File). Cada escritura se persiste en disco inmediatamente. Esto garantiza que las claves `fx:stale:*` (sin TTL) sobrevivan reinicios del contenedor, asegurando que el fallback este disponible incluso despues de un reinicio.

#### docker-compose.yml — servicio fx-service

```yaml
fx-service:
  build:
    context: ./fx-service
  container_name: delivereats-fx-service
  environment:
    GRPC_PORT: 50056
    REDIS_HOST: redis          # nombre del contenedor en la red Docker
    REDIS_PORT: 6379
    EXCHANGE_RATE_API_URL: https://open.er-api.com/v6/latest
    NODE_ENV: production
  depends_on:
    - redis
  networks:
    - delivereats-network
```

**Variables de entorno del FX Service:**

| Variable | Valor | Descripcion |
|---|---|---|
| `GRPC_PORT` | 50056 | Puerto donde escucha el servidor gRPC |
| `REDIS_HOST` | redis | Hostname del contenedor Redis en la red Docker |
| `REDIS_PORT` | 6379 | Puerto del servidor Redis |
| `EXCHANGE_RATE_API_URL` | https://open.er-api.com/v6/latest | URL base de la API externa |

#### Kubernetes — k8s/redis/

```yaml
# k8s/redis/redis-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: delivereats
spec:
  serviceName: redis
  replicas: 1
  template:
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          command: ["redis-server", "--appendonly", "yes"]
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
```

**Por que StatefulSet para Redis y no Deployment:** Redis necesita un PVC (disco persistente) para almacenar las claves `fx:stale:*` que no tienen TTL. Un Deployment no garantiza identidad estable del pod ni del volumen. El StatefulSet asigna un PVC permanente (`redis-data-redis-0`) que persiste aunque el pod se reinicie.

```yaml
# k8s/redis/redis-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: delivereats
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
  clusterIP: None   # Headless: el StatefulSet se accede por nombre dns redis-0.redis
```

#### Kubernetes — k8s/fx-service/fx-service.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fx-service-config
  namespace: delivereats
data:
  GRPC_PORT: "50056"
  REDIS_HOST: redis        # resuelve al headless Service del StatefulSet
  REDIS_PORT: "6379"
  EXCHANGE_RATE_API_URL: https://open.er-api.com/v6/latest
  NODE_ENV: production
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fx-service
  namespace: delivereats
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: fx-service
          image: delivereats/fx-service:latest
          ports:
            - containerPort: 50056
          envFrom:
            - configMapRef:
                name: fx-service-config
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "150m"
---
apiVersion: v1
kind: Service
metadata:
  name: fx-service
  namespace: delivereats
spec:
  selector:
    app: fx-service
  ports:
    - port: 50056
      targetPort: 50056
```

### 2.6 Guia de Integracion desde Otro Servicio

**Desde el Payment Service (cliente gRPC):**

```typescript
// payment-service/src/infrastructure/grpc/clients/FxServiceClient.ts
const fxResult = await this.fxClient.getExchangeRate('USD', 'GTQ');

if (!fxResult.success || !fxResult.rate) {
  throw new Error('No se pudo obtener el tipo de cambio. Intente mas tarde.');
}

const exchangeRate = fxResult.rate;  // ej: 7.75
console.log(`Tasa obtenida desde: ${fxResult.source}`);  // CACHE / API / CACHE_FALLBACK
```

---

## 3. Payment Service — Pagos Simulados

### 3.1 Metodos de Pago Soportados

| Metodo | Valor en sistema | Descripcion |
|---|---|---|
| Tarjeta de credito | `CREDIT_CARD` | Simula cargo a tarjeta de credito |
| Tarjeta de debito | `DEBIT_CARD` | Simula cargo a tarjeta de debito |
| Cartera digital | `DIGITAL_WALLET` | Simula pago desde billetera electronica |

Todos los metodos son **simulados**: el sistema siempre aprueba el pago si los datos de entrada son validos (orderId existente, monto positivo, metodo valido). No se integra con ninguna pasarela de pago real.

### 3.2 Flujo de Procesamiento de Pago

```
Cliente POST /orders/:id/pay
  {
    "paymentMethod": "CREDIT_CARD",
    "amount": 100,
    "currency": "GTQ"
  }
       |
       v API Gateway (orderRoutes.ts)
         → paymentServiceClient.processPayment(orderId, ...)
       |
       v Payment Service — ProcessPaymentUseCase.execute()

  Paso 1: Validar DTO (monto > 0, metodo valido, orderId presente)
  Paso 2: Verificar que no exista pago previo para esta orden
  Paso 3: Llamar FX Service via gRPC → obtener tasa USD/GTQ
  Paso 4: Calcular montos en ambas monedas
          Si currency = GTQ: amountUsd = amount / exchangeRate
          Si currency = USD: amountGtq = amount * exchangeRate
  Paso 5: Crear entidad Payment con status = COMPLETED
  Paso 6: Persistir en payment_db (PostgreSQL)
  Paso 7: Actualizar orden a estado PAID via OrderServiceClient (gRPC)
  Paso 8: Enviar email de confirmacion via NotificationService (gRPC)
       |
       v Respuesta al cliente
  {
    "success": true,
    "payment": {
      "id": "uuid",
      "orderId": "...",
      "amount": 100,
      "currency": "GTQ",
      "amountGtq": 100.00,
      "amountUsd": 12.90,
      "exchangeRate": 7.75,
      "paymentMethod": "CREDIT_CARD",
      "status": "COMPLETED"
    }
  }
```

**Fragmento de ProcessPaymentUseCase.ts:**

```typescript
// payment-service/src/application/usecases/ProcessPaymentUseCase.ts

// 3. Obtener tipo de cambio USD→GTQ desde FX Service
const fxResult = await this.fxClient.getExchangeRate('USD', 'GTQ');
if (!fxResult.success || !fxResult.rate) {
  throw new Error('No se pudo obtener el tipo de cambio. Intente mas tarde.');
}
const exchangeRate = fxResult.rate;

// 4. Calcular montos en ambas monedas
let amountGtq: number;
let amountUsd: number;
if (dto.currency === 'GTQ') {
  amountGtq = dto.amount;
  amountUsd = parseFloat((dto.amount / exchangeRate).toFixed(2));
} else {
  amountUsd = dto.amount;
  amountGtq = parseFloat((dto.amount * exchangeRate).toFixed(2));
}

// 5. Crear entidad y persistir (simulacion: siempre COMPLETED)
const payment = new Payment({
  orderId: dto.orderId,
  amount: dto.amount,
  currency: dto.currency,
  amountGtq,
  amountUsd,
  exchangeRate,
  paymentMethod: dto.paymentMethod as PaymentMethod,
  status: 'COMPLETED'
});

const savedPayment = await this.paymentRepository.save(payment);

// 7. Marcar orden como PAID
await this.orderClient.updateOrderStatus(dto.orderId, 'PAID');
```

### 3.3 Esquema de Base de Datos

```sql
-- payment-service/src/infrastructure/database/postgres/config.ts
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL UNIQUE,
  amount         DECIMAL(10,2) NOT NULL,
  currency       VARCHAR(3) NOT NULL DEFAULT 'GTQ',
  amount_gtq     DECIMAL(10,2),
  amount_usd     DECIMAL(10,2),
  exchange_rate  DECIMAL(10,4),
  payment_method VARCHAR(20) NOT NULL,   -- CREDIT_CARD | DEBIT_CARD | DIGITAL_WALLET
  status         VARCHAR(20) NOT NULL,   -- COMPLETED | FAILED | REFUNDED
  created_at     TIMESTAMP DEFAULT NOW()
);
```

### 3.4 Actualizacion de Estado de Orden

Tras un pago exitoso, el Payment Service llama al Order Service via gRPC para cambiar el estado de la orden de `PENDING` a `PAID`. Si esta llamada falla (timeout, error de red), el pago ya fue registrado en BD y no se revierte — se loguea el error como advertencia.

---

## 4. Evidencia de Entrega — Subida de Fotografia

### 4.1 Justificacion de Almacenamiento

#### Decision: PostgreSQL como almacen de imagen (base64)

Se eligio almacenar la fotografia de entrega directamente en la columna `delivery_photo TEXT` de la tabla `deliveries` en PostgreSQL, codificada en base64.

**Razones tecnicas:**

| Criterio | PostgreSQL base64 | S3 / MinIO / Filesystem |
|---|---|---|
| Complejidad de implementacion | Baja — un campo extra en la tabla existente | Alta — servicio adicional, presupuesto, IAM |
| Consistencia transaccional | Total — foto y estado en la misma transaccion | Eventual — si falla S3, la foto no esta pero el estado si |
| Infraestructura adicional | Ninguna | Bucket S3, credenciales, URL publica |
| Disponibilidad en microservicio | Inmediata — un SELECT devuelve la foto | Requiere llamada adicional a S3 |
| Tamano tipico de imagen | 50–200 KB (foto de entrega comprimida) | Sin limite |
| Contexto del proyecto | Academico, simulacion, prototipo | Produccion a gran escala |

**Conclusion:** Para un sistema de 8 microservicios con fines academicos donde la consistencia y la simplicidad son prioritarias, almacenar la imagen en base64 dentro de PostgreSQL es la decision correcta. En un entorno productivo real, se migraria a un object storage (S3, GCS) con una URL firmada almacenada en la columna.

**Limitacion conocida:** PostgreSQL no esta disenado para almacenar grandes volumenes de datos binarios. Con imagenes bien comprimidas (< 200 KB) y un volumen bajo de pedidos, el impacto es aceptable para este contexto.

### 4.2 Implementacion Tecnica

**Entidad de dominio (`Delivery.ts`):**

```typescript
// delivery-service/src/domain/entities/Delivery.ts
export interface DeliveryProps {
  // ...otros campos...
  deliveryPhoto?: string;  // base64, requerido cuando status = DELIVERED
}

markAsDelivered(deliveryPhoto: string): void {
  if (this.props.status !== DeliveryStatus.IN_TRANSIT) {
    throw new Error('Solo se puede entregar una orden en transito');
  }
  if (!deliveryPhoto || deliveryPhoto.trim() === '') {
    throw new Error('Se requiere foto de entrega para marcar como ENTREGADO');
  }
  this.props.status = DeliveryStatus.DELIVERED;
  this.props.deliveryPhoto = deliveryPhoto;
  this.props.actualDeliveryTime = new Date();
  this.props.updatedAt = new Date();
}
```

**Persistencia en PostgreSQL (`PostgresDeliveryRepository.ts`):**

```typescript
// El campo delivery_photo se persiste en el UPDATE cuando el repartidor marca ENTREGADO
async update(delivery: Delivery): Promise<Delivery> {
  const query = `
    UPDATE deliveries SET
      status             = $4,
      actual_delivery_time = $5,
      cancellation_reason  = $6,
      delivery_photo       = $7,   -- <-- foto base64 aqui
      updated_at           = $8
    WHERE id = $1
    RETURNING *
  `;
  // ...
}
```

**Schema SQL:**

```sql
CREATE TABLE IF NOT EXISTS deliveries (
  id                    UUID PRIMARY KEY,
  order_id              UUID NOT NULL UNIQUE,
  delivery_person_id    UUID,
  delivery_person_name  VARCHAR(100),
  status                VARCHAR(20) NOT NULL,  -- PENDING | ASSIGNED | PICKED_UP | IN_TRANSIT | DELIVERED | CANCELLED
  pickup_address        TEXT NOT NULL,
  delivery_address      TEXT NOT NULL,
  estimated_time        INTEGER,
  actual_delivery_time  TIMESTAMP,
  cancellation_reason   TEXT,
  delivery_photo        TEXT,                  -- base64 de la foto de entrega
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Flujo de Subida y Almacenamiento

```
Repartidor marca pedido como ENTREGADO
  (panel: delivery-dashboard.component.ts)
       |
       | El formulario exige seleccionar un archivo de imagen
       | FileReader.readAsDataURL() → convierte a base64 en el navegador
       v
PATCH /delivery/:id/status
  {
    "status": "DELIVERED",
    "deliveryPhoto": "data:image/jpeg;base64,/9j/4AAQ..."
  }
       |
       v API Gateway → deliveryServiceClient.updateStatus(id, "DELIVERED", photo)
       |
       v Delivery Service — UpdateDeliveryStatusUseCase
         → delivery.markAsDelivered(deliveryPhoto)   [validacion en entidad]
         → repository.update(delivery)               [persiste en PostgreSQL]
         → orderClient.updateOrderStatus(DELIVERED)  [propaga a Order Service]
         → notificationClient.sendOrderDelivered()   [email al cliente]
       |
       v Confirmacion al frontend
```

**Validaciones de negocio:**
- La foto es **obligatoria** para el estado DELIVERED (validado en la entidad de dominio)
- Si no se proporciona foto, el metodo `markAsDelivered` lanza error antes de tocar la BD
- La validacion esta en el dominio (Clean Architecture): ninguna capa externa puede bypassearla

---

## 5. Panel Administrativo — Evidencias y Reembolsos

### 5.1 Visualizacion de Foto de Entrega

El endpoint `GET /admin/orders` devuelve pedidos en estado `DELIVERED` o `CANCELLED`. Para cada orden, el API Gateway consulta adicionalmente al **Delivery Service** para enriquecer la respuesta con la foto:

```typescript
// api-gateway/src/routes/adminRoutes.ts
const enriched = await Promise.all(orders.map(async (order: any) => {
  const deliveryResp = await deliveryServiceClient.getDeliveryByOrder(order.id);
  if (deliveryResp.success && deliveryResp.delivery) {
    const delivery = deliveryResp.delivery;
    const extra: any = {};

    if (delivery.delivery_photo) {
      extra.delivery_photo = delivery.delivery_photo;  // base64 incluido en respuesta
    }

    // Detectar quien cancelo: repartidor o restaurante
    if (order.status === 'CANCELLED' && delivery.status === 'CANCELLED') {
      extra.cancelled_by = 'REPARTIDOR';
      extra.cancellation_reason = delivery.cancellation_reason || '';
    } else if (order.status === 'CANCELLED') {
      extra.cancelled_by = 'RESTAURANTE';
    }

    return { ...order, ...extra };
  }
  return order;
}));
```

**En el frontend (admin-orders.component.html):**

```html
<!-- La foto se muestra como imagen inline con el string base64 -->
<img [src]="order.delivery_photo"
     alt="Foto de entrega"
     class="delivery-photo" />

<!-- Boton de reembolso solo visible si la orden esta CANCELLED o DELIVERED -->
<button (click)="approveRefund(order.id)"
        *ngIf="order.status === 'CANCELLED' || order.status === 'DELIVERED'">
  Aprobar Reembolso
</button>
```

### 5.2 Flujo Tecnico de Reembolso

```
Admin hace clic en "Aprobar Reembolso"
       |
       v POST /admin/orders/:orderId/refund
         (requiere token JWT con rol ADMIN)
       |
       v API Gateway → adminRoutes.ts
         → paymentServiceClient.refundPayment(orderId)
       |
       v Payment Service — gRPC RefundPayment
         → repository.refundByOrderId(orderId)

         SQL:
         UPDATE payments
         SET status = 'REFUNDED'
         WHERE order_id = $1
           AND status   = 'COMPLETED'
         RETURNING *

         Si no encuentra fila (ya reembolsado o nunca pagado):
           → devuelve error "No se encontro pago COMPLETED para esta orden"
       |
       v API Gateway (tras recibir confirmacion del Payment Service)
         → Consulta Order Service para obtener userId
         → Consulta Auth Service para obtener email del usuario
         → Llama a Notification Service: sendPaymentRefunded(...)
       |
       v Respuesta al admin
  { "success": true, "message": "Reembolso aprobado", "payment": { "status": "REFUNDED", ... } }
```

**Proto del Payment Service para reembolso:**

```proto
// payment-service/src/infrastructure/grpc/proto/payment.proto
rpc RefundPayment (RefundPaymentRequest) returns (RefundPaymentResponse);

message RefundPaymentRequest {
  string order_id = 1;
}

message RefundPaymentResponse {
  bool    success  = 1;
  string  message  = 2;
  Payment payment  = 3;
}
```

**Registro en payment-service/src/server.ts:**

```typescript
// IMPORTANTE: RefundPayment debe estar registrado en addService
server.addService(paymentProto.PaymentService.service, {
  ProcessPayment: handler.processPayment.bind(handler),
  RefundPayment:  handler.refundPayment.bind(handler),   // <- requerido
});
```

**Delivery Service — GetDeliveryByOrder en server.ts:**

```typescript
// IMPORTANTE: GetDeliveryByOrder debe estar registrado
server.addService(deliveryProto.DeliveryService.service, {
  // ...otros handlers...
  GetDeliveryByOrder: handler.getDeliveryByOrder.bind(handler),  // <- requerido para fotos en admin
});
```

### 5.3 Notificacion de Reembolso

Tras aprobar el reembolso, el sistema envia automaticamente un email al cliente con:

- Numero de orden (primeros 8 chars del UUID en mayusculas)
- Monto reembolsado en GTQ y USD
- Tipo de cambio usado al momento del pago original
- Metodo de pago original
- Estado: REEMBOLSADO

```typescript
await notificationServiceClient.sendPaymentRefunded({
  user_id: order.user_id,
  user_email: userEmail,
  user_name: userName,
  order_id: orderId,
  order_number: orderId.substring(0, 8).toUpperCase(),
  amount: payment.amount,
  currency: payment.currency,
  amount_gtq: payment.amount_gtq,
  amount_usd: payment.amount_usd,
  exchange_rate: payment.exchange_rate,
  payment_method: payment.payment_method,
  status: 'REEMBOLSADO'
});
```

*Practica 5 — Software Avanzado 2026 — Carnet 201114493*
