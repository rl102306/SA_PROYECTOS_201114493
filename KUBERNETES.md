# DeliverEats — Guía Completa de Kubernetes con Minikube

## Tabla de contenidos

1. [¿Qué es Kubernetes y Minikube?](#1-qué-es-kubernetes-y-minikube)
2. [Arquitectura del sistema en K8s](#2-arquitectura-del-sistema-en-k8s)
3. [Tipos de recursos usados y qué hace cada YAML](#3-tipos-de-recursos-usados-y-qué-hace-cada-yaml)
4. [Flujo de comunicación entre servicios](#4-flujo-de-comunicación-entre-servicios)
5. [Problemas encontrados y soluciones](#5-problemas-encontrados-y-soluciones)
6. [Despliegue completo desde cero](#6-despliegue-completo-desde-cero)
7. [Comandos para actualizar y gestionar el cluster](#7-comandos-para-actualizar-y-gestionar-el-cluster)
8. [Consultas útiles a las bases de datos](#8-consultas-útiles-a-las-bases-de-datos)
9. [Estructura de archivos k8s/](#9-estructura-de-archivos-k8s)
10. [⚡ Cómo volver a levantar el ambiente (uso diario)](#10--cómo-volver-a-levantar-el-ambiente-uso-diario)
11. [Problemas adicionales encontrados en reinicio](#11-problemas-adicionales-encontrados-en-reinicio)

---

## 1. ¿Qué es Kubernetes y Minikube?

### Kubernetes (K8s)

Kubernetes es un **orquestador de contenedores**. Su función es:
- Iniciar y mantener vivos los contenedores Docker
- Reiniciarlos automáticamente si fallan (auto-healing)
- Distribuir el tráfico entre múltiples instancias (load balancing)
- Gestionar la configuración y los secretos de forma segura
- Proporcionar DNS interno para que los servicios se encuentren por nombre

### Minikube

Minikube crea un **cluster de Kubernetes de un solo nodo** en tu máquina local. Es la forma más práctica de desarrollar y probar con Kubernetes sin infraestructura en la nube.

```
Tu máquina (Windows 11 — 8GB RAM, 8 núcleos)
└── WSL2 (5GB asignados en .wslconfig)
    └── Docker Desktop
        └── Minikube (3.8GB, 4 CPUs)
            └── Cluster Kubernetes
                ├── Namespace: delivereats   ← todos nuestros recursos
                └── Namespace: ingress-nginx ← controlador de Ingress nginx
```

### Docker Compose vs Kubernetes

| Docker Compose | Kubernetes (Minikube) |
|---|---|
| `docker-compose up` | `kubectl apply -f k8s/` |
| `services:` | `Deployment` + `Service` |
| `volumes:` | `PersistentVolumeClaim` |
| `networks:` | Namespace + DNS interno |
| `depends_on:` | `readinessProbe` + reintentos |
| `restart: always` | Automático por defecto |
| Solo funciona local | Escala a producción en nube |

---

## 2. Arquitectura del sistema en K8s

```
                        NAVEGADOR (Windows)
                               │
              http://delivereats.local  (hosts: 127.0.0.1)
              http://api.delivereats.local
                               │
                    ┌──────────▼──────────┐
                    │   port-forward      │
                    │   127.0.0.1:80      │  ← PowerShell Admin abierto
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │  ingress-nginx-controller    │
                    │  (NodePort 80:32023)         │
                    └──────┬──────────────┬────────┘
                           │              │
              delivereats.local   api.delivereats.local
                           │              │
               ┌───────────▼──┐  ┌────────▼─────────┐
               │ frontend-    │  │ api-gateway       │
               │ service:80   │  │ service:3000      │
               └──────┬───────┘  └────────┬──────────┘
                      │                   │ gRPC calls
               ┌──────▼────────┐   ┌──────▼──────┐ :50052
               │ frontend Pod  │   │auth-service │──► auth-db:5432
               │ nginx:80      │   └─────────────┘
               │ Angular SPA   │   ┌─────────────┐ :50051
               │               │   │catalog-svc  │──► catalog-db:5432
               │ /auth/*      ───┼──►│             │
               │ /catalog/*   ───┼──►└─────────────┘
               │ /orders/*    ───┼──►┌─────────────┐ :50053
               │ /deliveries/*───┼──►│order-service│──► order-db:5432
               │ /admin/*     ───┼──►└─────────────┘
               │ /fx/*        ───┼──►┌─────────────┐ :50054
               │ /payments/*  ───┼──►│delivery-svc │──► delivery-db:5432
               └───────────────┘   └─────────────┘
                                   ┌─────────────┐ :50056
                                   │ fx-service  │──► redis:6379
                                   └─────────────┘    └►open.er-api.com
                                   ┌─────────────┐ :50057
                                   │payment-svc  │──► payment-db:5432
                                   └─────────────┘
                                   ┌─────────────┐ :50055
                                   │notif-service│──► Gmail SMTP
                                   └─────────────┘

Todos los Services: type ClusterIP (internos al cluster)
Namespace: delivereats
```

---

## 3. Tipos de recursos usados y qué hace cada YAML

### Namespace — `k8s/namespace/namespace.yaml`
Agrupa todos los recursos del proyecto en un espacio de nombres virtual. Sin namespace todo va al namespace `default` y puede haber conflictos con otros proyectos.

```powershell
kubectl apply -f k8s/namespace/namespace.yaml
# namespace/delivereats created
```

---

### Secrets — `k8s/auth-service/auth-secret.yaml`
Almacena datos sensibles (contraseñas, tokens JWT). Los valores se guardan en base64 internamente.

```yaml
# MAL ❌ — contraseña visible en el YAML
env:
  - name: DB_PASSWORD
    value: "auth_password"

# BIEN ✅ — referencia al Secret
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: auth-db-secret
        key: password
```

Este archivo crea dos Secrets:
- `auth-db-secret` → usuario/contraseña de PostgreSQL
- `jwt-secret` → clave para firmar/verificar tokens JWT (compartida entre auth-service y api-gateway)

```powershell
kubectl apply -f k8s/auth-service/auth-secret.yaml
# secret/auth-db-secret created
# secret/jwt-secret created
```

---

### StatefulSet vs Deployment

```
¿El Pod necesita guardar datos en disco?
        │
       SÍ → StatefulSet    (PostgreSQL, Redis)
        │
       NO → Deployment     (microservicios Node.js, frontend nginx)
```

| StatefulSet | Deployment |
|---|---|
| Pod nombre estable: `auth-db-0` | Pod nombre aleatorio: `auth-service-x8k2` |
| Si muere → vuelve con MISMO nombre y disco | Si muere → nuevo Pod, nombre diferente |
| Tiene PersistentVolume propio | Sin almacenamiento propio |
| Para: PostgreSQL, Redis | Para: Node.js, nginx |

---

### StatefulSet auth-db — `k8s/auth-service/auth-db-statefulset.yaml`
PostgreSQL de autenticación. Crea el Pod `auth-db-0` y un PVC de 2GB.

```powershell
kubectl apply -f k8s/auth-service/auth-db-statefulset.yaml
# statefulset.apps/auth-db created
```

---

### Deployment auth-service — `k8s/auth-service/auth-service-deployment.yaml`
Crea 3 recursos a la vez:

```
├── Service "auth-db" (ClusterIP)      → DNS: auth-db:5432
├── Deployment "auth-service"          → microservicio gRPC :50052
└── Service "auth-service" (ClusterIP) → DNS: auth-service:50052
```

```powershell
kubectl apply -f k8s/auth-service/auth-service-deployment.yaml
# service/auth-db created
# deployment.apps/auth-service created
# service/auth-service created
```

---

### Archivos todo-en-uno (catalog, order, delivery, payment)
Cada uno crea: Secret + StatefulSet + Service BD + Deployment + Service microservicio.

Auth está separado porque el `jwt-secret` lo comparten auth-service Y api-gateway.

```powershell
kubectl apply -f k8s/catalog-service/catalog-service.yaml
# secret/catalog-db-secret created
# statefulset.apps/catalog-db created
# service/catalog-db created
# deployment.apps/catalog-service created
# service/catalog-service created
```

---

### Redis — `k8s/redis/`
Caché exclusiva del fx-service para tipos de cambio.

```
fx-service → ¿está en Redis? → SÍ: respuesta rápida
                              → NO: llama open.er-api.com → guarda en Redis
```

```powershell
kubectl apply -f k8s/redis/redis-statefulset.yaml
kubectl apply -f k8s/redis/redis-service.yaml
```

---

### ConfigMap
Configuración no sensible. Se inyecta con `envFrom` como variables de entorno.

```yaml
kind: ConfigMap
data:
  REDIS_HOST: redis      # nombre del Service de Redis
  REDIS_PORT: "6379"
```

---

### API Gateway — `k8s/api-gateway/api-gateway.yaml`
Crea 4 recursos:
```
ConfigMap    → URLs de todos los microservicios gRPC
Deployment   → 1 réplica, readinessProbe en /health
Service      → ClusterIP "api-gateway:3000" (mismo nombre que docker-compose)
Ingress      → host: api.delivereats.local → api-gateway:3000
```

**IMPORTANTE:** El Service se llama `api-gateway` (igual que en docker-compose.yml) para que `nginx.conf` use el mismo hostname en ambos entornos.

---

### Frontend — `k8s/frontend/frontend.yaml`
```
Deployment   → 1 réplica nginx sirviendo Angular compilado
Service      → ClusterIP "frontend-service:80"
Ingress      → host: delivereats.local → frontend-service:80
```

El nginx proxea `/auth`, `/catalog`, `/orders`, etc. a `api-gateway:3000` internamente.

---

### Probes
```yaml
readinessProbe:   # ¿Listo para recibir tráfico? El Pod no recibe tráfico hasta pasar esto
  httpGet:
    path: /health
    port: 3000

livenessProbe:    # ¿Sigue vivo? Si falla → Kubernetes reinicia el Pod
  httpGet:
    path: /health
    port: 3000
```

---

## 4. Flujo de comunicación entre servicios

### Login de usuario (flujo completo)

```
1. Browser → POST http://delivereats.local/auth/login
2. hosts: delivereats.local → 127.0.0.1
3. port-forward 127.0.0.1:80 → ingress-nginx-controller
4. Ingress: host=delivereats.local → frontend-service:80
5. nginx (frontend Pod): /auth/* → proxy_pass http://api-gateway:3000
6. api-gateway: POST /auth/login
7. api-gateway → gRPC → auth-service:50052
8. auth-service → SELECT * FROM users WHERE email=... (auth-db:5432)
9. Devuelve JWT token → respuesta vuelve al browser
```

---

## 5. Problemas encontrados y soluciones

### Problema 1: Docker Desktop tiene límite de memoria por WSL2

**Error:**
```
MK_USAGE: Docker Desktop has only 3838MB memory but you specified 4096MB
```

**Causa:** Con WSL2 backend, la memoria no se configura en la UI de Docker Desktop sino en un archivo `.wslconfig` de Windows.

**Solución:**
```powershell
notepad "$env:USERPROFILE\.wslconfig"
```
```ini
[wsl2]
memory=5GB
processors=4
swap=2GB
```
```powershell
wsl --shutdown
minikube start --cpus=4 --memory=3800 --driver=docker
```

---

### Problema 2: La IP de Minikube no es accesible desde Windows

**Síntoma:**
```
ping 192.168.49.2 → 100% perdidos
ERR_CONNECTION_TIMED_OUT en el navegador
```

**Causa:** Con el driver Docker en Windows, Minikube corre dentro de un contenedor Docker. La IP `192.168.49.2` está en la red interna de Docker/WSL2 y no es accesible directamente desde el navegador de Windows.

**Intento fallido — minikube tunnel:**
```powershell
minikube tunnel   # No funciona porque el Ingress es NodePort, no LoadBalancer
```

**Verificación:**
```powershell
kubectl get svc -n ingress-nginx
# ingress-nginx-controller   NodePort   80:32023/TCP   ← NodePort, no LoadBalancer
```

**Solución correcta — port-forward:**

1. Cambiar hosts a `127.0.0.1`:
```
# C:\Windows\System32\drivers\etc\hosts (como Administrador)
127.0.0.1  delivereats.local
127.0.0.1  api.delivereats.local
```

2. PowerShell como Administrador (mantener abierto siempre):
```powershell
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80
# Forwarding from 127.0.0.1:80 -> 80  ← mantener esta terminal abierta
```

---

### Problema 3: rewrite-target borraba el path de las peticiones

**Síntoma:**
- App carga visualmente pero registro/login dan error
- Logs de nginx: solo `kube-probe`, nunca peticiones reales
- Logs de api-gateway: solo `GET /health`, nunca peticiones del frontend

**Causa:** La anotación `nginx.ingress.kubernetes.io/rewrite-target: /` reescribía TODAS las URLs a `/`:
```
Browser → POST /auth/register
Ingress rewrite → POST /    ← path perdido
nginx recibe / → sirve index.html
El request al API nunca ocurre
```

**Diagnóstico:**
```powershell
kubectl logs -n delivereats deployment/frontend --tail=20
# Solo kube-probe, nunca /auth/register

kubectl logs -n delivereats deployment/api-gateway --tail=20
# Solo GET /health, nunca peticiones reales
```

**Solución:** Eliminar `rewrite-target: /` de ambos Ingress en `k8s/frontend/frontend.yaml` y `k8s/api-gateway/api-gateway.yaml`:
```powershell
kubectl apply -f k8s/frontend/frontend.yaml
kubectl apply -f k8s/api-gateway/api-gateway.yaml
```

---

### Problema 4: Angular usaba `localhost:3000` como URL del API

**Síntoma:**
```
Http failure response for http://localhost:3000/auth/register: 0 Unknown Error
```

**Causa raíz:** `fileReplacements` no estaba configurado en `angular.json`. Sin esa configuración, Angular CLI **siempre usa `environment.ts` (dev)** que tiene `apiUrl: 'http://localhost:3000'`, ignorando completamente `environment.prod.ts` aunque se haga `ng build --configuration production`.

**Diagnóstico:**
```powershell
# Verificar que el JS compilado tiene localhost:3000
kubectl exec -n delivereats deployment/frontend -- grep -rl "localhost:3000" /usr/share/nginx/html/
# /usr/share/nginx/html/main.848af4b9016dcdca.js  ← estaba ahí
```

**Solución — dos cambios:**

1. Agregar `fileReplacements` en `angular.json`:
```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  ...
}
```

2. Cambiar `environment.prod.ts` a URL vacía (relativa):
```typescript
export const environment = {
  production: true,
  apiUrl: ''   // URL relativa → nginx hace el proxy internamente
};
```

3. Reconstruir imagen y reiniciar pod:
```powershell
minikube docker-env | Invoke-Expression
docker build --no-cache -t delivereats/frontend:latest ./frontend
kubectl rollout restart deployment/frontend -n delivereats
kubectl rollout status deployment/frontend -n delivereats
```

4. Verificar que `localhost:3000` ya no está:
```powershell
kubectl exec -n delivereats deployment/frontend -- grep -rl "localhost:3000" /usr/share/nginx/html/
# exit code 1 = sin resultados = CORRECTO ✓
```

---

### Problema 5: Columna `restaurant_id` no existe en tabla `users`

**Error al registrar usuario con rol RESTAURANT:**
```
column "restaurant_id" of relation "users" does not exist
```

**Causa:** En Kubernetes, la BD se crea desde cero (nuevo PVC vacío). La columna `restaurant_id` fue añadida en una sesión de desarrollo anterior con `ALTER TABLE`, pero esa migración no está en el script de inicialización del servicio.

**Solución:** Ejecutar la migración manualmente:
```powershell
kubectl exec -it -n delivereats auth-db-0 -- psql -U auth_user -d auth_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id UUID;"
```

---

### Problema 6: nginx.conf rompería Docker Compose

**Causa:** Al configurar el proxy de nginx para Kubernetes se usó `api-gateway-service:3000`, pero en Docker Compose el servicio se llama `api-gateway`.

**Solución:** Renombrar el Service de Kubernetes a `api-gateway` (igual que en docker-compose.yml):
```yaml
# k8s/api-gateway/api-gateway.yaml
kind: Service
metadata:
  name: api-gateway   # Mismo nombre que en docker-compose.yml ✓
```
```nginx
# frontend/nginx.conf — funciona en Docker Compose Y en Kubernetes
proxy_pass http://api-gateway:3000;
```

---

## 6. Despliegue completo desde cero

> Usar esto solo si borraste el namespace o es la primera vez.
> Para uso diario ir a la [Sección 10](#10--cómo-volver-a-levantar-el-ambiente-uso-diario).

### Paso 1: Configurar WSL2
```powershell
notepad "$env:USERPROFILE\.wslconfig"
```
```ini
[wsl2]
memory=5GB
processors=4
swap=2GB
```
```powershell
wsl --shutdown
```

### Paso 2: Iniciar Minikube
```powershell
minikube start --cpus=4 --memory=3800 --driver=docker
minikube addons enable ingress
```

### Paso 3: Construir imágenes dentro de Minikube
```powershell
cd D:\USAC\1S2026\SA\SA_PROYECTOS_201114493
minikube docker-env | Invoke-Expression

docker build -t delivereats/auth-service:latest         ./auth-service
docker build -t delivereats/catalog-service:latest      ./restaurant-catalog-service
docker build -t delivereats/order-service:latest        ./order-service
docker build -t delivereats/delivery-service:latest     ./delivery-service
docker build -t delivereats/fx-service:latest           ./fx-service
docker build -t delivereats/payment-service:latest      ./payment-service
docker build -t delivereats/notification-service:latest ./notification-service
docker build -t delivereats/api-gateway:latest          ./api-gateway
docker build -t delivereats/frontend:latest             ./frontend
```

### Paso 4: Aplicar manifiestos en orden
```powershell
kubectl apply -f k8s/namespace/namespace.yaml

kubectl apply -f k8s/auth-service/auth-secret.yaml
kubectl apply -f k8s/auth-service/auth-db-statefulset.yaml
kubectl apply -f k8s/auth-service/auth-service-deployment.yaml

kubectl apply -f k8s/catalog-service/catalog-service.yaml
kubectl apply -f k8s/order-service/order-service.yaml
kubectl apply -f k8s/delivery-service/delivery-service.yaml

kubectl apply -f k8s/redis/redis-statefulset.yaml
kubectl apply -f k8s/redis/redis-service.yaml

kubectl apply -f k8s/payment-service/payment-service.yaml
kubectl apply -f k8s/notification-service/notification-service.yaml
kubectl apply -f k8s/fx-service/fx-service.yaml

kubectl apply -f k8s/api-gateway/api-gateway.yaml
kubectl apply -f k8s/frontend/frontend.yaml
```

### Paso 5: Esperar que todos los Pods estén Running
```powershell
kubectl get pods -n delivereats
# Esperar STATUS=Running y READY=1/1 en todos
```

### Paso 6: Migración de BD (solo primera vez)
```powershell
kubectl exec -it -n delivereats auth-db-0 -- psql -U auth_user -d auth_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id UUID;"
```

### Paso 7: Configurar hosts (solo primera vez)
Abrir `C:\Windows\System32\drivers\etc\hosts` **como Administrador**:
```
127.0.0.1  delivereats.local
127.0.0.1  api.delivereats.local
```

### Paso 8: Activar port-forward (PowerShell como Administrador)
```powershell
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80
```
**Mantener esta terminal abierta.**

### Paso 9: Abrir la app
```
http://delivereats.local
```

---

## 7. Comandos para actualizar y gestionar el cluster

### Actualizar una imagen después de cambiar código
```powershell
minikube docker-env | Invoke-Expression
docker build --no-cache -t delivereats/api-gateway:latest ./api-gateway
kubectl rollout restart deployment/api-gateway -n delivereats
kubectl rollout status deployment/api-gateway -n delivereats
```

### Escalar réplicas
```powershell
kubectl scale deployment/api-gateway --replicas=2 -n delivereats
kubectl get pods -n delivereats -l app=api-gateway
```

### Actualizar variable de entorno (ConfigMap)
```powershell
kubectl edit configmap api-gateway-config -n delivereats
kubectl rollout restart deployment/api-gateway -n delivereats
```

### Reiniciar todos los servicios
```powershell
kubectl rollout restart deployment -n delivereats
```

### Ver estado general
```powershell
kubectl get pods         -n delivereats
kubectl get services     -n delivereats
kubectl get ingress      -n delivereats
kubectl get statefulsets -n delivereats
kubectl get pvc          -n delivereats
```

### Ver logs
```powershell
kubectl logs -n delivereats deployment/auth-service     -f
kubectl logs -n delivereats deployment/api-gateway      -f
kubectl logs -n delivereats deployment/frontend         -f
kubectl logs -n delivereats deployment/order-service    -f
kubectl logs -n delivereats auth-db-0                  -f
kubectl logs -n delivereats redis-0                    -f
```

### Diagnosticar un Pod que falla
```powershell
kubectl describe pod -n delivereats <nombre-del-pod>
kubectl get events   -n delivereats --sort-by='.lastTimestamp'
```

### Acceder a un contenedor
```powershell
kubectl exec -it -n delivereats deployment/auth-service -- sh
kubectl exec -it -n delivereats redis-0 -- redis-cli
```

### Eliminar todo y empezar de cero
```powershell
kubectl delete namespace delivereats
# Luego volver al Paso 4 de la Sección 6
```

### Dashboard visual
```powershell
minikube dashboard
```

---

## 8. Consultas útiles a las bases de datos

### Ver usuarios registrados
```powershell
kubectl exec -it -n delivereats auth-db-0 -- psql -U auth_user -d auth_db -c "SELECT id, email, role, first_name, last_name, restaurant_id, created_at FROM users;"
```

### Ver restaurantes
```powershell
kubectl exec -it -n delivereats catalog-db-0 -- psql -U catalog_user -d catalog_db -c "SELECT id, name, address, is_active FROM restaurants;"
```

### Ver productos
```powershell
kubectl exec -it -n delivereats catalog-db-0 -- psql -U catalog_user -d catalog_db -c "SELECT id, name, price, is_available, restaurant_id FROM products;"
```

### Ver pedidos
```powershell
kubectl exec -it -n delivereats order-db-0 -- psql -U order_user -d order_db -c "SELECT id, status, total_amount, created_at FROM orders ORDER BY created_at DESC;"
```

### Ver pagos
```powershell
kubectl exec -it -n delivereats payment-db-0 -- psql -U payment_user -d payment_db -c "SELECT id, order_id, amount, currency, status FROM payments;"
```

### Ver entregas
```powershell
kubectl exec -it -n delivereats delivery-db-0 -- psql -U delivery_user -d delivery_db -c "SELECT id, order_id, status, delivery_person_id FROM deliveries;"
```

### Ver caché de Redis
```powershell
kubectl exec -it -n delivereats redis-0 -- redis-cli KEYS "*"
```

---

## 9. Estructura de archivos k8s/

```
k8s/
├── deploy.sh                         ← Script automático (referencia)
├── namespace/
│   └── namespace.yaml                ← Namespace "delivereats"
├── auth-service/
│   ├── auth-secret.yaml              ← Secret: DB creds + JWT key
│   ├── auth-db-statefulset.yaml      ← StatefulSet: PostgreSQL (auth-db-0)
│   └── auth-service-deployment.yaml  ← Service BD + Deployment + Service
├── catalog-service/
│   └── catalog-service.yaml          ← Secret + StatefulSet + Services + Deployment
├── order-service/
│   └── order-service.yaml            ← Secret + StatefulSet + Services + Deployment
├── delivery-service/
│   └── delivery-service.yaml         ← Secret + StatefulSet + Services + Deployment
├── redis/
│   ├── redis-statefulset.yaml        ← StatefulSet: Redis (redis-0)
│   └── redis-service.yaml            ← Service ClusterIP
├── fx-service/
│   └── fx-service.yaml               ← ConfigMap + Deployment + Service
├── payment-service/
│   └── payment-service.yaml          ← Secret + StatefulSet + ConfigMap + Deployment + Service
├── notification-service/
│   └── notification-service.yaml     ← Secret SMTP + ConfigMap + Deployment + Service
├── api-gateway/
│   └── api-gateway.yaml              ← ConfigMap + Deployment + Service + Ingress
└── frontend/
    └── frontend.yaml                 ← Deployment + Service + Ingress
```

---

## 10. ⚡ Cómo volver a levantar el ambiente (uso diario)

> Estos son los pasos exactos cada vez que quieras trabajar con el proyecto en Kubernetes.
> Los pods y datos persisten entre reinicios de Minikube — no hay que volver a hacer `kubectl apply` ni reconstruir imágenes.

---

### Terminal 1 — Iniciar Minikube (PowerShell normal)

```powershell
minikube start --cpus=4 --memory=3800 --driver=docker
```

Espera el mensaje:
```
Done! kubectl is now configured to use "minikube" cluster
```

Verifica que todos los pods están Running:
```powershell
kubectl get pods -n delivereats
```
Todos deben mostrar `STATUS=Running` y `READY=1/1`.

**Si los pods muestran `Error` (común tras `minikube stop/start`):**
```powershell
kubectl rollout restart deployment  -n delivereats
kubectl rollout restart statefulset -n delivereats
```
Espera 3-5 minutos. Los servicios pueden pasar por `CrashLoopBackOff` brevemente mientras las BDs arrancan — es normal.

Si alguno sigue en `Pending` o `CrashLoopBackOff` después de 5 minutos, revisa sus logs:
```powershell
kubectl logs -n delivereats <nombre-del-pod>
```

---

### Terminal 2 — Activar port-forward (PowerShell como Administrador — mantener abierta)

```powershell
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80
```

Debe mostrar:
```
Forwarding from 127.0.0.1:80 -> 80
Forwarding from [::1]:80 -> 80
```

> ⚠️ **NO cerrar esta terminal.** Si la cierras, la app deja de ser accesible.
> Debes mantenerla abierta todo el tiempo que uses el proyecto.

---

### Abrir la aplicación

En el navegador (Chrome, Edge, Firefox):
```
http://delivereats.local
```

---

### Para detener al terminar el día

```powershell
# En Terminal 2: Ctrl+C para detener el port-forward

# En Terminal 1:
minikube stop
```

Los datos de las bases de datos quedan guardados en los PersistentVolumes.

---

### Resumen visual del flujo de inicio

```
1. minikube start          → levanta el cluster con todos los pods
       │
       ▼
2. kubectl get pods        → verificar que todos están Running
       │
       ▼
3. port-forward (Admin)    → crea el puente 127.0.0.1:80 → ingress
       │
       ▼
4. http://delivereats.local → ¡listo!
```

---

### Si un pod no levanta correctamente

```powershell
# Ver qué está pasando
kubectl describe pod -n delivereats <nombre-del-pod>
kubectl logs -n delivereats <nombre-del-pod>

# Reiniciar ese servicio específico
kubectl rollout restart deployment/<nombre> -n delivereats

# Reiniciar todo
kubectl rollout restart deployment -n delivereats
```

### Si el port-forward da error de puerto ocupado

```powershell
# Ver qué proceso usa el puerto 80
netstat -ano | findstr :80

# O usar un puerto alternativo (requiere cambiar en el browser)
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
# Luego abrir: http://delivereats.local:8080
```

---

## 11. Problemas adicionales encontrados en reinicio

### Problema 7: Todos los pods en estado `Error` tras reiniciar Minikube

**Síntoma:**
```
kubectl get pods -n delivereats
NAME                          READY   STATUS    RESTARTS
api-gateway-6d86d49cd4-ks645  0/1     Error     0
auth-db-0                     0/1     Error     0
auth-service-59b6844bbb-mhsw5 0/1     Error     0
catalog-db-0                  0/1     Error     0
...
```

**Causa:** Al detener Minikube con `minikube stop`, los pods quedan en estado `Error`. Al reiniciar con `minikube start`, los pods no se recuperan solos automáticamente — necesitan un reinicio explícito.

**Solución:** Reiniciar todos los Deployments y StatefulSets:
```powershell
kubectl rollout restart deployment  -n delivereats
kubectl rollout restart statefulset -n delivereats
```

Luego monitorear hasta que todos estén `Running`:
```powershell
kubectl get pods -n delivereats -w
```

> **Nota:** Los servicios dependientes (catalog-service, order-service, etc.) pueden entrar en `CrashLoopBackOff` brevemente mientras las bases de datos terminan de iniciar. Es normal — Kubernetes los reintenta automáticamente. Esperar 3-5 minutos hasta que todo esté estable.

---

### Problema 8: Error 405 al procesar pago — `POST /payments` bloqueado por nginx

**Síntoma en el navegador:**
```
/payments:1 Failed to load resource: the server responded with a status of 405 (Not Allowed)
```

**Síntoma adicional:** GET /deliveries/pending devolvía HTML (index.html) en lugar de JSON:
```javascript
SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
// Http failure during parsing for http://delivereats.local/deliveries/pending
```

**Causa:** El `nginx.conf` del frontend tenía las rutas en singular (`payment`, `delivery`), pero el api-gateway las expone en plural (`/payments`, `/deliveries`):

```nginx
# INCORRECTO ❌
location ~ ^/(auth|catalog|orders|delivery|admin|fx|payment)(/|$) {

# CORRECTO ✅
location ~ ^/(auth|catalog|orders|deliveries|admin|fx|payments)(/|$) {
```

Cuando el path no coincidía con la regex, nginx lo enviaba al fallback de Angular (`try_files`), que devolvía `index.html`. Por eso:
- `POST /payments` → 405 (nginx no sabe manejar POST a una SPA)
- `GET /deliveries/pending` → 200 con HTML (servía Angular en vez de proxear)

**Diagnóstico:**
```powershell
# No aparecía POST /payments en los logs del api-gateway
kubectl logs -n delivereats deployment/api-gateway --tail=50
# Solo mostraba GET /health, POST /orders, GET /fx/rate → nunca POST /payments
```

**Solución:** Corregir `frontend/nginx.conf` y reconstruir la imagen:

```nginx
# frontend/nginx.conf
location ~ ^/(auth|catalog|orders|deliveries|admin|fx|payments)(/|$) {
    proxy_pass http://api-gateway:3000;
    ...
}
```

```powershell
cd D:\USAC\1S2026\SA\SA_PROYECTOS_201114493
minikube docker-env | Invoke-Expression
docker build --no-cache -t delivereats/frontend:latest ./frontend
kubectl rollout restart deployment/frontend -n delivereats
kubectl rollout status deployment/frontend -n delivereats
```

**Regla a recordar:** Las rutas en `nginx.conf` deben coincidir **exactamente** con los prefijos definidos en `api-gateway/src/server.ts`:

| `server.ts` | `nginx.conf` |
|---|---|
| `app.use('/auth', ...)` | `auth` ✅ |
| `app.use('/orders', ...)` | `orders` ✅ |
| `app.use('/payments', ...)` | `payments` ✅ (era `payment` ❌) |
| `app.use('/deliveries', ...)` | `deliveries` ✅ (era `delivery` ❌) |
| `app.use('/catalog', ...)` | `catalog` ✅ |
| `app.use('/admin', ...)` | `admin` ✅ |
| `app.use('/fx', ...)` | `fx` ✅ |
