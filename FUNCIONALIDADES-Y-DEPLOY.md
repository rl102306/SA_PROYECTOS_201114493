# 🚀 GUÍA COMPLETA: Funcionalidades Faltantes + Despliegue GCP

## PARTE 1: FUNCIONALIDADES FALTANTES

### 📁 Archivos a Crear para CRUD de Restaurantes

Copia estos archivos en tu proyecto:

---

#### 1. Actualizar config.ts para crear tabla restaurants

**Archivo:** `restaurant-catalog-service/src/infrastructure/database/postgres/config.ts`

**Agregar DESPUÉS de la tabla products:**

```typescript
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  schedule TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
```

---

#### 2. Use Cases Faltantes

**CreateRestaurantUseCase.ts** - Ya creado arriba

**UpdateRestaurantUseCase.ts:**

```typescript
import { IRestaurantRepository } from '../../domain/interfaces/IRestaurantRepository';
import { Restaurant } from '../../domain/entities/Restaurant';

export interface UpdateRestaurantDTO {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  schedule?: string;
  description?: string;
  imageUrl?: string;
}

export class UpdateRestaurantUseCase {
  constructor(private readonly restaurantRepository: IRestaurantRepository) {}

  async execute(dto: UpdateRestaurantDTO): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findById(dto.id);
    
    if (!restaurant) {
      throw new Error(`Restaurante ${dto.id} no encontrado`);
    }

    restaurant.update(dto);
    
    return await this.restaurantRepository.update(restaurant);
  }
}
```

**GetRestaurantsUseCase.ts:**

```typescript
import { IRestaurantRepository } from '../../domain/interfaces/IRestaurantRepository';
import { Restaurant } from '../../domain/entities/Restaurant';

export class GetRestaurantsUseCase {
  constructor(private readonly restaurantRepository: IRestaurantRepository) {}

  async execute(): Promise<Restaurant[]> {
    return await this.restaurantRepository.findActive();
  }
}
```

---

### 📁 Actualizar Order-Service para Cancelar/Rechazar

#### CancelOrderUseCase.ts

**Ubicación:** `order-service/src/application/usecases/CancelOrderUseCase.ts`

```typescript
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { Order, OrderStatus } from '../../domain/entities/Order';

export interface CancelOrderDTO {
  orderId: string;
  userId: string;
  cancelledBy: 'CLIENT' | 'RESTAURANT' | 'DELIVERY';
  reason: string;
}

export class CancelOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(dto: CancelOrderDTO): Promise<Order> {
    console.log(`❌ Cancelando orden ${dto.orderId} por ${dto.cancelledBy}`);

    const order = await this.orderRepository.findById(dto.orderId);

    if (!order) {
      throw new Error(`Orden ${dto.orderId} no encontrada`);
    }

    // Solo el dueño puede cancelar (si es cliente)
    if (dto.cancelledBy === 'CLIENT' && order.userId !== dto.userId) {
      throw new Error('No tienes permiso para cancelar esta orden');
    }

    // No se puede cancelar si ya está entregada
    if (order.status === OrderStatus.DELIVERED) {
      throw new Error('No se puede cancelar una orden ya entregada');
    }

    order.cancel(dto.reason);

    const updatedOrder = await this.orderRepository.update(order);

    console.log(`✅ Orden ${dto.orderId} cancelada`);

    return updatedOrder;
  }
}
```

#### UpdateOrderStatusUseCase.ts

```typescript
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { Order, OrderStatus } from '../../domain/entities/Order';

export interface UpdateOrderStatusDTO {
  orderId: string;
  status: 'IN_PROCESS' | 'READY' | 'REJECTED';
  rejectionReason?: string;
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(dto: UpdateOrderStatusDTO): Promise<Order> {
    console.log(`📝 Actualizando orden ${dto.orderId} a ${dto.status}`);

    const order = await this.orderRepository.findById(dto.orderId);

    if (!order) {
      throw new Error(`Orden ${dto.orderId} no encontrada`);
    }

    switch (dto.status) {
      case 'IN_PROCESS':
        order.markAsInProcess();
        break;
      case 'READY':
        order.markAsReady();
        break;
      case 'REJECTED':
        if (!dto.rejectionReason) {
          throw new Error('Se requiere razón para rechazar');
        }
        order.reject(dto.rejectionReason);
        break;
    }

    const updatedOrder = await this.orderRepository.update(order);

    console.log(`✅ Orden actualizada a ${dto.status}`);

    return updatedOrder;
  }
}
```

#### Actualizar Order Entity

**Archivo:** `order-service/src/domain/entities/Order.ts`

**Agregar estos métodos:**

```typescript
export enum OrderStatus {
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  READY = 'READY',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

// Agregar en la clase Order:

markAsInProcess(): void {
  if (this.props.status !== OrderStatus.PENDING) {
    throw new Error('Solo se puede procesar una orden pendiente');
  }
  this.props.status = OrderStatus.IN_PROCESS;
  this.props.updatedAt = new Date();
}

markAsReady(): void {
  if (this.props.status !== OrderStatus.IN_PROCESS) {
    throw new Error('Solo se puede marcar como lista una orden en proceso');
  }
  this.props.status = OrderStatus.READY;
  this.props.updatedAt = new Date();
}

cancel(reason: string): void {
  this.props.status = OrderStatus.CANCELLED;
  this.props.cancellationReason = reason;
  this.props.updatedAt = new Date();
}

reject(reason: string): void {
  this.props.status = OrderStatus.REJECTED;
  this.props.rejectionReason = reason;
  this.props.updatedAt = new Date();
}
```

---

### 📁 Rutas API Gateway Faltantes

**Archivo:** `api-gateway/src/routes/restaurantRoutes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { catalogServiceClient } from '../clients/catalogServiceClient';

const router = Router();

// Listar restaurantes (público)
router.get('/', async (req: Request, res: Response) => {
  try {
    const response = await catalogServiceClient.getRestaurants();
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Crear restaurante (Admin)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    const response = await catalogServiceClient.createRestaurant(req.body);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Actualizar restaurante (Admin)
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    const response = await catalogServiceClient.updateRestaurant(req.params.id, req.body);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Eliminar restaurante (Admin)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Solo administradores' });
    }

    await catalogServiceClient.deleteRestaurant(req.params.id);
    res.json({ success: true, message: 'Restaurante eliminado' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

**Agregar en server.ts:**

```typescript
import restaurantRoutes from './routes/restaurantRoutes';

app.use('/restaurants', restaurantRoutes);
```

**Rutas para Cancelar/Rechazar en orderRoutes.ts:**

```typescript
// Cancelar orden (Cliente)
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { reason } = req.body;

    const response = await orderServiceClient.cancelOrder({
      orderId: req.params.id,
      userId,
      cancelledBy: 'CLIENT',
      reason
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Actualizar estado (Restaurante)
router.patch('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (user.role !== 'RESTAURANT') {
      return res.status(403).json({ success: false, message: 'Solo restaurantes' });
    }

    const { status, rejectionReason } = req.body;

    const response = await orderServiceClient.updateOrderStatus({
      orderId: req.params.id,
      status,
      rejectionReason
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

---

## PARTE 2: DESPLIEGUE EN GOOGLE CLOUD PLATFORM

### ✅ PASOS COMPLETOS PARA DESPLEGAR

Ya tienes billing activo, ahora continuamos:

---

### PASO 1: Crear Cloud SQL Instances

```powershell
# Auth Database (tarda 5-10 minutos)
gcloud sql instances create auth-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --root-password=AuthDB@2026

# Catalog Database
gcloud sql instances create catalog-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --root-password=CatalogDB@2026

# Order Database
gcloud sql instances create order-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --root-password=OrderDB@2026

# Delivery Database
gcloud sql instances create delivery-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --root-password=DeliveryDB@2026
```

**Verificar progreso:**
```powershell
gcloud sql instances list
```

**O en el navegador:**
```
https://console.cloud.google.com/sql/instances?project=delivereats-prod
```

---

### PASO 2: Crear Bases de Datos y Usuarios

**Ejecutar DESPUÉS que las instances estén "RUNNABLE":**

```powershell
# Auth DB
gcloud sql databases create auth_db --instance=auth-db
gcloud sql users create auth_user --instance=auth-db --password=auth_password_2026

# Catalog DB
gcloud sql databases create catalog_db --instance=catalog-db
gcloud sql users create catalog_user --instance=catalog-db --password=catalog_password_2026

# Order DB
gcloud sql databases create order_db --instance=order-db
gcloud sql users create order_user --instance=order-db --password=order_password_2026

# Delivery DB
gcloud sql databases create delivery_db --instance=delivery-db
gcloud sql users create delivery_user --instance=delivery-db --password=delivery_password_2026
```

---

### PASO 3: Crear Secrets

```powershell
# JWT Secret
echo delivereats-super-secret-jwt-key-production-2026 | gcloud secrets create jwt-secret --data-file=-

# SMTP User
echo uvictorgomez58@gmail.com | gcloud secrets create smtp-user --data-file=-

# SMTP Password - REEMPLAZA con tu App Password de Gmail
echo XXXX-XXXX-XXXX-XXXX | gcloud secrets create smtp-password --data-file=-

# Database Passwords
echo auth_password_2026 | gcloud secrets create auth-db-password --data-file=-
echo catalog_password_2026 | gcloud secrets create catalog-db-password --data-file=-
echo order_password_2026 | gcloud secrets create order-db-password --data-file=-
echo delivery_password_2026 | gcloud secrets create delivery-db-password --data-file=-
```

---

### PASO 4: Construir y Subir Imágenes

```powershell
# Ir a tu proyecto
cd C:\ruta\a\delivereats-project

# Auth Service
cd auth-service
gcloud builds submit --tag gcr.io/delivereats-prod/auth-service:v1
cd ..

# Catalog Service
cd restaurant-catalog-service
gcloud builds submit --tag gcr.io/delivereats-prod/catalog-service:v1
cd ..

# Order Service
cd order-service
gcloud builds submit --tag gcr.io/delivereats-prod/order-service:v1
cd ..

# Delivery Service
cd delivery-service
gcloud builds submit --tag gcr.io/delivereats-prod/delivery-service:v1
cd ..

# Notification Service
cd notification-service
gcloud builds submit --tag gcr.io/delivereats-prod/notification-service:v1
cd ..

# API Gateway
cd api-gateway
gcloud builds submit --tag gcr.io/delivereats-prod/api-gateway:v1
cd ..

# Frontend
cd frontend
gcloud builds submit --tag gcr.io/delivereats-prod/frontend:v1
cd ..
```

---

### PASO 5: Desplegar en Cloud Run

#### 1. Auth Service

```powershell
gcloud run deploy auth-service `
  --image gcr.io/delivereats-prod/auth-service:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --add-cloudsql-instances delivereats-prod:us-central1:auth-db `
  --set-env-vars NODE_ENV=production `
  --set-env-vars GRPC_PORT=8080 `
  --set-env-vars DB_HOST=/cloudsql/delivereats-prod:us-central1:auth-db `
  --set-env-vars DB_NAME=auth_db `
  --set-env-vars DB_USER=auth_user `
  --set-secrets DB_PASSWORD=auth-db-password:latest `
  --set-secrets JWT_SECRET=jwt-secret:latest
```

#### 2. Catalog Service

```powershell
gcloud run deploy catalog-service `
  --image gcr.io/delivereats-prod/catalog-service:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --add-cloudsql-instances delivereats-prod:us-central1:catalog-db `
  --set-env-vars NODE_ENV=production `
  --set-env-vars GRPC_PORT=8080 `
  --set-env-vars DB_HOST=/cloudsql/delivereats-prod:us-central1:catalog-db `
  --set-env-vars DB_NAME=catalog_db `
  --set-env-vars DB_USER=catalog_user `
  --set-secrets DB_PASSWORD=catalog-db-password:latest
```

#### 3. Order Service

```powershell
# Primero obtener URL de catalog-service
$CATALOG_URL = gcloud run services describe catalog-service --region us-central1 --format 'value(status.url)'

gcloud run deploy order-service `
  --image gcr.io/delivereats-prod/order-service:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --add-cloudsql-instances delivereats-prod:us-central1:order-db `
  --set-env-vars NODE_ENV=production `
  --set-env-vars GRPC_PORT=8080 `
  --set-env-vars DB_HOST=/cloudsql/delivereats-prod:us-central1:order-db `
  --set-env-vars DB_NAME=order_db `
  --set-env-vars DB_USER=order_user `
  --set-env-vars CATALOG_SERVICE_URL=$CATALOG_URL `
  --set-secrets DB_PASSWORD=order-db-password:latest
```

#### 4. Delivery Service

```powershell
gcloud run deploy delivery-service `
  --image gcr.io/delivereats-prod/delivery-service:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --add-cloudsql-instances delivereats-prod:us-central1:delivery-db `
  --set-env-vars NODE_ENV=production `
  --set-env-vars GRPC_PORT=8080 `
  --set-env-vars DB_HOST=/cloudsql/delivereats-prod:us-central1:delivery-db `
  --set-env-vars DB_NAME=delivery_db `
  --set-env-vars DB_USER=delivery_user `
  --set-secrets DB_PASSWORD=delivery-db-password:latest
```

#### 5. Notification Service

```powershell
gcloud run deploy notification-service `
  --image gcr.io/delivereats-prod/notification-service:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars NODE_ENV=production `
  --set-env-vars GRPC_PORT=8080 `
  --set-env-vars SMTP_HOST=smtp.gmail.com `
  --set-env-vars SMTP_PORT=587 `
  --set-secrets SMTP_USER=smtp-user:latest `
  --set-secrets SMTP_PASSWORD=smtp-password:latest
```

#### 6. API Gateway

```powershell
# Obtener URLs de todos los servicios
$AUTH_URL = gcloud run services describe auth-service --region us-central1 --format 'value(status.url)'
$CATALOG_URL = gcloud run services describe catalog-service --region us-central1 --format 'value(status.url)'
$ORDER_URL = gcloud run services describe order-service --region us-central1 --format 'value(status.url)'
$DELIVERY_URL = gcloud run services describe delivery-service --region us-central1 --format 'value(status.url)'
$NOTIFICATION_URL = gcloud run services describe notification-service --region us-central1 --format 'value(status.url)'

gcloud run deploy api-gateway `
  --image gcr.io/delivereats-prod/api-gateway:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars NODE_ENV=production `
  --set-env-vars PORT=8080 `
  --set-env-vars AUTH_SERVICE_URL=$AUTH_URL `
  --set-env-vars CATALOG_SERVICE_URL=$CATALOG_URL `
  --set-env-vars ORDER_SERVICE_URL=$ORDER_URL `
  --set-env-vars DELIVERY_SERVICE_URL=$DELIVERY_URL `
  --set-env-vars NOTIFICATION_SERVICE_URL=$NOTIFICATION_URL `
  --set-secrets JWT_SECRET=jwt-secret:latest
```

#### 7. Frontend

```powershell
$GATEWAY_URL = gcloud run services describe api-gateway --region us-central1 --format 'value(status.url)'

gcloud run deploy frontend `
  --image gcr.io/delivereats-prod/frontend:v1 `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars API_URL=$GATEWAY_URL
```

---

### PASO 6: Obtener URL Final

```powershell
# URL de tu aplicación (compártela con el profesor)
$FRONTEND_URL = gcloud run services describe frontend --region us-central1 --format 'value(status.url)'

Write-Host "🎉 Frontend URL: $FRONTEND_URL"
Write-Host "🌐 API Gateway URL: $GATEWAY_URL"
```

---

## ⏱️ TIEMPO TOTAL ESTIMADO:

- Crear Cloud SQL instances: 20-40 min
- Construir imágenes: 20-30 min
- Desplegar servicios: 10-15 min
- **Total: ~1-1.5 horas**

---

## ✅ VERIFICACIÓN FINAL:

```powershell
# Ver todos los servicios desplegados
gcloud run services list --region us-central1

# Deberías ver 7 servicios con URLs públicas
```

---

¡Listo! Ahora tienes:
- ✅ CRUD de restaurantes
- ✅ Cancelar/rechazar órdenes
- ✅ Deploy completo en GCP
- ✅ URL pública funcionando

¿Algún error o necesitas ayuda con algún paso? 🚀
