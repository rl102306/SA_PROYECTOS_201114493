# 📋 RÚBRICA COMPLETA - DÓNDE ESTÁ CADA PUNTO (100 puntos)

## ✅ 1. Orquestación con Docker (10 puntos)

### **Archivo:** `docker-compose.yml`

**Ubicación:** `/delivereats-project/docker-compose.yml`

**Qué se evalúa:**
- ✅ Configuración de múltiples servicios
- ✅ Redes entre contenedores
- ✅ Volúmenes para persistencia
- ✅ Variables de entorno
- ✅ Dependencias entre servicios
- ✅ Health checks

**Código específico (líneas 1-186):**
```yaml
version: '3.8'

services:
  # 3 Bases de datos
  auth-db:
    image: postgres:15-alpine
    ports: ["5432:5432"]
    volumes: [auth-db-data:/var/lib/postgresql/data]
    healthcheck: [...]
  
  catalog-db: [...]
  order-db: [...]
  
  # 5 Servicios
  auth-service:
    build: ./auth-service
    depends_on:
      auth-db:
        condition: service_healthy  # ← Health check
    networks: [delivereats-network]  # ← Red compartida
  
  catalog-service: [...]
  order-service:
    environment:
      CATALOG_SERVICE_URL: catalog-service:50051  # ← Comunicación
    depends_on: [catalog-db, catalog-service]
  
  api-gateway: [...]
  frontend: [...]

networks:
  delivereats-network:  # ← Red para comunicación
    driver: bridge

volumes:  # ← Persistencia de datos
  auth-db-data:
  catalog-db-data:
  order-db-data:
```

**Evidencia:**
```bash
# Levantar todo
docker-compose up -d

# Ver servicios orquestados
docker-compose ps
# Deberías ver 8 contenedores corriendo
```

---

## ✅ 2. Aislamiento de Persistencia (10 puntos)

### **Qué se evalúa:**
- ✅ Cada microservicio tiene su propia base de datos
- ✅ No hay acceso directo entre bases de datos
- ✅ Patrón Database-per-Service

**Evidencia en docker-compose.yml:**
```yaml
# Base de datos 1: SOLO para auth-service
auth-db:
  environment:
    POSTGRES_DB: auth_db     # ← BD exclusiva
    POSTGRES_USER: auth_user # ← Usuario exclusivo
  ports: ["5432:5432"]

# Base de datos 2: SOLO para catalog-service  
catalog-db:
  environment:
    POSTGRES_DB: catalog_db
    POSTGRES_USER: catalog_user
  ports: ["5433:5432"]  # ← Puerto diferente

# Base de datos 3: SOLO para order-service
order-db:
  environment:
    POSTGRES_DB: order_db
    POSTGRES_USER: order_user
  ports: ["5434:5432"]  # ← Puerto diferente
```

**Archivos de configuración:**

**auth-service/.env:**
```env
DB_NAME=auth_db          # ← Solo accede a auth_db
DB_USER=auth_user
DB_PASSWORD=auth_password
```

**catalog-service/.env:**
```env
DB_NAME=catalog_db       # ← Solo accede a catalog_db
DB_USER=catalog_user
```

**order-service/.env:**
```env
DB_NAME=order_db         # ← Solo accede a order_db
DB_USER=order_user
```

**Código de conexión aislada:**

`auth-service/src/infrastructure/database/postgres/config.ts` (líneas 3-10):
```typescript
export const createDatabasePool = (): Pool => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'auth_db',  // ← SOLO auth_db
    user: process.env.DB_USER || 'auth_user',
    password: process.env.DB_PASSWORD,
  });
```

**Evidencia:**
```bash
# Ver bases de datos separadas
docker exec -it delivereats-auth-db psql -U auth_user -d auth_db -c "\dt"
# Resultado: Tabla "users" (solo auth)

docker exec -it delivereats-catalog-db psql -U catalog_user -d catalog_db -c "\dt"
# Resultado: Tabla "products" (solo catalog)

docker exec -it delivereats-order-db psql -U order_user -d order_db -c "\dt"
# Resultado: Tabla "orders" (solo orders)
```

---

## ✅ 3. Definición de Contrato (10 puntos)

### **Qué se evalúa:**
- ✅ Archivos .proto con Protocol Buffers
- ✅ Servicios gRPC definidos
- ✅ Mensajes de Request y Response
- ✅ Tipos de datos estructurados

**Archivo principal:** `catalog.proto`

**Ubicación:** `restaurant-catalog-service/src/infrastructure/grpc/proto/catalog.proto`

**Código completo (líneas 1-63):**
```protobuf
syntax = "proto3";

package catalog;

// ← DEFINICIÓN DEL SERVICIO gRPC
service CatalogService {
  rpc ValidateOrder (ValidationRequest) returns (ValidationResponse);
  rpc GetProduct (GetProductRequest) returns (GetProductResponse);
  rpc GetRestaurantCatalog (GetRestaurantCatalogRequest) returns (GetRestaurantCatalogResponse);
}

// ← MENSAJE DE SOLICITUD (lo que envía Order Service)
message ValidationRequest {
  string restaurant_id = 1;
  repeated OrderItem items = 2;  // ← Lista de productos
}

message OrderItem {
  string product_id = 1;
  int32 quantity = 2;
  double expected_price = 3;  // ← Precio para validar
}

// ← MENSAJE DE RESPUESTA (lo que devuelve Catalog Service)
message ValidationResponse {
  bool is_valid = 1;           // ← ¿Es válida?
  string message = 2;          // ← Mensaje descriptivo
  repeated ValidationError errors = 3;  // ← Lista de errores
}

message ValidationError {
  string product_id = 1;
  string error_type = 2;       // ← NOT_FOUND, WRONG_PRICE, etc.
  string message = 3;
}

message Product {
  string id = 1;
  string restaurant_id = 2;
  string name = 3;
  string description = 4;
  double price = 5;
  string category = 6;
  bool is_available = 7;
  string image_url = 8;
}
```

**También en:**
- `order-service/src/infrastructure/grpc/proto/catalog.proto` (copia del contrato)
- `auth-service/src/infrastructure/grpc/proto/auth.proto`
- `order-service/src/infrastructure/grpc/proto/order.proto`

**Evidencia:**
Los archivos .proto son el **contrato formal** entre servicios.

---

## ✅ 4. Acoplamiento de Contrato (10 puntos)

### **Qué se evalúa:**
- ✅ El servidor implementa el contrato (.proto)
- ✅ El cliente usa el contrato (.proto)
- ✅ Ambos usan el MISMO contrato

### **SERVIDOR (Catalog Service)**

**Archivo:** `restaurant-catalog-service/src/infrastructure/grpc/handlers/CatalogServiceHandler.ts`

**Líneas 12-57:**
```typescript
export class CatalogServiceHandler {
  // ← IMPLEMENTA el método ValidateOrder definido en catalog.proto
  async ValidateOrder(call: any, callback: any) {
    try {
      // ← RECIBE ValidationRequest (según contrato)
      const { restaurant_id, items } = call.request;

      console.log(`📦 Validando orden para restaurante ${restaurant_id}`);

      const orderItems = items.map((item: any) => ({
        productId: item.product_id,      // ← Usa los campos del .proto
        quantity: item.quantity,
        expectedPrice: item.expected_price
      }));

      const result = await this.validateOrderUseCase.execute(
        restaurant_id,
        orderItems
      );

      // ← DEVUELVE ValidationResponse (según contrato)
      const response = {
        is_valid: result.isValid,        // ← Campo definido en .proto
        message: result.message,
        errors: result.errors.map(error => ({
          product_id: error.productId,
          error_type: error.errorType,
          message: error.message
        }))
      };

      callback(null, response);
    } catch (error) {
      callback({ code: 13, message: 'Error interno' });
    }
  }
}
```

**Registro del servidor (líneas 29-37 en server.ts):**
```typescript
// Cargar el contrato .proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {...});
const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog;

// Registrar el servicio
server.addService(catalogProto.CatalogService.service, {
  ValidateOrder: handler.ValidateOrder.bind(handler),  // ← Implementación
  GetProduct: handler.GetProduct.bind(handler),
  GetRestaurantCatalog: handler.GetRestaurantCatalog.bind(handler)
});
```

### **CLIENTE (Order Service)**

**Archivo:** `order-service/src/infrastructure/grpc/clients/CatalogServiceClient.ts`

**Líneas 7-21:**
```typescript
// ← CARGA el MISMO contrato .proto
const PROTO_PATH = path.join(__dirname, '../proto/catalog.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {...});
const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog;

export class CatalogServiceClient {
  private client: any;

  constructor() {
    const catalogServiceUrl = process.env.CATALOG_SERVICE_URL || 'localhost:50051';
    
    // ← CREA cliente usando el contrato
    this.client = new catalogProto.CatalogService(
      catalogServiceUrl,
      grpc.credentials.createInsecure()
    );
  }
```

**Llamada al servidor (líneas 43-70):**
```typescript
  async validateOrder(request: ValidationRequest): Promise<ValidationResponse> {
    return new Promise((resolve, reject) => {
      // ← CONSTRUYE ValidationRequest (según contrato)
      const grpcRequest = {
        restaurant_id: request.restaurantId,
        items: request.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          expected_price: item.expectedPrice
        }))
      };

      console.log(`📡 Enviando validación gRPC...`);

      // ← LLAMA al método ValidateOrder del contrato
      this.client.ValidateOrder(grpcRequest, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }

        // ← RECIBE ValidationResponse (según contrato)
        const result: ValidationResponse = {
          isValid: response.is_valid,
          message: response.message,
          errors: response.errors || []
        };

        resolve(result);
      });
    });
  }
```

**Evidencia:**
Ambos usan `catalog.proto` → **MISMO CONTRATO** → Acoplamiento correcto.

---

## ✅ 5. Consistencia de Datos entre Servicios (10 puntos)

### **Qué se evalúa:**
- ✅ Order Service valida ANTES de guardar
- ✅ Si Catalog dice "no válido" → NO se guarda la orden
- ✅ Si Catalog dice "válido" → SÍ se guarda la orden
- ✅ Datos consistentes entre servicios

**Archivo:** `order-service/src/application/usecases/CreateOrderUseCase.ts`

**Líneas 26-47 (VALIDACIÓN ANTES DE GUARDAR):**
```typescript
export class CreateOrderUseCase {
  async execute(dto: CreateOrderDTO): Promise<Order> {
    // 1. Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }

    console.log('🔍 Validando orden con Catalog Service vía gRPC...');
    
    // 2. ← VALIDAR CON CATALOG SERVICE (gRPC)
    const validationResult = await this.catalogClient.validateOrder({
      restaurantId: dto.restaurantId,
      items: dto.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        expectedPrice: item.price
      }))
    });

    // 3. ← SI LA VALIDACIÓN FALLA, NO GUARDAR
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors
        .map(err => `${err.productId}: ${err.message}`)
        .join(', ');
      
      console.log(`❌ Validación fallida: ${errorMessages}`);
      throw new Error(`Validación de orden fallida: ${errorMessages}`);
      // ← AQUÍ SE DETIENE, NO SE GUARDA NADA
    }

    console.log('✅ Validación exitosa - procediendo a crear orden');

    // 4. Calcular total
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );

    // 5. Crear la orden
    const order = new Order({...});

    // 6. ← SOLO AHORA SE GUARDA (después de validar)
    const savedOrder = await this.orderRepository.save(order);

    console.log(`✅ Orden ${savedOrder.id} creada exitosamente`);

    return savedOrder;
  }
}
```

**Flujo de Consistencia:**
```
Order Service recibe petición
       ↓
Llama a Catalog Service (gRPC)
       ↓
Catalog valida productos
       ↓
┌──────┴──────┐
│             │
NO VÁLIDO     VÁLIDO
│             │
↓             ↓
ERROR         Guarda orden en BD
No se guarda  (INSERT)
Return error  Return orden creada
```

**Evidencia:**
```bash
# Caso exitoso
curl -X POST http://localhost:3000/orders -H "Authorization: Bearer TOKEN" -d '{...}'
# Logs:
# order-service: 🔍 Validando con gRPC...
# catalog-service: ✅ Validación exitosa
# order-service: ✅ Orden creada

# Caso fallido
curl -X POST http://localhost:3000/orders -H "Authorization: Bearer TOKEN" -d '{precio incorrecto}'
# Logs:
# order-service: 🔍 Validando con gRPC...
# catalog-service: ❌ Precio incorrecto
# order-service: ❌ Validación fallida
# (NO SE GUARDA EN BD)
```

---

## ✅ 6. Existencia y Persistencia (10 puntos)

### **Qué se evalúa:**
- ✅ Validación 1: ¿El producto existe en la BD?
- ✅ Validación 2: ¿El producto pertenece al restaurante?

**Archivo:** `restaurant-catalog-service/src/application/usecases/ValidateOrderUseCase.ts`

**Líneas 32-53 (VALIDACIÓN DE EXISTENCIA Y PERTENENCIA):**
```typescript
export class ValidateOrderUseCase {
  async execute(restaurantId: string, items: OrderItemDTO[]): Promise<ValidationResultDTO> {
    const errors: ValidationErrorDTO[] = [];

    for (const item of items) {
      // ← VALIDACIÓN 1: ¿EXISTE EN LA BASE DE DATOS?
      const product = await this.productRepository.findById(item.productId);
      
      if (!product) {
        // ← NO EXISTE → ERROR
        errors.push({
          productId: item.productId,
          errorType: 'NOT_FOUND',
          message: `Producto ${item.productId} no encontrado`
        });
        continue;  // ← Saltar al siguiente producto
      }

      // ← VALIDACIÓN 2: ¿PERTENECE AL RESTAURANTE?
      if (product.restaurantId !== restaurantId) {
        // ← NO PERTENECE → ERROR
        errors.push({
          productId: item.productId,
          errorType: 'WRONG_RESTAURANT',
          message: `Producto ${item.productId} no pertenece al restaurante ${restaurantId}`
        });
        continue;
      }

      // ... continúa con más validaciones
    }

    const isValid = errors.length === 0;
    return { isValid, message: '...', errors };
  }
}
```

**Implementación del repositorio:**

`restaurant-catalog-service/src/infrastructure/database/postgres/PostgresProductRepository.ts` (líneas 9-21):
```typescript
export class PostgresProductRepository implements IProductRepository {
  async findById(id: string): Promise<Product | null> {
    // ← BUSCA EN LA BASE DE DATOS
    const result = await this.pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;  // ← No existe
    }

    return this.mapToEntity(result.rows[0]);  // ← Existe
  }
}
```

**Evidencia:**
```sql
-- Ver productos en la BD
SELECT id, restaurant_id, name FROM products;

-- Resultado:
-- 11111111-1111-1111... | 99999999-9999-9999... | Pizza Margarita

-- Si envías productId que NO existe → NOT_FOUND
-- Si envías productId de otro restaurante → WRONG_RESTAURANT
```

---

## ✅ 7. Disponibilidad (10 puntos)

### **Qué se evalúa:**
- ✅ Validación 3: ¿El producto está disponible (is_available)?

**Archivo:** `restaurant-catalog-service/src/application/usecases/ValidateOrderUseCase.ts`

**Líneas 55-63 (VALIDACIÓN DE DISPONIBILIDAD):**
```typescript
      // ← VALIDACIÓN 3: ¿ESTÁ DISPONIBLE?
      if (!product.isAvailable) {
        // ← NO DISPONIBLE → ERROR
        errors.push({
          productId: item.productId,
          errorType: 'UNAVAILABLE',
          message: `Producto ${item.productId} (${product.name}) no está disponible`
        });
        continue;
      }
```

**Tabla en base de datos:**

`restaurant-catalog-service/src/infrastructure/database/postgres/config.ts` (líneas 19-31):
```sql
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  is_available BOOLEAN DEFAULT true,  -- ← CAMPO DE DISPONIBILIDAD
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Datos de ejemplo:**
```sql
INSERT INTO products (..., is_available, ...)
VALUES 
  (..., true, ...),   -- ← Pizza: DISPONIBLE
  (..., false, ...);  -- ← Ensalada: NO DISPONIBLE
```

**Evidencia:**
```bash
# Ver disponibilidad
docker exec -it delivereats-catalog-db psql -U catalog_user -d catalog_db -c "SELECT name, is_available FROM products;"

# Resultado:
# Pizza Margarita     | t (disponible)
# Ensalada César      | f (no disponible)

# Si intentas pedir Ensalada César → ERROR UNAVAILABLE
```

---

## ✅ 8. Respuesta al Usuario (10 puntos)

### **Qué se evalúa:**
- ✅ Mensajes claros de éxito
- ✅ Mensajes claros de error
- ✅ Frontend muestra los resultados

**Archivo:** `api-gateway/src/routes/orderRoutes.ts`

**Líneas 15-52 (RESPUESTA AL USUARIO):**
```typescript
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { restaurantId, items, deliveryAddress } = req.body;

    const response = await orderServiceClient.createOrder({...});

    if (response.success) {
      // ← RESPUESTA DE ÉXITO
      res.json({
        success: true,
        message: response.message,
        order: {
          id: response.order.id,
          userId: response.order.user_id,
          restaurantId: response.order.restaurant_id,
          items: response.order.items,
          status: response.order.status,
          totalAmount: response.order.total_amount,
          deliveryAddress: response.order.delivery_address,
          createdAt: response.order.created_at
        }
      });
    } else {
      // ← RESPUESTA DE ERROR
      res.status(400).json({
        success: false,
        message: response.message || 'Error al crear orden'
      });
    }
  } catch (error: any) {
    // ← RESPUESTA DE ERROR (excepción)
    console.error('Error en POST /orders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear orden'
    });
  }
});
```

**Frontend muestra el resultado:**

`frontend/src/app/features/client/components/create-order.component.ts` (líneas 134-157):
```typescript
this.orderService.createOrder(orderData).subscribe({
  next: (response) => {
    if (response.success) {
      // ← MUESTRA MENSAJE DE ÉXITO
      this.successMessage = `✅ ¡Orden creada exitosamente! ID: ${response.order?.id}`;
      console.log('✅ Orden creada:', response.order);
    } else {
      // ← MUESTRA MENSAJE DE ERROR
      this.errorMessage = response.message || 'Error al crear orden';
      console.error('❌ Error:', response.message);
    }
  },
  error: (error) => {
    // ← MUESTRA ERROR DE COMUNICACIÓN
    console.error('❌ Error al crear orden:', error);
    this.errorMessage = error.error?.message || 'Error al crear orden';
  }
});
```

**Frontend HTML:**

`create-order.component.html` (líneas 163-171):
```html
<!-- Mensaje de Éxito -->
<div class="alert alert-success" *ngIf="successMessage">
  {{ successMessage }}
</div>

<!-- Mensaje de Error -->
<div class="alert alert-error" *ngIf="errorMessage">
  ❌ {{ errorMessage }}
</div>
```

**Evidencia:**
```
Usuario ve en pantalla:
✅ "¡Orden creada exitosamente! ID: abc-123"
O
❌ "Precio incorrecto para Pizza Margarita. Actual: $12.99, Recibido: $5.00"
```

---

## ✅ 9. Logs de Éxito (10 puntos)

### **Qué se evalúa:**
- ✅ Logs cuando la validación es exitosa
- ✅ Logs cuando la orden se crea

**Catalog Service:**

`restaurant-catalog-service/src/application/usecases/ValidateOrderUseCase.ts` (líneas 77-78):
```typescript
if (isValid) {
  console.log(`✅ Validación exitosa para restaurante ${restaurantId}: ${items.length} productos`);
}
```

**Order Service:**

`order-service/src/application/usecases/CreateOrderUseCase.ts` (líneas 36 y 54):
```typescript
console.log('✅ Validación exitosa - procediendo a crear orden');

// ... después de guardar

console.log(`✅ Orden ${savedOrder.id} creada exitosamente - Total: $${totalAmount.toFixed(2)}`);
```

**Catalog Service Handler:**

`restaurant-catalog-service/src/infrastructure/grpc/handlers/CatalogServiceHandler.ts` (líneas 15-16):
```typescript
async ValidateOrder(call: any, callback: any) {
  console.log(`📦 Validando orden para restaurante ${restaurant_id} con ${items.length} productos`);
  // ...
}
```

**Order Service Client:**

`order-service/src/infrastructure/grpc/clients/CatalogServiceClient.ts` (líneas 54 y 71):
```typescript
console.log(`📡 Enviando validación gRPC para ${request.items.length} productos...`);

if (result.isValid) {
  console.log('✅ Validación gRPC exitosa');
}
```

**Evidencia (ejecuta y verás):**
```bash
# Terminal de Catalog Service:
📦 Validando orden para restaurante 99999999... con 2 productos
✅ Validación exitosa para restaurante 99999999...: 2 productos

# Terminal de Order Service:
📦 Creando orden para usuario abc-123...
🔍 Validando orden con Catalog Service vía gRPC...
📡 Enviando validación gRPC para 2 productos...
✅ Validación gRPC exitosa
✅ Validación exitosa - procediendo a crear orden
✅ Orden orden-uuid creada exitosamente - Total: $25.98
```

---

## ✅ 10. Logs de Fallo (7.5 puntos)

### **Qué se evalúa:**
- ✅ Logs cuando la validación falla
- ✅ Logs con detalles del error

**Catalog Service:**

`restaurant-catalog-service/src/application/usecases/ValidateOrderUseCase.ts` (líneas 79-80):
```typescript
} else {
  console.log(`❌ Validación fallida para restaurante ${restaurantId}: ${errors.length} errores`);
}
```

**Order Service:**

`order-service/src/application/usecases/CreateOrderUseCase.ts` (líneas 29-34):
```typescript
if (!validationResult.isValid) {
  const errorMessages = validationResult.errors
    .map(err => `${err.productId}: ${err.message}`)
    .join(', ');
  
  console.log(`❌ Validación fallida: ${errorMessages}`);
  throw new Error(`Validación de orden fallida: ${errorMessages}`);
}
```

**Order Service Client:**

`order-service/src/infrastructure/grpc/clients/CatalogServiceClient.ts` (líneas 73-75):
```typescript
} else {
  console.log(`⚠️ Validación gRPC fallida: ${result.errors.length} errores`);
}
```

**Catalog Service Handler:**

`restaurant-catalog-service/src/infrastructure/grpc/handlers/CatalogServiceHandler.ts` (líneas 40-43):
```typescript
} catch (error) {
  console.error('❌ Error en ValidateOrder:', error);
  callback({ code: 13, message: 'Error interno del servidor' });
}
```

**Evidencia (ejecuta con datos incorrectos):**
```bash
# Terminal de Catalog Service:
📦 Validando orden para restaurante 99999999... con 1 productos
❌ Validación fallida para restaurante 99999999...: 1 errores

# Terminal de Order Service:
📦 Creando orden para usuario abc-123...
🔍 Validando orden con Catalog Service vía gRPC...
📡 Enviando validación gRPC para 1 productos...
⚠️ Validación gRPC fallida: 1 errores
❌ Validación fallida: 11111111-1111-1111-1111-111111111111: Precio incorrecto para Pizza Margarita. Precio actual: $12.99, Precio recibido: $5.00
```

---

## 📊 TABLA RESUMEN

| # | Criterio | Puntos | Archivo(s) Principal(es) | Líneas |
|---|----------|--------|--------------------------|--------|
| 1 | Orquestación Docker | 10 | `docker-compose.yml` | 1-186 |
| 2 | Aislamiento Persistencia | 10 | `docker-compose.yml`, `.env` files | 8-40 |
| 3 | Definición Contrato | 10 | `catalog.proto` | 1-63 |
| 4 | Acoplamiento Contrato | 10 | `CatalogServiceHandler.ts`, `CatalogServiceClient.ts` | Server: 12-57, Client: 43-70 |
| 5 | Consistencia Datos | 10 | `CreateOrderUseCase.ts` | 26-54 |
| 6 | Existencia/Persistencia | 10 | `ValidateOrderUseCase.ts` | 32-53 |
| 7 | Disponibilidad | 10 | `ValidateOrderUseCase.ts` | 55-63 |
| 8 | Respuesta Usuario | 10 | `orderRoutes.ts`, `create-order.component.ts` | 15-52, 134-157 |
| 9 | Logs Éxito | 10 | `ValidateOrderUseCase.ts`, `CreateOrderUseCase.ts` | 77-78, 36+54 |
| 10 | Logs Fallo | 7.5 | `ValidateOrderUseCase.ts`, `CreateOrderUseCase.ts` | 79-80, 29-34 |

**TOTAL:** 97.5 / 100 puntos

---

## 🎯 Para Demostrar al Profesor

1. **Mostrar docker-compose.yml** → Orquestación
2. **Mostrar 3 bases de datos separadas** → Aislamiento
3. **Mostrar catalog.proto** → Contrato
4. **Mostrar servidor + cliente usando .proto** → Acoplamiento
5. **Ejecutar orden exitosa** → Ver logs de éxito
6. **Ejecutar orden con error** → Ver logs de fallo
7. **Mostrar código de validaciones** → Consistencia/Existencia/Disponibilidad
8. **Mostrar frontend con mensajes** → Respuesta al usuario

---

¡TODO ESTÁ EN EL CÓDIGO! 🎓
