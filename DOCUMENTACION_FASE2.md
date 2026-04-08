# DeliverEats — Fase 2: Arquitectura Avanzada, Kubernetes y CI/CD

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Fase 2 — v2.0.0**
**Carnet: 201114493**

---
---
## Prueba CI/CD

## Tabla de Contenidos

1. [Resumen de la Fase 2](#1-resumen-de-la-fase-2)
2. [Arquitectura General](#2-arquitectura-general)
3. [Cola de Mensajeria con RabbitMQ](#3-cola-de-mensajeria-con-rabbitmq)
4. [FX-Service — Conversion de Moneda con Redis](#4-fx-service--conversion-de-moneda-con-redis)
5. [Payment-Service — Pagos y Cupones](#5-payment-service--pagos-y-cupones)
6. [Sistema de Calificaciones](#6-sistema-de-calificaciones)
7. [Evidencia de Entrega (Delivery Photo)](#7-evidencia-de-entrega-delivery-photo)
8. [Kubernetes — Despliegue Completo](#8-kubernetes--despliegue-completo)
9. [CI/CD con GitHub Actions y Google Cloud Platform](#9-cicd-con-github-actions-y-google-cloud-platform)
   - [9.1 Configurar GCP paso a paso](#91-configurar-gcp-paso-a-paso)
   - [9.2 Configurar GitHub Secrets](#92-configurar-github-secrets)
   - [9.3 Pipeline GitHub Actions](#93-pipeline-github-actions)
   - [9.4 Como funciona el pipeline](#94-como-funciona-el-pipeline)
10. [Pruebas Unitarias](#10-pruebas-unitarias)
11. [Rubrica y Criterios de Evaluacion](#11-rubrica-y-criterios-de-evaluacion)

---

## 1. Resumen de la Fase 2

La Fase 1 entrego un MVP funcional con comunicacion sincrona gRPC directa entre
microservicios. El problema identificado fue:

- **Downtime durante despliegues**: al actualizar un servicio, el sistema dejaba de
  responder hasta que el nuevo contenedor levantaba.
- **Sin rollback rapido**: si una nueva version tenia errores, revertir era manual y lento.
- **Acoplamiento fuerte**: si el restaurant-catalog-service fallaba, el order-service
  no podia crear pedidos aunque quisiera.

La Fase 2 resuelve estos tres problemas:

| Problema | Solucion implementada |
|---|---|
| Downtime en despliegues | Kubernetes con rolling updates (replicas) |
| Sin rollback | CI/CD con tags de version por commit SHA |
| Acoplamiento fuerte | RabbitMQ: order-service publica, catalog-service consume |

### Funcionalidades nuevas en Fase 2

| Funcionalidad | Descripcion |
|---|---|
| RabbitMQ | Cola asincrona entre Order-Service y Restaurant-Catalog-Service |
| FX-Service + Redis | Conversion de precios en tiempo real con cache 12h |
| Payment-Service | Pagos con tarjeta, cartera digital recargable, cupones |
| Sistema de Calificaciones | Calificacion de repartidor, restaurante y producto |
| Evidencia de entrega | El repartidor sube foto obligatoria al marcar ENTREGADO |
| Kubernetes | Despliegue completo con Deployments, Services, Ingress, ConfigMaps, Secrets |
| CI/CD | Pipeline GitHub Actions: build → test → push a GCP → deploy a GKE |

---

## 2. Arquitectura General

```
                           INTERNET
                              |
                    [ Ingress Controller ]
                    (nginx, puerto 80/443)
                         /         \
                        /           \
              [frontend:80]    [api-gateway:3000]
                (Angular)       (REST → gRPC)
                                     |
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
    [auth-service:50052]  [catalog-service:50051]  [order-service:50053]
         |                       |                       |
    [auth-db:5432]        [catalog-db:5433]         [order-db:5434]
                                                        |
                                               [ RabbitMQ:5672 ]
                                                        |
                                           [restaurant-catalog-service]
                                                (consume queue)
              │                      │                       │
    [delivery-service:50054] [fx-service:50056]   [payment-service:50057]
         |                       |                       |
    [delivery-db:5435]      [Redis:6379]          [payment-db:5436]
              │
    [notification-service:50055]
```

### Namespace Kubernetes

Todos los recursos viven en el namespace `delivereats`:

```bash
kubectl get all -n delivereats
```

---

## 3. Cola de Mensajeria con RabbitMQ

### Problema que resuelve

Antes de RabbitMQ, cuando un cliente creaba un pedido, el order-service llamaba
directamente (gRPC sincrono) al restaurant-catalog-service para notificar al
restaurante. Si el catalog-service estaba saturado o caido, la creacion del pedido
fallaba aunque el pedido en si fuera valido.

### Solucion: Patron Publisher/Consumer

```
Cliente → POST /orders → api-gateway → order-service
                                           |
                                    Guarda orden en BD
                                           |
                                   Publica en RabbitMQ
                                   (queue: order_created)
                                           |
                                    [RabbitMQ broker]
                                           |
                              restaurant-catalog-service
                              (consume a su propio ritmo)
                                           |
                               Guarda notificacion en BD
                               Disponible en inbox frontend
```

### Queue configurada

| Parametro | Valor |
|---|---|
| Queue name | `order_created` |
| Exchange | default (direct) |
| Durabilidad | durable: true (sobrevive reinicios) |
| Auto-delete | false |
| Broker URL | `amqp://delivereats:delivereats_pass@rabbitmq:5672` |

### Mensaje publicado por order-service

```json
{
  "orderId": "uuid",
  "restaurantId": "uuid",
  "clientId": "uuid",
  "items": [
    { "productId": "uuid", "name": "Pizza", "quantity": 2, "price": 45.00 }
  ],
  "totalAmount": 90.00,
  "deliveryAddress": "Zona 10, Guatemala",
  "status": "PENDING",
  "createdAt": "2026-03-16T10:00:00Z"
}
```

### Inbox del restaurante (frontend)

El panel del restaurante tiene una pestana "Pedidos" que lista los pedidos
recibidos a traves de la cola. El restaurante puede:
- Ver pedidos nuevos (PENDING)
- Aceptar (→ CONFIRMED)
- Rechazar (→ CANCELLED)
- Marcar como preparando (→ PREPARING)
- Marcar como listo (→ READY)

### RabbitMQ en Kubernetes

```bash
# Ver el management UI (puerto-forward)
kubectl port-forward -n delivereats svc/rabbitmq 15672:15672

# Abrir: http://localhost:15672
# Usuario: delivereats  |  Password: delivereats_pass
```

---

## 4. FX-Service — Conversion de Moneda con Redis

### Flujo de conversion

```
Frontend pide precio en USD
         |
api-gateway → fx-service:50056
         |
    ¿Esta en Redis?
    /           \
  SI             NO
  |               |
Retorna         Llama a open.er-api.com
cache           |
                Guarda en Redis (TTL: 12h)
                |
              Retorna tasa
```

### API externa utilizada

```
https://open.er-api.com/v6/latest/GTQ
```

Retorna las tasas de cambio con base en Quetzal (GTQ). Si la API falla,
se usa el valor almacenado en Redis como fallback.

### Cache Redis

| Parametro | Valor |
|---|---|
| TTL | 43200 segundos (12 horas) |
| Key | `fx:rates` |
| Backend | Redis 7 alpine |

### Monedas soportadas

USD, EUR, MXN, JPY, GBP, CAD y cualquier moneda disponible en la API.

### Uso desde el frontend

El cliente puede seleccionar la moneda en el catalogo de restaurantes.
Los precios se muestran convertidos en tiempo real.

---

## 5. Payment-Service — Pagos y Cupones

### Metodos de pago

#### 1. Tarjeta de Credito/Debito (simulado)

El sistema simula el procesamiento de pagos. En produccion se integraria
con Stripe o similar.

```json
POST /payment/process
{
  "orderId": "uuid",
  "method": "CARD",
  "cardNumber": "4111111111111111",
  "cardHolder": "Juan Perez",
  "expiryDate": "12/26",
  "cvv": "123"
}
```

#### 2. Cartera Digital

Cada usuario tiene una cartera con saldo recargable.

```json
POST /payment/wallet/recharge
{ "amount": 100.00, "currency": "GTQ" }

POST /payment/process
{ "orderId": "uuid", "method": "WALLET" }
```

### Sistema de Cupones

#### Tipos de cupon

| Tipo | Descripcion | Ejemplo |
|---|---|---|
| PERCENTAGE | Descuento porcentual | 20% de descuento |
| FIXED | Descuento fijo en GTQ | Q15 de descuento |
| FREE_DELIVERY | Envio gratis | - |

#### Flujo de un cupon

```
Restaurante solicita crear cupon
         |
Admin revisa y aprueba (panel admin)
         |
Cliente ingresa codigo al crear pedido
         |
Payment-service valida: activo + no expirado + usos disponibles
         |
Aplica descuento al total del pedido
```

#### Reembolso

Cuando se cancela un pedido pagado, el admin puede emitir reembolso:

```
POST /admin/orders/:orderId/refund
→ PaymentStatus cambia a REFUNDED
→ Si fue con WALLET, el saldo se devuelve
```

---

## 6. Sistema de Calificaciones

Disponible solo despues de que un pedido llega a estado DELIVERED.

### Entidades calificables

| Entidad | Escala | Campos |
|---|---|---|
| Repartidor | 1-5 estrellas | stars, comment |
| Restaurante | 1-5 estrellas | stars, comment |
| Producto | Recomendado/No | recommended (boolean) |

### Endpoint

```
POST /ratings
{
  "orderId": "uuid",
  "type": "DELIVERY_PERSON" | "RESTAURANT" | "PRODUCT",
  "targetId": "uuid",
  "stars": 4,
  "comment": "Muy rapido",
  "recommended": true
}
```

### Resumen por restaurante

```
GET /catalog/restaurants/:id
→ Incluye:
  {
    "averageRating": 4.3,
    "totalRatings": 127,
    "recommendationRate": 0.89
  }
```

### Filtros en el catalogo

Los restaurantes pueden ordenarse por:
- `rating` — promedio de calificaciones
- `featured` — restaurantes destacados primero
- `name` — orden alfabetico
- `newest` — mas recientes

---

## 7. Evidencia de Entrega (Delivery Photo)

Al marcar un pedido como ENTREGADO, el repartidor debe subir
obligatoriamente una fotografia como prueba.

### Flujo

```
Repartidor hace clic en "Marcar como Entregado"
         |
Se abre modal con campo de archivo (imagen)
         |
Valida: archivo requerido, tipo imagen
         |
PUT /delivery/:id/status
{ "status": "DELIVERED", "photoBase64": "data:image/jpeg;base64,..." }
         |
delivery-service guarda la foto en BD
         |
Admin puede ver la foto en el panel de pedidos
```

### Reglas

- La foto es OBLIGATORIA para marcar como ENTREGADO
- Formatos aceptados: JPG, PNG
- La foto queda asociada al registro de entrega
- Solo el admin puede visualizar las fotos

---

## 8. Kubernetes — Despliegue Completo

### Estructura del directorio k8s/

```
k8s/
├── namespace/
│   └── namespace.yaml              # Namespace "delivereats"
├── api-gateway/
│   └── api-gateway.yaml            # ConfigMap + Deployment + Service + Ingress
├── auth-service/
│   ├── auth-secret.yaml            # Secrets: DB credentials + JWT secret
│   ├── auth-db-statefulset.yaml    # PostgreSQL StatefulSet + Service
│   └── auth-service-deployment.yaml # Deployment + Service
├── catalog-service/
│   └── catalog-service.yaml        # Secret + DB StatefulSet + Service + Deployment
├── order-service/
│   └── order-service.yaml          # Secret + DB StatefulSet + Service + Deployment
├── delivery-service/
│   └── delivery-service.yaml       # Secret + DB StatefulSet + Service + Deployment
├── fx-service/
│   └── fx-service.yaml             # ConfigMap + Deployment + Service
├── payment-service/
│   └── payment-service.yaml        # Secret + DB StatefulSet + Service + Deployment
├── notification-service/
│   └── notification-service.yaml   # Secret + ConfigMap + Deployment + Service
├── frontend/
│   └── frontend.yaml               # Deployment + Service + Ingress
├── rabbitmq/
│   └── rabbitmq.yaml               # Deployment + Service
└── redis/
    ├── redis-statefulset.yaml       # StatefulSet + Service
    └── redis-service.yaml
```

### Recursos por servicio

| Servicio | Deployment | Service | ConfigMap | Secret | StatefulSet |
|---|---|---|---|---|---|
| api-gateway | SI | SI | SI | - | - |
| auth-service | SI | SI | - | SI (DB+JWT) | SI (Postgres) |
| catalog-service | SI | SI | - | SI (DB) | SI (Postgres) |
| order-service | SI | SI | - | SI (DB) | SI (Postgres) |
| delivery-service | SI | SI | - | SI (DB) | SI (Postgres) |
| fx-service | SI | SI | SI | - | - |
| payment-service | SI | SI | - | SI (DB) | SI (Postgres) |
| notification-service | SI | SI | SI | SI (SMTP) | - |
| frontend | SI | SI | - | - | - |
| rabbitmq | SI | SI | - | - | - |
| redis | - | SI | - | - | SI |

### Ingress

Hay dos recursos Ingress en el cluster:

1. **frontend-ingress** (`delivereats.local /`) → frontend-service:80
2. **api-gateway-ingress** (`api.delivereats.local /`) → api-gateway:3000

La IP publica del Ingress Controller en GKE es: `34.44.246.195`

Para acceder desde una maquina local, agregar al archivo hosts:
```
34.44.246.195 delivereats.local
34.44.246.195 api.delivereats.local
```

### Despliegue en GKE (produccion — automatico via CI/CD)

El despliegue a GKE se realiza automaticamente al hacer push a `main`.
El pipeline de GitHub Actions ejecuta:

```bash
# 1. Autentica con GCP via Workload Identity Federation
# 2. Obtiene credenciales del cluster
gcloud container clusters get-credentials delivereats-cluster --region us-central1

# 3. Reemplaza las imagenes locales por las del Artifact Registry
# delivereats/<service>:latest → us-central1-docker.pkg.dev/<project>/delivereats/<service>:<sha>

# 4. Aplica todos los manifests
kubectl apply -f k8s/namespace/
kubectl apply -f k8s/rabbitmq/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/auth-service/
kubectl apply -f k8s/catalog-service/
kubectl apply -f k8s/order-service/
kubectl apply -f k8s/delivery-service/
kubectl apply -f k8s/fx-service/
kubectl apply -f k8s/payment-service/
kubectl apply -f k8s/notification-service/
kubectl apply -f k8s/api-gateway/
kubectl apply -f k8s/frontend/

# 5. Reinicia deployments y statefulsets para aplicar nuevas imagenes
kubectl rollout restart deployment -n delivereats
kubectl rollout restart statefulset -n delivereats
```

### Cluster GKE activo

| Parametro | Valor |
|---|---|
| Proyecto | `delivereats-201114493` |
| Cluster | `delivereats-cluster` |
| Region | `us-central1` |
| Namespace | `delivereats` |
| IP publica Ingress | `34.44.246.195` |
| Frontend URL | `http://delivereats.local` |
| API URL | `http://api.delivereats.local` |

### Estado del cluster (todos los pods Running)

```
kubectl get pods -n delivereats

api-gateway          1/1 Running
auth-db-0            1/1 Running
auth-service         1/1 Running
catalog-db-0         1/1 Running
catalog-service      1/1 Running
delivery-db-0        1/1 Running
delivery-service     1/1 Running
frontend             1/1 Running
fx-service           1/1 Running
notification-service 1/1 Running
order-db-0           1/1 Running
order-service        1/1 Running
payment-db-0         1/1 Running
payment-service      1/1 Running
rabbitmq             1/1 Running
redis-0              1/1 Running
```

### Comandos utiles

```bash
# Ver todos los pods
kubectl get pods -n delivereats

# Ver logs de un servicio
kubectl logs -n delivereats deployment/api-gateway -f

# Ver estado de un pod especifico
kubectl describe pod -n delivereats <pod-name>

# Reiniciar un deployment
kubectl rollout restart deployment/<name> -n delivereats

# Ver todos los secrets
kubectl get secrets -n delivereats

# Ver ConfigMaps
kubectl get configmaps -n delivereats
```

---

## 9. CI/CD con GitHub Actions y Google Cloud Platform

### Por que GitHub Actions + GCP?

| Herramienta | Razon |
|---|---|
| GitHub Actions | Integrado con el repositorio, gratuito para repos publicos |
| Google Artifact Registry | Registry privado de Docker dentro de GCP, 0.5GB gratuito |
| Google Kubernetes Engine (GKE) | Kubernetes gestionado, sin necesidad de configurar el cluster manualmente |

### 9.1 Configurar GCP paso a paso

#### Paso 1: Crear cuenta en Google Cloud

1. Ir a https://cloud.google.com
2. Hacer clic en "Empezar gratis"
3. Ingresar con una cuenta de Google
4. Ingresar datos de tarjeta de credito (solo para verificacion, no se cobra)
5. Recibiras $300 USD de credito gratuito por 90 dias

#### Paso 2: Crear un proyecto

1. En la consola de GCP, hacer clic en el selector de proyectos (arriba a la izquierda)
2. Hacer clic en "Nuevo proyecto"
3. Nombre del proyecto: `delivereats-201114493`
4. Hacer clic en "Crear"
5. Seleccionar el proyecto recien creado

#### Paso 3: Habilitar las APIs necesarias

Ir a "APIs y servicios" → "Habilitar APIs y servicios" y habilitar:

- **Kubernetes Engine API** (para GKE)
- **Artifact Registry API** (para el registry de Docker)
- **Cloud Build API** (para builds)

O desde la terminal con gcloud:
```bash
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### Paso 4: Crear el repositorio en Artifact Registry

1. Ir a "Artifact Registry" en el menu lateral
2. Hacer clic en "Crear repositorio"
3. Configurar:
   - Nombre: `delivereats`
   - Formato: `Docker`
   - Modo: `Standard`
   - Region: `us-central1`
4. Hacer clic en "Crear"

La URL del registry quedara:
```
us-central1-docker.pkg.dev/delivereats-201114493/delivereats
```

#### Paso 5: Crear el cluster de Kubernetes en GKE

1. Ir a "Kubernetes Engine" → "Clusters"
2. Hacer clic en "Crear"
3. Seleccionar "Autopilot" (mas sencillo, GCP gestiona los nodos)
4. Configurar:
   - Nombre: `delivereats-cluster`
   - Region: `us-central1`
5. Hacer clic en "Crear"
6. Esperar ~5 minutos a que el cluster este listo

> **Nota de costo**: GKE Autopilot cobra por los recursos que usan los Pods.
> Con los recursos minimos del proyecto (~256Mi por servicio), el costo
> estimado es de $30-50/mes. Usar los creditos de $300 gratuitos.

#### Paso 6: Crear Service Account para GitHub Actions

GitHub Actions necesita credenciales para autenticarse en GCP.

1. Ir a "IAM y administracion" → "Cuentas de servicio"
2. Hacer clic en "Crear cuenta de servicio"
3. Nombre: `github-actions-sa`
4. Descripcion: `Service account para CI/CD pipeline`
5. Hacer clic en "Crear y continuar"
6. Agregar estos roles:
   - `Artifact Registry Writer` (para subir imagenes Docker)
   - `Kubernetes Engine Developer` (para hacer deploy al cluster)
7. Hacer clic en "Listo"

Luego, crear la clave JSON:
1. Hacer clic en la cuenta de servicio recien creada
2. Ir a pestana "Claves"
3. Hacer clic en "Agregar clave" → "Crear clave nueva"
4. Formato: JSON
5. Hacer clic en "Crear"
6. Se descarga automaticamente el archivo `.json` — **GUARDAR BIEN ESTE ARCHIVO**

#### Paso 7: Obtener credenciales del cluster

Despues de crear el cluster, obtener su nombre exacto:

1. Ir a "Kubernetes Engine" → "Clusters"
2. Copiar el nombre del cluster: `delivereats-cluster`
3. Copiar la ubicacion (Location): `us-central1`

---

### 9.2 Configurar GitHub Secrets

Los secretos se configuran en GitHub y el pipeline los usa sin exponerlos en el codigo.

1. Ir al repositorio en GitHub
2. Hacer clic en "Settings" (pestana superior)
3. En el menu lateral, hacer clic en "Secrets and variables" → "Actions"
4. Hacer clic en "New repository secret" para cada uno:

| Secret name | Valor | Como obtenerlo |
|---|---|---|
| `GCP_PROJECT_ID` | `delivereats-201114493` | ID del proyecto GCP |
| `GCP_SA_KEY` | Contenido del archivo .json | Abrir el JSON descargado y copiar TODO el contenido |
| `GCP_CLUSTER_NAME` | `delivereats-cluster` | Nombre del cluster en GKE |
| `GCP_CLUSTER_ZONE` | `us-central1` | Region del cluster |
| `GCP_REGION` | `us-central1` | Region del Artifact Registry |

> **Importante**: El valor de `GCP_SA_KEY` es todo el contenido del archivo JSON
> descargado en el Paso 6. Copiar el JSON completo incluyendo las llaves `{}`.

---

### 9.3 Pipeline GitHub Actions

El archivo esta en `.github/workflows/ci-cd.yml`.

### 9.4 Como funciona el pipeline

El pipeline se activa en dos situaciones:
- **Push a `main`**: ejecuta todo (build + test + push + deploy)
- **Push a cualquier rama**: solo ejecuta build + test (sin push ni deploy)

#### Etapa 1: Build

```
Por cada servicio (api-gateway, auth-service, catalog-service, ...):
  docker build -t <registry>/<service>:<sha> .
  docker build -t <registry>/<service>:latest .
```

Los tags de imagen siguen el convenio:
```
us-central1-docker.pkg.dev/delivereats-201114493/delivereats/api-gateway:abc1234
us-central1-docker.pkg.dev/delivereats-201114493/delivereats/api-gateway:latest
```

Donde `abc1234` es los primeros 7 caracteres del commit SHA. Esto permite
identificar exactamente que version esta corriendo en el cluster.

#### Etapa 2: Test

```
cd restaurant-catalog-service → npm test
cd order-service              → npm test
cd auth-service               → npm test
```

Si cualquier test falla, el pipeline se detiene y no continua al push ni deploy.

#### Etapa 3: Push a Artifact Registry

Solo en la rama `main`:
```
Autenticacion con Service Account JSON (GCP_SA_KEY)
Configurar Docker para usar el registry de GCP
Push de todas las imagenes con tag :sha y :latest
```

#### Etapa 4: Deploy a GKE

Solo en la rama `main`:
```
Obtener credenciales del cluster GKE
Reemplazar "delivereats/" → URL del Artifact Registry en los manifests
kubectl apply -f k8s/ --recursive
Mostrar en logs: que cluster, que namespace, resultado del apply
```

#### Ver los logs del pipeline

1. Ir al repositorio en GitHub
2. Hacer clic en "Actions" (pestana superior)
3. Seleccionar el ultimo workflow run
4. Hacer clic en cada job para ver los logs detallados

---

## 10. Pruebas Unitarias

### Servicios con tests

| Servicio | Archivo | Tests | Descripcion |
|---|---|---|---|
| restaurant-catalog-service | `__tests__/discount.test.ts` | 22 | Logica de cupones y promociones |
| restaurant-catalog-service | `__tests__/rating.test.ts` | 25 | Logica de calificaciones |
| auth-service | `__tests__/login.test.ts` | 16 | Caso de uso LoginUser |
| order-service | `__tests__/createOrder.test.ts` | 20 | Caso de uso CreateOrder |

**Total: 83 tests**

### Ejecutar los tests

```bash
# restaurant-catalog-service
cd restaurant-catalog-service
npm test

# order-service
cd order-service
npm test

# auth-service
cd auth-service
npm test
```

### Detalle de los tests

#### discount.test.ts (22 tests)

- Cupon PERCENTAGE: calculo correcto, minimo de orden, maximo de descuento
- Cupon FIXED: descuento fijo, no negativo
- Cupon validacion: expirado, inactivo, usos agotados
- Promocion PERCENTAGE: aplica a productos seleccionados
- Promocion FIXED: descuento fijo por restaurante
- Promocion FREE_DELIVERY: costo de envio = 0

#### rating.test.ts (25 tests)

- Rating entidad: validacion 1-5 estrellas, comentario opcional
- calcAvgRating: promedio correcto, sin calificaciones = 0
- sortByFeatured: restaurantes destacados primero
- sortByBestRated: orden descendente por promedio
- calcRecommendationRate: porcentaje de productos recomendados

#### login.test.ts (16 tests)

- Login exitoso: retorna JWT con claims correctos
- Usuario no encontrado: error 404
- Password incorrecta: error 401
- DTO vacio: error de validacion
- Login como RESTAURANT: JWT incluye restaurantId

#### createOrder.test.ts (20 tests)

- Orden creada: guarda en BD, publica en RabbitMQ
- Calculo de total: suma correcta de items
- Fallo gRPC catalog: error controlado
- DTO invalido: error de validacion
- Order entity: estados validos, transiciones permitidas

### Cobertura

La cobertura de las clases de dominio (entidades y casos de uso) es superior al 70%,
cumpliendo el requisito minimo de la fase 2.

---

## 11. Rubrica y Criterios de Evaluacion

| Criterio | Implementacion | Ubicacion |
|---|---|---|
| RabbitMQ/Kafka para colas | RabbitMQ: order-service publica, catalog-service consume | `order-service/src/`, `restaurant-catalog-service/src/` |
| Redis para cache | FX-Service usa Redis con TTL 12h | `fx-service/src/` |
| API externa de tipo de cambio | open.er-api.com/v6/latest/GTQ | `fx-service/src/` |
| Payment simulado | Tarjeta + Cartera digital | `payment-service/src/` |
| Cupones con validacion | PERCENTAGE, FIXED, FREE_DELIVERY | `restaurant-catalog-service/src/` |
| Sistema de calificaciones | Repartidor, restaurante, producto | `restaurant-catalog-service/src/` |
| Evidencia de entrega | Foto obligatoria al marcar DELIVERED | `delivery-service/src/` |
| Kubernetes Deployments | Uno por cada microservicio | `k8s/*/` |
| Kubernetes Services | Uno por cada Deployment | `k8s/*/` |
| Kubernetes Ingress | frontend + api-gateway | `k8s/frontend/`, `k8s/api-gateway/` |
| Kubernetes ConfigMaps | api-gateway, fx-service, notification-service | `k8s/*/` |
| Kubernetes Secrets | auth, catalog, order, delivery, payment, notification | `k8s/*/` |
| CI/CD Build | GitHub Actions construye imagenes Docker | `.github/workflows/ci-cd.yml` |
| CI/CD Test | Ejecuta Jest, detiene si falla | `.github/workflows/ci-cd.yml` |
| CI/CD Publicacion | Push a Google Artifact Registry con tag SHA | `.github/workflows/ci-cd.yml` |
| CI/CD Deploy a K8s | `kubectl apply -f k8s/` a GKE | `.github/workflows/ci-cd.yml` |
| Unit Tests >= 70% | 83 tests en 4 servicios | `*/__ tests__/` |
| Docker Compose | Ambiente completo local | `docker-compose.yml` |
