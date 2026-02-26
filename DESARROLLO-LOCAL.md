# 🚀 Guía de Desarrollo Local - Delivereats

## 🎯 ¿Cómo Desarrollar sin Reconstruir Docker?

### Estrategia Recomendada

```
✅ LEVANTAR CON DOCKER:
   - Bases de datos (PostgreSQL)
   
🖥️ DESARROLLAR EN LOCAL:
   - auth-service (VSCode + npm run dev)
   - order-service (VSCode + npm run dev)
   - catalog-service (VSCode + npm run dev)
   - api-gateway (VSCode + npm run dev)
   - frontend (VSCode + ng serve)
```

**Ventajas:**
- ✅ Cambios instantáneos (hot reload)
- ✅ No necesitas reconstruir Docker
- ✅ Más rápido para desarrollar
- ✅ Puedes debuggear con VSCode

---

## 📋 Paso a Paso

### 1️⃣ Levantar SOLO las Bases de Datos con Docker

Crea un archivo `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  # ============================================
  # SOLO BASES DE DATOS
  # ============================================
  
  auth-db:
    image: postgres:15-alpine
    container_name: delivereats-auth-db
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: auth_user
      POSTGRES_PASSWORD: auth_password
    ports:
      - "5432:5432"
    volumes:
      - auth-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U auth_user -d auth_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  catalog-db:
    image: postgres:15-alpine
    container_name: delivereats-catalog-db
    environment:
      POSTGRES_DB: catalog_db
      POSTGRES_USER: catalog_user
      POSTGRES_PASSWORD: catalog_password
    ports:
      - "5433:5432"
    volumes:
      - catalog-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U catalog_user -d catalog_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  order-db:
    image: postgres:15-alpine
    container_name: delivereats-order-db
    environment:
      POSTGRES_DB: order_db
      POSTGRES_USER: order_user
      POSTGRES_PASSWORD: order_password
    ports:
      - "5434:5432"
    volumes:
      - order-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U order_user -d order_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  auth-db-data:
  catalog-db-data:
  order-db-data:
```

**Levantar solo las bases de datos:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

---

### 2️⃣ Configurar VSCode

#### Estructura de carpetas en VSCode:
```
📁 delivereats-project/
├── 📁 auth-service/
├── 📁 restaurant-catalog-service/
├── 📁 order-service/
├── 📁 api-gateway/
└── 📁 frontend/
```

#### Abrir en VSCode:
```bash
cd delivereats-project
code .
```

---

### 3️⃣ Instalar Dependencias (UNA SOLA VEZ)

Abre **5 terminales en VSCode** (Ctrl + Shift + `) y ejecuta en cada una:

**Terminal 1 - Auth Service:**
```bash
cd auth-service
npm install
```

**Terminal 2 - Catalog Service:**
```bash
cd restaurant-catalog-service
npm install
```

**Terminal 3 - Order Service:**
```bash
cd order-service
npm install
```

**Terminal 4 - API Gateway:**
```bash
cd api-gateway
npm install
```

**Terminal 5 - Frontend:**
```bash
cd frontend
npm install
```

---

### 4️⃣ Crear archivos .env

**auth-service/.env**
```env
NODE_ENV=development
GRPC_PORT=50052

DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=auth_user
DB_PASSWORD=auth_password

JWT_SECRET=your-super-secret-jwt-key-change-in-production-DeliverEats2026
JWT_EXPIRES_IN=24h
```

**restaurant-catalog-service/.env**
```env
NODE_ENV=development
GRPC_PORT=50051

DB_HOST=localhost
DB_PORT=5433
DB_NAME=catalog_db
DB_USER=catalog_user
DB_PASSWORD=catalog_password
```

**order-service/.env**
```env
NODE_ENV=development
GRPC_PORT=50053

DB_HOST=localhost
DB_PORT=5434
DB_NAME=order_db
DB_USER=order_user
DB_PASSWORD=order_password

CATALOG_SERVICE_URL=localhost:50051
```

**api-gateway/.env**
```env
NODE_ENV=development
PORT=3000

CORS_ORIGIN=http://localhost:4200

AUTH_SERVICE_URL=localhost:50052
ORDER_SERVICE_URL=localhost:50053
CATALOG_SERVICE_URL=localhost:50051

JWT_SECRET=your-super-secret-jwt-key-change-in-production-DeliverEats2026
```

---

### 5️⃣ Levantar los Servicios en Modo Desarrollo

**IMPORTANTE:** Ejecuta en orden (uno por uno):

**Terminal 1 - Auth Service:**
```bash
cd auth-service
npm run dev
```
Espera a ver: `🚀 Auth Service (gRPC) escuchando en puerto 50052`

**Terminal 2 - Catalog Service:**
```bash
cd restaurant-catalog-service
npm run dev
```
Espera a ver: `🚀 Restaurant Catalog Service (gRPC) escuchando en puerto 50051`

**Terminal 3 - Order Service:**
```bash
cd order-service
npm run dev
```
Espera a ver: `🚀 Order Service (gRPC) escuchando en puerto 50053`

**Terminal 4 - API Gateway:**
```bash
cd api-gateway
npm run dev
```
Espera a ver: `🚀 API Gateway escuchando en puerto 3000`

**Terminal 5 - Frontend:**
```bash
cd frontend
npm start
# O también:
ng serve
```
Espera a ver: `✔ Browser application bundle generation complete.`

---

### 6️⃣ Insertar Productos de Prueba

En una nueva terminal:
```bash
docker exec -it delivereats-catalog-db psql -U catalog_user -d catalog_db
```

Pega esto:
```sql
DELETE FROM products;

INSERT INTO products (id, restaurant_id, name, description, price, category, is_available, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Pizza Margarita', 'Pizza clásica', 12.99, 'Pizzas', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'Hamburguesa Clásica', 'Con queso', 8.50, 'Hamburguesas', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Refresco', 'Coca-Cola 500ml', 2.00, 'Bebidas', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999', 'Ensalada César', 'Con pollo', 7.50, 'Ensaladas', false, NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'Pasta Carbonara', 'Pasta italiana', 11.50, 'Pastas', true, NOW(), NOW());

\q
```

---

### 7️⃣ Probar el Frontend

Abre el navegador en: **http://localhost:4200**

Deberías ver la página de **Login**.

---

## 🔄 Workflow de Desarrollo

### Hacer cambios en el código:

1. **Editas un archivo** en VSCode (ejemplo: `auth-service/src/server.ts`)
2. **Guardas** (Ctrl + S)
3. **Nodemon detecta el cambio** y reinicia automáticamente
4. **Los cambios se aplican** sin hacer nada más

**Logs en la terminal:**
```
[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/server.ts`
🚀 Auth Service (gRPC) escuchando en puerto 50052
```

### Para el Frontend (Angular):

1. **Editas un componente** (ejemplo: `login.component.ts`)
2. **Guardas**
3. **El navegador se recarga automáticamente**

---

## 🛠️ Comandos Útiles

### Ver logs de las bases de datos:
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Conectarse a una base de datos:
```bash
# Auth DB
docker exec -it delivereats-auth-db psql -U auth_user -d auth_db

# Catalog DB
docker exec -it delivereats-catalog-db psql -U catalog_user -d catalog_db

# Order DB
docker exec -it delivereats-order-db psql -U order_user -d order_db
```

### Reiniciar un servicio:
Solo presiona `Ctrl + C` en la terminal y vuelve a ejecutar `npm run dev`

### Detener las bases de datos:
```bash
docker-compose -f docker-compose.dev.yml down
```

### Eliminar datos y empezar de cero:
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

---

## 🐛 Debugging en VSCode

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Auth Service",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/auth-service",
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Order Service",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/order-service",
      "console": "integratedTerminal"
    }
  ]
}
```

Ahora puedes poner **breakpoints** y debuggear.

---

## 📊 Verificar que Todo Funciona

### Check 1: API Gateway
```bash
curl http://localhost:3000/health
```
Respuesta: `{"status":"OK",...}`

### Check 2: Registrar usuario
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "CLIENT"
  }'
```

### Check 3: Frontend
Ve a http://localhost:4200 → Deberías ver el login

---

## 🎨 Flujo Completo de Prueba

1. **Abre** http://localhost:4200
2. **Click** en "Regístrate aquí"
3. **Llena** el formulario de registro
4. **Submit** → Te redirige al login
5. **Haz login** con las credenciales
6. **Te redirige** a crear orden
7. **Agrega productos** y crea la orden
8. **Ve los logs** en las terminales para ver la validación gRPC

---

## 🚫 Errores Comunes

### Error: "Cannot find module"
```bash
cd [servicio]
npm install
```

### Error: "Port already in use"
```bash
# Ver qué está usando el puerto
lsof -i :50052
# Matar el proceso
kill -9 <PID>
```

### Error: "Cannot connect to database"
```bash
# Verificar que las bases de datos estén corriendo
docker-compose -f docker-compose.dev.yml ps

# Reiniciar si es necesario
docker-compose -f docker-compose.dev.yml restart
```

### Frontend no carga
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

---

## 🎓 Ventajas de Este Método

| Aspecto | Con Docker | Sin Docker (Dev Local) |
|---------|-----------|------------------------|
| **Tiempo de inicio** | ~30 seg | ~5 seg |
| **Hot reload** | ❌ No | ✅ Sí (instantáneo) |
| **Debugging** | ⚠️ Difícil | ✅ Fácil (VSCode) |
| **Cambios de código** | Rebuild imagen | Reinicio automático |
| **Logs** | `docker logs` | Directo en terminal |
| **CPU/RAM** | Más uso | Menos uso |

---

## 📦 Cuando Termines de Desarrollar

### Para hacer el build final:
```bash
# Detener todo
# Presiona Ctrl + C en todas las terminales

# Levantar con Docker completo
docker-compose down -v
docker-compose up -d --build

# Ahora todo corre en Docker para producción
```

---

## ✅ Checklist de Desarrollo

- [ ] ✅ Bases de datos corriendo con Docker
- [ ] ✅ Auth Service corriendo (puerto 50052)
- [ ] ✅ Catalog Service corriendo (puerto 50051)
- [ ] ✅ Order Service corriendo (puerto 50053)
- [ ] ✅ API Gateway corriendo (puerto 3000)
- [ ] ✅ Frontend corriendo (puerto 4200)
- [ ] ✅ Productos insertados en catalog_db
- [ ] ✅ Puedo registrarme desde el navegador
- [ ] ✅ Puedo hacer login desde el navegador
- [ ] ✅ Puedo crear órdenes desde el navegador
- [ ] ✅ Veo logs de validación gRPC en las terminales

---

¡Listo para desarrollar! 🎉
