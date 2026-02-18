# 🔌 ¿Qué es gRPC y Para Qué Sirve?

## 🤔 La Pregunta Fundamental

**¿Por qué necesitamos gRPC?**

Imagina que tienes 5 microservicios que necesitan **hablarse entre sí**. ¿Cómo lo hacen?

---

## 📞 Analogía del Mundo Real

### Sin gRPC (como llamadas telefónicas normales):

```
Tú: "Hola, ¿tienes pizza?"
Restaurante: "Sí"
Tú: "¿Cuánto cuesta?"
Restaurante: "12.99"
Tú: "¿Está disponible?"
Restaurante: "Sí"
```
**Problema**: Muchas llamadas separadas, cada una tarda tiempo.

### Con gRPC (como un walkie-talkie directo y rápido):

```
Tú: "Dame toda la info de la pizza: existencia, precio, disponibilidad"
Restaurante: [INMEDIATAMENTE] "Sí existe, $12.99, disponible"
```
**Ventaja**: Una sola llamada, respuesta inmediata, formato estructurado.

---

## 🆚 REST vs gRPC - La Diferencia

### 🌐 REST (lo que usa el Frontend)

```
Frontend → API Gateway
📱 HTTP/1.1
📄 JSON (texto plano)
🐌 Más lento
👨‍💻 Fácil de leer para humanos

Ejemplo:
POST /orders
{
  "restaurantId": "123",
  "items": [
    {"productId": "456", "price": 12.99}
  ]
}
```

**Uso**: Comunicación con el mundo exterior (navegadores, apps móviles)

### ⚡ gRPC (lo que usan los microservicios entre sí)

```
Order Service → Catalog Service
🔌 HTTP/2
📦 Protocol Buffers (binario)
🚀 Mucho más rápido
🤖 Optimizado para máquinas

Ejemplo:
ValidateOrder({
  restaurant_id: "123",
  items: [{product_id: "456", expected_price: 12.99}]
})
```

**Uso**: Comunicación interna entre microservicios

---

## 📊 Comparación Visual

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (Angular)                     │
│              "Quiero crear una orden"                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ REST (HTTP/1.1, JSON)
                     │ {"restaurantId": "...", "items": [...]}
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY                           │
│         "Recibo peticiones del mundo exterior"          │
└────────┬──────────────────────────┬─────────────────────┘
         │                          │
         │ gRPC                     │ gRPC
         │ (binario, rápido)        │ (binario, rápido)
         │                          │
         ▼                          ▼
┌─────────────────┐         ┌──────────────────┐
│  ORDER SERVICE  │ ─gRPC─→ │ CATALOG SERVICE  │
│                 │         │                  │
│ "Necesito       │         │ "Validaré los    │
│  validar estos  │         │  productos"      │
│  productos"     │         │                  │
└─────────────────┘         └──────────────────┘
```

---

## 🎯 ¿Por Qué Usar gRPC en tu Proyecto?

### Problema Sin gRPC:

**Order Service necesita validar productos:**

```typescript
// ❌ Opción 1: Acceder directamente a la base de datos del catálogo
// PROBLEMA: Viola la arquitectura de microservicios
// Cada servicio debe tener su propia base de datos

const product = await catalogDatabase.query("SELECT * FROM products WHERE id = ?");

// ❌ Opción 2: HTTP REST interno
// PROBLEMA: Más lento, más código, menos eficiente

const response = await fetch('http://catalog-service:3001/products/validate', {
  method: 'POST',
  body: JSON.stringify({...})
});
const data = await response.json();
```

### Solución Con gRPC:

```typescript
// ✅ Llamada gRPC - Rápida, tipada, eficiente
const result = await catalogClient.validateOrder({
  restaurantId: "123",
  items: [...]
});
```

---

## 🔍 ¿Qué Hace gRPC en tu Proyecto? (Práctica 3)

### El Flujo Completo:

```
PASO 1: Usuario crea una orden
┌──────────┐
│ Frontend │ "Quiero 2 pizzas de $12.99 cada una"
└────┬─────┘
     │ REST
     ▼
┌─────────────┐
│ API Gateway │ "Recibí la orden, la envío a Order Service"
└──────┬──────┘
       │ gRPC
       ▼
┌──────────────┐
│Order Service │ "Antes de guardar, DEBO validar con Catalog"
└──────┬───────┘
       │
       │ gRPC ValidateOrder()
       │ Envía: {
       │   restaurant_id: "999...",
       │   items: [{
       │     product_id: "111...",
       │     quantity: 2,
       │     expected_price: 12.99
       │   }]
       │ }
       ▼
┌─────────────────┐
│ Catalog Service │ Valida:
│                 │ 1. ¿Existe el producto 111...? → SÍ ✅
│                 │ 2. ¿Es del restaurante 999...? → SÍ ✅
│                 │ 3. ¿Precio es 12.99? → SÍ ✅
│                 │ 4. ¿Está disponible? → SÍ ✅
└──────┬──────────┘
       │
       │ gRPC Response
       │ {
       │   is_valid: true,
       │   message: "Validación exitosa",
       │   errors: []
       │ }
       ▼
┌──────────────┐
│Order Service │ "Todo OK, AHORA SÍ guardo la orden"
│              │ INSERT INTO orders ...
└──────────────┘
```

### ¿Qué pasa si algo está mal?

```
CASO: Precio incorrecto
┌──────────────┐
│Order Service │ Envía: expected_price: 5.00
└──────┬───────┘
       │ gRPC
       ▼
┌─────────────────┐
│ Catalog Service │ Compara:
│                 │ Precio en DB: 12.99
│                 │ Precio enviado: 5.00
│                 │ → NO COINCIDEN ❌
└──────┬──────────┘
       │ gRPC Response
       │ {
       │   is_valid: false,
       │   message: "Validación fallida",
       │   errors: [{
       │     product_id: "111...",
       │     error_type: "WRONG_PRICE",
       │     message: "Precio incorrecto. Esperado: $12.99, Recibido: $5.00"
       │   }]
       │ }
       ▼
┌──────────────┐
│Order Service │ "NO guardo la orden, devuelvo error"
└──────────────┘
```

---

## 📝 Protocol Buffers (.proto) - El Contrato

### ¿Qué es un archivo .proto?

Es como un **contrato escrito** que dice:
- Qué métodos existen
- Qué datos se envían
- Qué datos se reciben

```protobuf
// catalog.proto
service CatalogService {
  // Este es el método que Order Service puede llamar
  rpc ValidateOrder (ValidationRequest) returns (ValidationResponse);
}

// Esto es lo que se ENVÍA
message ValidationRequest {
  string restaurant_id = 1;
  repeated OrderItem items = 2;
}

// Esto es lo que se RECIBE
message ValidationResponse {
  bool is_valid = 1;
  string message = 2;
  repeated ValidationError errors = 3;
}
```

### En código TypeScript:

**Servidor (Catalog Service):**
```typescript
// handlers/CatalogServiceHandler.ts
class CatalogServiceHandler {
  async ValidateOrder(call, callback) {
    const { restaurant_id, items } = call.request;
    
    // Validar cada producto
    const errors = [];
    for (const item of items) {
      const product = await this.findProduct(item.product_id);
      
      if (!product) {
        errors.push({
          product_id: item.product_id,
          error_type: "NOT_FOUND",
          message: "Producto no encontrado"
        });
      }
      
      if (product.price !== item.expected_price) {
        errors.push({
          product_id: item.product_id,
          error_type: "WRONG_PRICE",
          message: `Precio incorrecto. Esperado: ${product.price}`
        });
      }
    }
    
    // Responder
    callback(null, {
      is_valid: errors.length === 0,
      message: errors.length === 0 ? "OK" : "Errores encontrados",
      errors: errors
    });
  }
}
```

**Cliente (Order Service):**
```typescript
// clients/CatalogServiceClient.ts
class CatalogServiceClient {
  async validateOrder(request) {
    return new Promise((resolve, reject) => {
      // Llamar al servidor gRPC
      this.client.ValidateOrder(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Uso en CreateOrderUseCase
const validation = await catalogClient.validateOrder({
  restaurantId: "999...",
  items: [{
    productId: "111...",
    quantity: 2,
    expectedPrice: 12.99
  }]
});

if (!validation.isValid) {
  throw new Error("Orden inválida: " + validation.message);
}
```

---

## 🎓 Ventajas de gRPC para tu Práctica

### 1. **Comunicación Tipada**
```typescript
// El IDE te ayuda con autocompletado
const result = await client.validateOrder({
  restaurantId: "...",  // ← El IDE sabe que esto es string
  items: [...]          // ← El IDE sabe que esto es array
});

// Con REST tendría que ser:
const response = await fetch("/validate", {
  body: JSON.stringify({ /* no hay ayuda del IDE */ })
});
```

### 2. **Más Rápido**
- gRPC usa binario (Protocol Buffers) → Menos bytes
- HTTP/2 → Múltiples llamadas en una conexión
- REST usa JSON (texto) → Más bytes
- HTTP/1.1 → Una conexión por llamada

### 3. **Contrato Claro**
```protobuf
// El archivo .proto ES la documentación
// No hay confusión sobre qué enviar/recibir
service CatalogService {
  rpc ValidateOrder (ValidationRequest) returns (ValidationResponse);
}
```

### 4. **Validación Automática**
Si envías datos incorrectos, gRPC lo detecta inmediatamente:
```typescript
// ❌ Esto daría error en gRPC
await client.validateOrder({
  restaurant_id: 123,  // Error: debe ser string, no number
  items: "texto"       // Error: debe ser array
});
```

---

## 🔄 Comparación Final: REST vs gRPC

| Característica | REST (Frontend ↔ Gateway) | gRPC (Microservicios) |
|----------------|---------------------------|------------------------|
| **Protocolo** | HTTP/1.1 | HTTP/2 |
| **Formato** | JSON (texto) | Protocol Buffers (binario) |
| **Velocidad** | 🐌 Lento | 🚀 Rápido (3-10x más) |
| **Tipado** | ❌ No | ✅ Sí |
| **Legible por humanos** | ✅ Sí | ❌ No (es binario) |
| **Tamaño de datos** | 📦 Grande | 📦 Pequeño (70% menos) |
| **Uso en navegador** | ✅ Sí | ❌ No directamente |
| **Mejor para** | Cliente ↔ Servidor | Servidor ↔ Servidor |

---

## 💡 Resumen Simple

### ¿Qué es gRPC?
Una forma **súper rápida** de hacer que los microservicios se hablen entre sí.

### ¿Por qué lo usamos?
Porque Order Service **necesita preguntarle** a Catalog Service: "¿Estos productos son válidos?" ANTES de guardar la orden.

### ¿Por qué no REST?
- gRPC es **más rápido** (binario vs JSON)
- gRPC es **tipado** (menos errores)
- gRPC es **más eficiente** (menos bytes)

### ¿Cuándo usar cada uno?
- **REST**: Frontend ↔ API Gateway (humanos leen JSON)
- **gRPC**: Microservicio ↔ Microservicio (máquinas, velocidad)

---

## 🎯 En Tu Proyecto Específicamente:

```
Usuario crea orden → REST → API Gateway → gRPC → Order Service
                                                       ↓
                                                   "Necesito validar"
                                                       ↓
                                               gRPC ValidateOrder()
                                                       ↓
                                                 Catalog Service
                                                       ↓
                                              "Valido: productos OK"
                                                       ↓
                                                  Order Service
                                                       ↓
                                               "Guardo la orden"
```

**Sin gRPC**: Order Service tendría que acceder directamente a la base de datos de Catalog (❌ malo para microservicios)

**Con gRPC**: Order Service **pide permiso** a Catalog Service antes de guardar (✅ correcto)

---

## 🔍 Ver gRPC en Acción (Logs)

Cuando ejecutas las pruebas, verás:

```
order-service    | 📦 Creando orden para usuario...
order-service    | 🔍 Validando orden con Catalog Service vía gRPC...
order-service    | 📡 Enviando validación gRPC para 2 productos...
catalog-service  | 📦 Validando orden para restaurante 999... con 2 productos
catalog-service  | ✅ Validación exitosa para restaurante 999...: 2 productos
order-service    | ✅ Validación gRPC exitosa
order-service    | ✅ Orden creada exitosamente
```

Esa comunicación **order-service → catalog-service** es **gRPC**.

---

¿Ahora tiene más sentido? 😊
