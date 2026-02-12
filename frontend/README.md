# 🎨 Frontend - Delivereats

## Aplicación Angular para Delivereats

### Estructura del Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/              # Servicios centrales
│   │   │   └── services/
│   │   │       └── auth.service.ts
│   │   ├── features/          # Módulos por funcionalidad
│   │   │   └── auth/
│   │   │       └── components/
│   │   │           ├── login.component.ts
│   │   │           └── login.component.html
│   │   ├── app.component.ts
│   │   └── app.module.ts
│   ├── environments/
│   ├── index.html
│   └── styles.css
├── Dockerfile
├── nginx.conf
└── package.json
```

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm start
# Navegar a http://localhost:4200
```

### Construcción

```bash
# Construir para producción
npm run build
# Los archivos compilados estarán en dist/
```

### Con Docker

```bash
# Construir imagen
docker build -t delivereats-frontend .

# Ejecutar contenedor
docker run -p 4200:80 delivereats-frontend
```

### Conectar con API Gateway

El frontend se comunica SOLO con el API Gateway a través de REST.

```typescript
// src/app/core/services/auth.service.ts
const apiUrl = 'http://localhost:3000';  // API Gateway

// Login
this.http.post(`${apiUrl}/auth/login`, credentials)

// Crear orden
this.http.post(`${apiUrl}/orders`, orderData, {
  headers: { Authorization: `Bearer ${token}` }
})
```

### Flujo de Comunicación

```
Frontend (Angular)
    │
    │ HTTP REST
    │ (JSON)
    │
    ▼
API Gateway
    │
    │ gRPC
    │ (binario)
    │
    ▼
Microservicios
```

**Importante**: El frontend NO habla directamente con los microservicios.
