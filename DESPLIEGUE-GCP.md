# ☁️ Guía de Despliegue en Google Cloud Platform (GCP)

## 📋 Prerequisitos

1. **Cuenta de GCP** con billing activado
2. **gcloud CLI** instalado
3. **Proyecto probado localmente** ✅

---

## 🎯 Opciones de Despliegue

### Opción 1: Cloud Run (RECOMENDADO - Más Fácil) ⭐
- ✅ Serverless (sin servidores que administrar)
- ✅ Auto-scaling
- ✅ Solo pagas por uso
- ✅ Fácil de configurar
- ❌ Limitación: HTTP/2 para gRPC puede tener latencia

### Opción 2: Google Kubernetes Engine (GKE)
- ✅ Control total
- ✅ Mejor rendimiento para gRPC
- ✅ Producción enterprise
- ❌ Más complejo
- ❌ Más costoso

### Opción 3: Compute Engine (VMs)
- ✅ Control total
- ✅ Más barato que GKE
- ❌ Debes administrar VMs
- ❌ No auto-scaling automático

---

## 🚀 OPCIÓN 1: DESPLIEGUE CON CLOUD RUN (Recomendado)

### PASO 1: Instalar y Configurar gcloud CLI

```bash
# Instalar gcloud
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Windows
# Descargar de: https://cloud.google.com/sdk/docs/install

# Inicializar
gcloud init

# Selecciona tu proyecto o crea uno nuevo
# Project ID sugerido: delivereats-prod
```

### PASO 2: Habilitar APIs Necesarias

```bash
# Habilitar Cloud Run
gcloud services enable run.googleapis.com

# Habilitar Container Registry
gcloud services enable containerregistry.googleapis.com

# Habilitar Cloud SQL
gcloud services enable sqladmin.googleapis.com

# Habilitar Secret Manager (para credenciales)
gcloud services enable secretmanager.googleapis.com
```

### PASO 3: Configurar Variables

```bash
export PROJECT_ID=delivereats-prod
export REGION=us-central1

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
```

### PASO 4: Crear Cloud SQL Instances (PostgreSQL)

```bash
# Base de datos para Auth
gcloud sql instances create auth-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION

# Base de datos para Catalog
gcloud sql instances create catalog-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION

# Base de datos para Order
gcloud sql instances create order-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION

# Base de datos para Delivery
gcloud sql instances create delivery-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION
```

**Crear bases de datos:**
```bash
# Auth DB
gcloud sql databases create auth_db --instance=auth-db
gcloud sql users create auth_user --instance=auth-db --password=AUTH_PASSWORD

# Catalog DB
gcloud sql databases create catalog_db --instance=catalog-db
gcloud sql users create catalog_user --instance=catalog-db --password=CATALOG_PASSWORD

# Order DB
gcloud sql databases create order_db --instance=order-db
gcloud sql users create order_user --instance=order-db --password=ORDER_PASSWORD

# Delivery DB
gcloud sql databases create delivery_db --instance=delivery-db
gcloud sql users create delivery_user --instance=delivery-db --password=DELIVERY_PASSWORD
```

### PASO 5: Crear Secrets para Credenciales

```bash
# JWT Secret
echo -n "your-super-secret-jwt-key-production-2026" | \
  gcloud secrets create jwt-secret --data-file=-

# SMTP Credentials
echo -n "tu-email@gmail.com" | \
  gcloud secrets create smtp-user --data-file=-

echo -n "tu-app-password" | \
  gcloud secrets create smtp-password --data-file=-

# Database passwords
echo -n "AUTH_PASSWORD" | \
  gcloud secrets create auth-db-password --data-file=-

echo -n "CATALOG_PASSWORD" | \
  gcloud secrets create catalog-db-password --data-file=-

echo -n "ORDER_PASSWORD" | \
  gcloud secrets create order-db-password --data-file=-

echo -n "DELIVERY_PASSWORD" | \
  gcloud secrets create delivery-db-password --data-file=-
```

### PASO 6: Construir y Subir Imágenes Docker

```bash
cd delivereats-project

# Configurar Docker para usar GCR
gcloud auth configure-docker

# Auth Service
cd auth-service
docker build -t gcr.io/$PROJECT_ID/auth-service:v1 .
docker push gcr.io/$PROJECT_ID/auth-service:v1
cd ..

# Catalog Service
cd restaurant-catalog-service
docker build -t gcr.io/$PROJECT_ID/catalog-service:v1 .
docker push gcr.io/$PROJECT_ID/catalog-service:v1
cd ..

# Order Service
cd order-service
docker build -t gcr.io/$PROJECT_ID/order-service:v1 .
docker push gcr.io/$PROJECT_ID/order-service:v1
cd ..

# Delivery Service
cd delivery-service
docker build -t gcr.io/$PROJECT_ID/delivery-service:v1 .
docker push gcr.io/$PROJECT_ID/delivery-service:v1
cd ..

# Notification Service
cd notification-service
docker build -t gcr.io/$PROJECT_ID/notification-service:v1 .
docker push gcr.io/$PROJECT_ID/notification-service:v1
cd ..

# API Gateway
cd api-gateway
docker build -t gcr.io/$PROJECT_ID/api-gateway:v1 .
docker push gcr.io/$PROJECT_ID/api-gateway:v1
cd ..

# Frontend
cd frontend
docker build -t gcr.io/$PROJECT_ID/frontend:v1 .
docker push gcr.io/$PROJECT_ID/frontend:v1
cd ..
```

### PASO 7: Desplegar Servicios en Cloud Run

#### 1. Auth Service

```bash
gcloud run deploy auth-service \
  --image gcr.io/$PROJECT_ID/auth-service:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $PROJECT_ID:$REGION:auth-db \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GRPC_PORT=50052 \
  --set-env-vars DB_HOST=/cloudsql/$PROJECT_ID:$REGION:auth-db \
  --set-env-vars DB_NAME=auth_db \
  --set-env-vars DB_USER=auth_user \
  --set-secrets DB_PASSWORD=auth-db-password:latest \
  --set-secrets JWT_SECRET=jwt-secret:latest
```

#### 2. Catalog Service

```bash
gcloud run deploy catalog-service \
  --image gcr.io/$PROJECT_ID/catalog-service:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $PROJECT_ID:$REGION:catalog-db \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GRPC_PORT=50051 \
  --set-env-vars DB_HOST=/cloudsql/$PROJECT_ID:$REGION:catalog-db \
  --set-env-vars DB_NAME=catalog_db \
  --set-env-vars DB_USER=catalog_user \
  --set-secrets DB_PASSWORD=catalog-db-password:latest
```

#### 3. Order Service

```bash
# Primero obtén las URLs de los servicios desplegados
AUTH_SERVICE_URL=$(gcloud run services describe auth-service --region $REGION --format 'value(status.url)')
CATALOG_SERVICE_URL=$(gcloud run services describe catalog-service --region $REGION --format 'value(status.url)')

gcloud run deploy order-service \
  --image gcr.io/$PROJECT_ID/order-service:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $PROJECT_ID:$REGION:order-db \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GRPC_PORT=50053 \
  --set-env-vars DB_HOST=/cloudsql/$PROJECT_ID:$REGION:order-db \
  --set-env-vars DB_NAME=order_db \
  --set-env-vars DB_USER=order_user \
  --set-env-vars CATALOG_SERVICE_URL=$CATALOG_SERVICE_URL \
  --set-secrets DB_PASSWORD=order-db-password:latest
```

#### 4. Delivery Service

```bash
gcloud run deploy delivery-service \
  --image gcr.io/$PROJECT_ID/delivery-service:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $PROJECT_ID:$REGION:delivery-db \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GRPC_PORT=50054 \
  --set-env-vars DB_HOST=/cloudsql/$PROJECT_ID:$REGION:delivery-db \
  --set-env-vars DB_NAME=delivery_db \
  --set-env-vars DB_USER=delivery_user \
  --set-secrets DB_PASSWORD=delivery-db-password:latest
```

#### 5. Notification Service

```bash
gcloud run deploy notification-service \
  --image gcr.io/$PROJECT_ID/notification-service:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GRPC_PORT=50055 \
  --set-env-vars SMTP_HOST=smtp.gmail.com \
  --set-env-vars SMTP_PORT=587 \
  --set-secrets SMTP_USER=smtp-user:latest \
  --set-secrets SMTP_PASSWORD=smtp-password:latest
```

#### 6. API Gateway

```bash
# Obtener URLs de todos los servicios
AUTH_URL=$(gcloud run services describe auth-service --region $REGION --format 'value(status.url)')
CATALOG_URL=$(gcloud run services describe catalog-service --region $REGION --format 'value(status.url)')
ORDER_URL=$(gcloud run services describe order-service --region $REGION --format 'value(status.url)')
DELIVERY_URL=$(gcloud run services describe delivery-service --region $REGION --format 'value(status.url)')
NOTIFICATION_URL=$(gcloud run services describe notification-service --region $REGION --format 'value(status.url)')

gcloud run deploy api-gateway \
  --image gcr.io/$PROJECT_ID/api-gateway:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars PORT=8080 \
  --set-env-vars AUTH_SERVICE_URL=$AUTH_URL \
  --set-env-vars CATALOG_SERVICE_URL=$CATALOG_URL \
  --set-env-vars ORDER_SERVICE_URL=$ORDER_URL \
  --set-env-vars DELIVERY_SERVICE_URL=$DELIVERY_URL \
  --set-env-vars NOTIFICATION_SERVICE_URL=$NOTIFICATION_URL \
  --set-secrets JWT_SECRET=jwt-secret:latest
```

#### 7. Frontend

```bash
GATEWAY_URL=$(gcloud run services describe api-gateway --region $REGION --format 'value(status.url)')

gcloud run deploy frontend \
  --image gcr.io/$PROJECT_ID/frontend:v1 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars API_URL=$GATEWAY_URL
```

### PASO 8: Obtener URLs de Acceso

```bash
# URL del Frontend (esta es la que compartes)
FRONTEND_URL=$(gcloud run services describe frontend --region $REGION --format 'value(status.url)')

echo "🎉 Frontend URL: $FRONTEND_URL"
echo "🌐 API Gateway URL: $GATEWAY_URL"
```

---

## 🔒 PASO 9: Configurar CORS y Seguridad

### Actualizar API Gateway con CORS correcto:

Edita `api-gateway/src/server.ts`:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
```

Reconstruir y redesplegar:

```bash
cd api-gateway
docker build -t gcr.io/$PROJECT_ID/api-gateway:v2 .
docker push gcr.io/$PROJECT_ID/api-gateway:v2

FRONTEND_URL=$(gcloud run services describe frontend --region $REGION --format 'value(status.url)')

gcloud run deploy api-gateway \
  --image gcr.io/$PROJECT_ID/api-gateway:v2 \
  --region $REGION \
  --set-env-vars FRONTEND_URL=$FRONTEND_URL \
  --update-env-vars CORS_ORIGIN=$FRONTEND_URL
```

---

## 📊 PASO 10: Configurar Cloud SQL Proxy (Opcional)

Para acceder a las bases de datos desde tu máquina local:

```bash
# Instalar Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
chmod +x cloud_sql_proxy

# Conectar
./cloud_sql_proxy -instances=$PROJECT_ID:$REGION:auth-db=tcp:5432
```

---

## 💰 PASO 11: Monitoreo y Logs

### Ver logs en tiempo real:

```bash
# Logs de un servicio
gcloud run services logs read auth-service --region $REGION --follow

# Logs de todos
gcloud run services logs tail --region $REGION
```

### Ver métricas:

```bash
# Abrir Cloud Console
gcloud console
# Navega a: Cloud Run > Selecciona servicio > Metrics
```

---

## 🔧 PASO 12: CI/CD con GitHub Actions (Opcional)

Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - id: auth
      uses: google-github-actions/auth@v1
      with:
        credentials_json: ${{ secrets.GCP_CREDENTIALS }}
    
    - name: Set up Cloud SDK
      uses: google-github-actions/setup-gcloud@v1
    
    - name: Build and Push
      run: |
        gcloud auth configure-docker
        docker build -t gcr.io/${{ secrets.PROJECT_ID }}/auth-service:${{ github.sha }} ./auth-service
        docker push gcr.io/${{ secrets.PROJECT_ID }}/auth-service:${{ github.sha }}
    
    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy auth-service \
          --image gcr.io/${{ secrets.PROJECT_ID }}/auth-service:${{ github.sha }} \
          --region us-central1
```

---

## 💵 COSTOS ESTIMADOS (Tier Gratuito)

### Cloud Run (Free Tier incluye):
- 2 millones de requests/mes
- 360,000 GB-segundos de memoria
- 180,000 vCPU-segundos

### Cloud SQL (db-f1-micro):
- ~$7/mes por instancia
- 4 instancias = ~$28/mes

### Storage (Container Registry):
- Primeros 5GB gratis
- $0.026/GB después

**Total estimado: ~$30-40/mes** (con tráfico bajo)

---

## 🚨 Troubleshooting en Cloud

### Error: "cannot connect to Cloud SQL"

```bash
# Verificar que Cloud SQL proxy está habilitado
gcloud sql instances describe auth-db

# Reiniciar instancia
gcloud sql instances restart auth-db
```

### Error: "Secret not found"

```bash
# Listar secrets
gcloud secrets list

# Dar permisos
gcloud secrets add-iam-policy-binding jwt-secret \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### Error: "Service timeout"

```bash
# Aumentar timeout y memoria
gcloud run services update auth-service \
  --timeout=300 \
  --memory=512Mi \
  --region $REGION
```

---

## ✅ Checklist de Despliegue

- [ ] gcloud CLI instalado
- [ ] Proyecto GCP creado con billing
- [ ] APIs habilitadas
- [ ] Cloud SQL instances creadas
- [ ] Secrets creados
- [ ] Imágenes Docker subidas a GCR
- [ ] Servicios desplegados en Cloud Run
- [ ] URLs obtenidas y probadas
- [ ] CORS configurado
- [ ] Frontend accesible
- [ ] Emails funcionando
- [ ] Logs sin errores

---

## 🎯 Comandos Útiles

```bash
# Ver todos los servicios
gcloud run services list --region $REGION

# Ver URL de un servicio
gcloud run services describe SERVICE_NAME --region $REGION --format 'value(status.url)'

# Actualizar variables de entorno
gcloud run services update SERVICE_NAME \
  --update-env-vars KEY=VALUE \
  --region $REGION

# Eliminar un servicio
gcloud run services delete SERVICE_NAME --region $REGION

# Ver costos
gcloud billing accounts list
```

---

## 📱 Dominios Personalizados (Opcional)

```bash
# Mapear dominio personalizado
gcloud beta run domain-mappings create \
  --service frontend \
  --domain www.tudominio.com \
  --region $REGION
```

---

¡Tu aplicación ahora está en la nube! 🎉☁️
