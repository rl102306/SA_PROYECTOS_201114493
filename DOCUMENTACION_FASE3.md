# DeliverEats — Documentación Técnica Fase 3

## Índice

1. [Resumen de componentes implementados](#1-resumen-de-componentes-implementados)
2. [CronJob — Rechazo automático de órdenes](#2-cronjob--rechazo-automático-de-órdenes)
3. [Infraestructura como Código — Terraform](#3-infraestructura-como-código--terraform)
4. [Observabilidad — Stack ELK](#4-observabilidad--stack-elk)
5. [Observabilidad — Prometheus y Grafana](#5-observabilidad--prometheus-y-grafana)
6. [Gestión de Configuración — Ansible](#6-gestión-de-configuración--ansible)
7. [Pruebas — Smoke Test y Carga (Locust)](#7-pruebas--smoke-test-y-carga-locust)
8. [Pipeline CI/CD actualizado](#8-pipeline-cicd-actualizado)
9. [Patrones de arquitectura y diseño utilizados](#9-patrones-de-arquitectura-y-diseño-utilizados)
10. [Decisiones de diseño relevantes](#10-decisiones-de-diseño-relevantes)
11. [Guía de pruebas paso a paso (GKE — Google Cloud)](#11-guía-de-pruebas-paso-a-paso-gke--google-cloud)
12. [Teoría extendida — Conceptos clave de cada componente](#12-teoría-extendida--conceptos-clave-de-cada-componente)

---

## 1. Resumen de componentes implementados

| Componente | Tecnología | Ubicación |
|---|---|---|
| Rechazo automático de órdenes | Kubernetes CronJob + Node.js | `order-cleanup/`, `k8s/cronjobs/` |
| Infraestructura como Código | Terraform + GCP | `terraform/` |
| Centralización de logs | ELK (Elasticsearch + Fluentd + Kibana) | `k8s/elk/` |
| Métricas y dashboards | Prometheus + Grafana | `k8s/monitoring/` |
| Gestión de configuración VM | Ansible | `ansible/` |
| Smoke test | Bash + curl + jq | `tests/smoke/` |
| Prueba de carga | Locust (Python) | `tests/load/` |

---

## 2. CronJob — Rechazo automático de órdenes

### Descripción

Microservicio autónomo (`order-cleanup`) que se ejecuta periódicamente buscando órdenes en estado `PENDING` que llevan más de 1 hora sin ser aceptadas por el restaurante. Las cancela y notifica al cliente por email.

### Archivos relevantes

```
order-cleanup/
├── src/
│   ├── index.ts              # Script principal (run-to-completion)
│   └── proto/
│       ├── auth.proto        # Para obtener email del usuario
│       └── notification.proto # Para enviar el email
├── Dockerfile                # Multi-stage build
├── package.json
└── tsconfig.json

k8s/cronjobs/
└── order-cleanup.yaml        # Manifiesto CronJob de Kubernetes
```

### Patrón: Run-to-Completion

A diferencia de un microservicio que expone un servidor permanente, `order-cleanup` implementa el patrón **Job / Run-to-Completion**: el proceso inicia, ejecuta su lógica, imprime un resumen y termina con código 0 (éxito) o 1 (error). Kubernetes interpreta esto como un Job completado o fallido respectivamente.

Este patrón es el adecuado para tareas de mantenimiento periódicas porque:
- No consume recursos entre ejecuciones.
- El historial de ejecuciones queda en los logs de Kubernetes.
- Si falla, Kubernetes puede reintentar automáticamente (`backoffLimit`).

### Lógica anti-spam

El enunciado exige que no se envíen notificaciones duplicadas. Se implementaron dos capas de protección:

**Capa 1 — Columna en base de datos (`rejection_notified`)**

```sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS rejection_notified BOOLEAN NOT NULL DEFAULT false;
```

La consulta que busca órdenes a rechazar incluye `rejection_notified = false`, por lo que una orden procesada nunca vuelve a aparecer.

**Capa 2 — UPDATE atómico con condición**

```sql
UPDATE orders
SET status = 'CANCELLED',
    rejection_notified = true,
    updated_at = NOW()
WHERE id = $1
  AND status = 'PENDING'
  AND rejection_notified = false
RETURNING id
```

Si el `UPDATE` no retorna ninguna fila (`rowCount === 0`), significa que otro proceso ya procesó esa orden (condición de carrera). El script la omite sin enviar notificación. Esto es una implementación del patrón **Optimistic Locking** usando las propias condiciones de la fila.

**Capa 3 — `concurrencyPolicy: Forbid` en el CronJob**

```yaml
concurrencyPolicy: Forbid
```

Kubernetes nunca ejecuta dos runs del CronJob en paralelo. Si un run tarda más que el intervalo de schedule, el siguiente se omite en lugar de ejecutarse en paralelo.

### Configuración del CronJob

```yaml
schedule: "*/5 * * * *"     # Cada 5 minutos
concurrencyPolicy: Forbid    # Sin ejecuciones paralelas
backoffLimit: 2              # Reintentar máximo 2 veces si falla
restartPolicy: OnFailure     # El pod no se reinicia solo; K8s crea uno nuevo
successfulJobsHistoryLimit: 5
failedJobsHistoryLimit: 3
```

La variable de entorno `PENDING_TIMEOUT_MINUTES=60` controla el tiempo real de espera, sin cambiar el schedule.

### Flujo de ejecución

```
1. Conectar a order-db (PostgreSQL)
2. ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotente)
3. SELECT órdenes PENDING > 60 min con rejection_notified = false
4. Por cada orden:
   a. GetUserById → auth-service (gRPC) → obtener email
   b. UPDATE orders SET status='CANCELLED', rejection_notified=true
      WHERE id=? AND status='PENDING' AND rejection_notified=false
   c. Si rowCount > 0: SendOrderRejectedNotification → notification-service (gRPC)
5. Imprimir resumen (órdenes procesadas, emails enviados, errores)
6. process.exit(0)
```

---

## 3. Infraestructura como Código — Terraform

### Descripción

Toda la infraestructura de GCP se define y gestiona mediante Terraform. No se crea ningún recurso manualmente en la consola de GCP.

### Estructura de módulos

```
terraform/
├── versions.tf          # Provider google ~> 5.0, backend GCS
├── variables.tf         # Variables con valores por defecto
├── main.tf              # Ensamblado de módulos
├── outputs.tf           # IPs, URLs y nombres expuestos
├── terraform.tfvars.example
└── modules/
    ├── networking/      # VPC, subredes, firewall, NAT
    ├── gke/             # Cluster GKE Standard + node pool + Artifact Registry
    ├── cloudsql/        # Cloud SQL SQL Server 2019 Express
    ├── cloudrun/        # Frontend Angular en Cloud Run
    └── vm/              # VM Ubuntu para Locust/Ansible
```

### Patrón: Módulos de Terraform

Cada componente de infraestructura está encapsulado en un módulo independiente con su propio `main.tf`, `variables.tf` y `outputs.tf`. El archivo `main.tf` raíz ensambla los módulos pasando outputs de unos como inputs de otros.

Beneficios:
- Cada módulo es reutilizable e independiente.
- Los `depends_on` explícitos documentan las dependencias entre componentes.
- Cada módulo puede testearse y destruirse por separado.

### Módulo `networking`

Crea la red base de toda la infraestructura:

| Recurso | Descripción |
|---|---|
| `google_compute_network` | VPC personalizada (no la default) |
| `google_compute_subnetwork` (gke) | `10.0.0.0/20` + rangos secundarios para pods (`10.48.0.0/16`) y services (`10.52.0.0/20`) |
| `google_compute_subnetwork` (vms) | `10.1.0.0/24` para VMs de load testing |
| `google_compute_firewall` (ssh) | Permite SSH desde cualquier IP con tag `allow-ssh` |
| `google_compute_firewall` (internal) | Tráfico libre dentro de `10.0.0.0/8` |
| `google_compute_firewall` (health-checks) | Rangos de GCP Load Balancer (`35.191.0.0/16`, `130.211.0.0/22`) |
| `google_compute_router` + `google_compute_router_nat` | Permite que nodos privados accedan a internet |

Por qué VPC personalizada y no la default: la VPC default tiene reglas permisivas preconfiguradas. Una VPC dedicada aplica el principio de mínimo privilegio desde la capa de red.

### Módulo `gke`

| Recurso | Descripción |
|---|---|
| `google_service_account` | SA para los nodos con mínimos permisos |
| `google_container_cluster` | GKE Standard, nodos privados, Workload Identity activado |
| `google_container_node_pool` | Pool separado del default, `e2-standard-2`, auto-repair y auto-upgrade |
| `google_artifact_registry_repository` | Repositorio Docker `delivereats` |

Decisión clave — GKE Standard vs Autopilot: se usa Standard para tener control total sobre los nodos y poder correr CronJobs con imágenes del Artifact Registry privado sin configuración adicional de Workload Identity en cada pod.

`deletion_protection = false` permite `terraform destroy` en entornos de desarrollo y proyectos académicos.

### Módulo `cloudsql`

Instancia de **SQL Server 2019 Express** fuera del cluster GKE.

- Conectividad vía **Private Services Access** (peering entre la VPC del proyecto y la red de Google): los pods acceden por IP privada sin salir a internet.
- `ipv4_enabled = false`: sin IP pública, no es accesible desde internet.
- La instancia Express es gratuita en licencia y suficiente para demo.

### Módulo `cloudrun`

El frontend Angular se despliega en **Cloud Run** en lugar del cluster GKE.

Ventajas sobre un Deployment en GKE para un frontend estático:
- Escala a cero cuando no hay tráfico (`min_instance_count = 0`).
- No requiere Ingress ni certificados TLS (Cloud Run provee HTTPS automático).
- Reduce el uso de recursos del cluster.

### Módulo `vm`

VM `e2-medium` con Ubuntu 22.04 LTS para Locust/Ansible. Tiene tag `allow-ssh` que activa la regla de firewall correspondiente. El startup script instala Python3 y pip; Ansible hace la configuración completa después.

### Estado remoto en GCS

```hcl
backend "gcs" {
  bucket = "delivereats-tfstate"
  prefix = "terraform/state"
}
```

El estado de Terraform se guarda en un bucket de GCS en lugar del sistema de archivos local. Esto permite:
- Compartir el estado entre desarrolladores.
- Que el pipeline de CI/CD lea y actualice el estado.
- Bloqueo de estado para evitar modificaciones concurrentes.

### Validación en CI/CD

El job `terraform` corre antes que `build`:

```
terraform → build → test → push → deploy → ansible → smoke-test
```

Pasos del job:
1. `terraform fmt -check -recursive` — falla si algún archivo no está formateado.
2. `terraform init -backend=false` — inicializa sin conectarse al bucket GCS.
3. `terraform validate` — verifica sintaxis y referencias entre módulos.
4. `terraform plan` — simula los cambios sin aplicarlos (con `continue-on-error: true`).

---

## 4. Observabilidad — Stack ELK

### Descripción

Centralización de logs de todos los microservicios en Elasticsearch, con visualización en Kibana. Los microservicios **no requieren cambios de código**: Fluentd captura su stdout directamente.

### Archivos relevantes

```
k8s/elk/
├── 01-namespace.yaml        # Namespace "logging" separado
├── 02-elasticsearch.yaml    # StatefulSet + Service
├── 03-kibana.yaml           # Deployment + Service + Ingress
└── 04-fluentd.yaml          # RBAC + ConfigMap + DaemonSet
```

Los archivos están numerados para garantizar el orden de aplicación al hacer `kubectl apply -f k8s/elk/`.

### Patrón: DaemonSet para recolección de logs

Fluentd corre como **DaemonSet**: exactamente un pod en cada nodo del cluster. Esto garantiza que los logs de cualquier pod, independientemente del nodo donde corra, sean capturados.

Por qué Fluentd y no Logstash: Fluentd tiene una imagen oficial (`fluent/fluentd-kubernetes-daemonset`) con plugins preinstalados para enriquecer logs con metadata de Kubernetes (pod name, namespace, labels). Logstash requeriría configuración adicional para lograr lo mismo.

### Flujo de datos

```
stdout de pods
  → /var/log/containers/<pod>_<ns>_<container>-<id>.log  (escrito por K8s)
  → Fluentd (tail /var/log/containers/*.log)
  → filter: kubernetes_metadata (enriquece con namespace, labels, pod name)
  → filter: grep namespace=delivereats (descarta logs del sistema)
  → filter: parser (intenta parsear JSON, si no deja como string)
  → match: rewrite_tag_filter (asigna tag según label "app" del pod)
  → match: elasticsearch (índice delivereats-<servicio>-YYYY.MM.DD)
```

### Índices por microservicio

| Índice | Microservicio |
|---|---|
| `delivereats-api-gateway-YYYY.MM.DD` | api-gateway |
| `delivereats-auth-service-YYYY.MM.DD` | auth-service |
| `delivereats-order-service-YYYY.MM.DD` | order-service |
| `delivereats-catalog-service-YYYY.MM.DD` | catalog-service |
| `delivereats-delivery-service-YYYY.MM.DD` | delivery-service |
| `delivereats-payment-service-YYYY.MM.DD` | payment-service |
| `delivereats-notification-service-YYYY.MM.DD` | notification-service |
| `delivereats-fx-service-YYYY.MM.DD` | fx-service |
| `delivereats-order-cleanup-YYYY.MM.DD` | order-cleanup (CronJob) |

El sufijo de fecha permite rotación diaria automática sin configuración adicional.

### Routing en Fluentd

Se usa el plugin `rewrite_tag_filter` para separar el stream en tags antes del output. Cada regla inspecciona el label `$.kubernetes.labels.app` del pod:

```
kubernetes.** → match rewrite_tag_filter
  label.app = "auth-service" → tag delivereats.auth-service
  label.app = "order-service" → tag delivereats.order-service
  ...
delivereats.** → match elasticsearch
  índice: ${tag_parts[0]}-${tag_parts[1]}-YYYY.MM.DD
  = delivereats-auth-service-2026.04.22
```

### Buffer en disco

```xml
<buffer tag, time>
  @type file
  path /var/log/fluentd-buffers/kubernetes.*.buffer
  retry_type exponential_backoff
  retry_max_interval 30s
</buffer>
```

Si Elasticsearch no está disponible temporalmente, Fluentd almacena los logs en disco y los reintenta con backoff exponencial. Los logs no se pierden.

### Elasticsearch

StatefulSet de un nodo con PVC de 10Gi. Se usa StatefulSet (no Deployment) porque Elasticsearch requiere identidad de red estable (nombre DNS predecible: `elasticsearch-0.elasticsearch`) y almacenamiento persistente asociado al pod específico.

`xpack.security.enabled: false` simplifica la configuración para demo. En producción se activaría con TLS mutuo entre Fluentd y ES.

### Acceso a Kibana

`http://delivereats.local/kibana`

Configuración de ruta en Ingress:
```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
path: /kibana(/|$)(.*)
```

Y en Kibana:
```yaml
SERVER_BASEPATH: /kibana
SERVER_REWRITEBASEPATH: "true"
```

---

## 5. Observabilidad — Prometheus y Grafana

### Descripción

Recolección de métricas de la aplicación y del sistema operativo, con dashboards precargados en Grafana y alertas configuradas en Prometheus.

### Archivos relevantes

```
k8s/monitoring/
├── 01-namespace.yaml          # Namespace "monitoring"
├── 02-node-exporter.yaml      # DaemonSet métricas SO
├── 03-kube-state-metrics.yaml # Deployment métricas K8s
├── 04-prometheus.yaml         # RBAC + ConfigMap + Deployment + PVC
└── 05-grafana.yaml            # ConfigMaps dashboards + Deployment + Ingress

api-gateway/src/middleware/metricsMiddleware.ts   # Nuevo middleware
api-gateway/src/server.ts                         # +/metrics endpoint
```

### Patrón: Pull-based metrics

Prometheus usa el modelo **pull**: él mismo hace requests periódicos (scrape) a los endpoints `/metrics` de cada target cada 15 segundos. Esto contrasta con el modelo push donde los servicios envían métricas activamente.

Ventajas del modelo pull:
- Prometheus controla el ritmo de recolección.
- Si un servicio cae, Prometheus lo detecta porque el scrape falla.
- Los servicios no necesitan saber la dirección de Prometheus.

### Métricas del api-gateway (`prom-client`)

Se agregó el middleware `metricsMiddleware` al api-gateway. Al ser el único punto de entrada HTTP de la aplicación, sus métricas representan todo el tráfico de usuarios.

**Métricas expuestas en `/metrics`:**

| Métrica | Tipo | Labels | Descripción |
|---|---|---|---|
| `http_request_duration_seconds` | Histogram | method, route, status_code | Duración de cada request |
| `http_requests_total` | Counter | method, route, status_code | Total de requests |
| `http_errors_total` | Counter | method, route | Requests con status >= 500 |
| Métricas default de Node.js | Varios | — | Heap, GC, event loop lag |

**Normalización de rutas:**

Las rutas con IDs dinámicos se normalizan para evitar cardinalidad alta en Prometheus:

```
/orders/550e8400-e29b-... → /orders/:id
/catalog/restaurants/abc/products → /catalog/restaurants/:id/products
```

Sin normalización, cada UUID generaría una serie temporal distinta, saturando la memoria de Prometheus.

### Fuentes de métricas (scrape targets)

| Job | Target | Métricas |
|---|---|---|
| `api-gateway` | `api-gateway.delivereats:3000/metrics` | HTTP latencia, requests, errores |
| `node-exporter` | Pod en cada nodo `:9100/metrics` | CPU, RAM, disco, red |
| `kube-state-metrics` | `kube-state-metrics.monitoring:8080/metrics` | Estado de pods, deployments, CronJobs |
| `prometheus` | `localhost:9090/metrics` | Auto-monitoreo |
| `kubernetes-pods` | Pods con anotación `prometheus.io/scrape: "true"` | Discovery dinámico |

### Alertas configuradas

| Alerta | Condición | Severidad |
|---|---|---|
| `PodDown` | Pod no Running por > 2 min | critical |
| `HighErrorRate` | > 5% errores en alguna ruta (últimos 5 min) | warning |
| `HighLatency` | p95 > 2 segundos en alguna ruta | warning |
| `HighNodeCPU` | CPU > 85% por > 10 min | warning |
| `LowNodeMemory` | Memoria disponible < 10% | critical |

### Patrón: Grafana Provisioning

Los dashboards se cargan automáticamente al arrancar Grafana leyendo archivos JSON montados desde ConfigMaps. Esto hace el setup reproducible sin intervención manual.

Configuración en dos pasos:
1. **Datasource provisioning** (`/etc/grafana/provisioning/datasources/`) — define Prometheus como fuente de datos por defecto.
2. **Dashboard provisioning** (`/etc/grafana/provisioning/dashboards/`) — apunta al directorio `/var/lib/grafana/dashboards/` donde están los JSON.

Los JSON de dashboards se montan como ConfigMaps individuales, lo que permite actualizarlos con `kubectl apply` sin reiniciar el pod (Grafana detecta cambios en el directorio).

### Dashboards

| Dashboard | UID | Métricas clave |
|---|---|---|
| Estado General | `delivereats-overview` | Pods running, req/s, error %, reinicios |
| Latencia HTTP | `delivereats-latency` | p50/p95/p99 por ruta, errores por ruta |
| Sistema (Nodos) | `delivereats-system` | CPU %, RAM %, disco %, tráfico de red |

**Fórmulas PromQL importantes:**

```promql
# Percentil 95 de latencia
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)

# Tasa de error
sum(rate(http_errors_total[5m])) by (route)
/ sum(rate(http_requests_total[5m])) by (route)

# CPU del nodo
100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Acceso

- Grafana: `http://delivereats.local/grafana` (admin / admin)
- Prometheus: `http://prometheus.monitoring.svc.cluster.local:9090` (interno)

---

## 6. Gestión de Configuración — Ansible

### Descripción

Ansible configura la VM de load testing de forma automatizada e idempotente. Se puede ejecutar múltiples veces sin efectos secundarios.

### Estructura

```
ansible/
├── ansible.cfg              # remote_user, pipelining, yaml callback
├── inventory/hosts.ini      # IP de la VM (output de Terraform)
├── playbook.yml             # Asigna rol "loadtest" al grupo "loadtest"
└── roles/
    └── loadtest/
        ├── defaults/main.yml   # Variables con valores por defecto
        ├── tasks/main.yml      # 7 tareas idempotentes
        └── files/
            ├── smoke_test.sh   # Copiado a la VM
            └── locustfile.py   # Copiado a la VM
```

### Patrón: Rol de Ansible

Un **rol** encapsula tareas, variables y archivos relacionados a una función específica. El playbook raíz solo declara qué hosts usan qué rol:

```yaml
- name: Configurar VM de Load Testing
  hosts: loadtest
  become: true
  roles:
    - loadtest
```

Esto separa el "qué hosts" (inventario + playbook) del "cómo configurarlos" (rol).

### Idempotencia de cada tarea

| Tarea | Módulo | Mecanismo de idempotencia |
|---|---|---|
| Actualizar cache apt | `apt` | `cache_valid_time: 3600` — no actualiza si tiene < 1h |
| Instalar Python/pip/jq | `apt` | `state: present` — no reinstala si ya existe |
| Crear directorios | `file` | `state: directory` — no falla si ya existe |
| Crear virtualenv | `command` | `creates: venv/bin/activate` — salta si el archivo existe |
| Instalar Locust | `pip` | Compara versión instalada vs requerida |
| Copiar scripts | `copy` | Compara checksum — solo copia si el contenido cambió |
| Verificar Locust | `command` | `changed_when: false` — nunca reporta "changed" |

### Variables configurables

Las variables en `defaults/main.yml` pueden sobreescribirse desde el inventario, el playbook o la línea de comandos:

```yaml
app_base_url: "http://delivereats.local"
tests_dir: "/home/ubuntu/delivereats-tests"
locust_version: "2.20.0"
locust_users: 10
locust_spawn_rate: 2
locust_run_time: "2m"
```

### Ejecución en CI/CD

```yaml
ansible-playbook playbook.yml \
  -i "${{ secrets.LOADTEST_VM_IP }}," \
  -e "app_base_url=http://delivereats.local" \
  --private-key ~/.ssh/id_rsa \
  -u ubuntu
```

La coma después de la IP (`"IP,"`) es la sintaxis de Ansible para un inventario inline de un solo host.

---

## 7. Pruebas — Smoke Test y Carga (Locust)

### Smoke Test

**Archivo:** `tests/smoke/smoke_test.sh`

Script bash que valida el flujo crítico de la aplicación con peticiones HTTP reales.

**Flujo de los 7 checks:**

| Check | Endpoint | Validación |
|---|---|---|
| 1 | `GET /health` | Status 200 |
| 2 | `POST /auth/register` | Status 200 + `success: true` |
| 3 | `POST /auth/login` | Status 200 + token JWT presente |
| 4 | `GET /catalog/restaurants` | Status 200 + al menos 1 restaurante |
| 5 | `GET /catalog/restaurants/:id/products` | Status 200 |
| 6 | `POST /orders` | Status 200 + `success: true` + orderId presente |
| 7 | `GET /orders/:id` | Status 200 + status del pedido presente |

Usa un email único por ejecución (`smoke_<timestamp>@test.com`) para no depender de datos previos.

**Salida:**
- Exit 0 si todos los checks pasan → CI continúa.
- Exit 1 si alguno falla → CI marca el job como fallido.

### Prueba de carga — Locust

**Archivo:** `tests/load/locustfile.py`

Simula usuarios concurrentes navegando y realizando pedidos.

**Clase `DeliverEatsUser`:**

Cada usuario virtual ejecuta `on_start()` una vez (registro + login + carga de datos) y luego alterna entre las tareas según su peso:

| Tarea | Peso | Frecuencia relativa | Descripción |
|---|---|---|---|
| `get_restaurants` | 5 | 42% | Listar restaurantes |
| `get_products` | 4 | 33% | Ver productos |
| `check_my_orders` | 2 | 17% | Ver mis pedidos |
| `create_order` | 1 | 8% | Crear pedido |

Los pesos reflejan el comportamiento real: un usuario ve el catálogo varias veces antes de hacer un pedido.

**Ejecución headless (CI/CD):**

```bash
locust --headless \
       --host http://delivereats.local \
       --users 10 \
       --spawn-rate 2 \
       --run-time 2m \
       --html report.html \
       --locustfile locustfile.py
```

Genera un reporte HTML con: requests totales, fallos, RPS, p50/p95/p99 de latencia.

**Mecanismo de `catch_response`:**

```python
with self.client.get("/catalog/restaurants", catch_response=True) as resp:
    if resp.status_code == 200:
        resp.success()
    else:
        resp.failure(f"Status: {resp.status_code}")
```

`catch_response=True` permite marcar explícitamente un request como éxito o fallo independientemente del status HTTP. Útil para marcar un status 200 con `{"success": false}` como fallo.

---

## 8. Pipeline CI/CD actualizado

### Flujo completo

```
terraform → build → test → push → deploy → ansible → smoke-test
```

| Job | Cuándo corre | Depende de | Qué hace |
|---|---|---|---|
| `terraform` | Siempre | — | fmt-check, validate, plan |
| `build` | Siempre | terraform | Build de 10 imágenes Docker |
| `test` | Siempre | — | Unit tests (3 servicios) |
| `push` | Solo main push | build + test | Re-build y push a Artifact Registry |
| `deploy` | Solo main push | push | Apply K8s manifests + rollout |
| `ansible` | Solo main push | deploy | Provisionar VM de load testing |
| `smoke-test` | Solo main push | ansible | Validar flujo crítico post-deploy |

### Nuevos secrets requeridos

| Secret | Descripción |
|---|---|
| `LOADTEST_VM_IP` | IP pública de la VM (output de `terraform output loadtest_vm_ip`) |
| `LOADTEST_VM_SSH_KEY` | Clave privada SSH para que Ansible conecte a la VM |

### Artefactos del pipeline

El job `smoke-test` sube el último response JSON como artefacto con retención de 7 días, disponible para diagnóstico en caso de fallo.

---

## 9. Patrones de arquitectura y diseño utilizados

### Run-to-Completion (CronJob)
El microservicio `order-cleanup` no expone ningún servidor. Inicia, procesa y termina. Kubernetes gestiona el ciclo de vida via el objeto `CronJob`.

### DaemonSet Pattern (Fluentd, Node Exporter)
Un pod por nodo garantiza cobertura total del cluster sin importar cuántos nodos haya o en cuál de ellos corra cada microservicio.

### Sidecar / Adapter implícito (Fluentd)
Fluentd actúa como adaptador: toma logs en formato arbitrario (stdout plano) y los transforma al formato estructurado que Elasticsearch espera, sin modificar los microservicios.

### Pull-based Metrics (Prometheus)
Prometheus controla el ritmo de recolección. Los servicios solo exponen el endpoint; no saben que Prometheus existe.

### Infrastructure as Code con módulos (Terraform)
Cada componente de infraestructura es un módulo reutilizable con su propia interfaz (variables y outputs). El ensamblado en `main.tf` define el sistema completo de forma declarativa.

### Idempotent Configuration Management (Ansible)
Cada tarea verifica el estado actual antes de actuar. El sistema siempre converge al estado deseado independientemente del estado inicial.

### Anti-corruption Layer — Normalización de rutas (Prometheus)
Las rutas con IDs dinámicos se normalizan antes de ser registradas como labels en las métricas. Sin esto, cada UUID generaría una serie temporal distinta, saturando Prometheus (cardinalidad explosiva).

### Weighted Task Distribution (Locust)
Las tareas de Locust tienen pesos que reflejan el comportamiento real de los usuarios, generando un perfil de carga más realista que un test de round-robin uniforme.

### Optimistic Locking (anti-spam del CronJob)
El UPDATE atómico con condición `WHERE status='PENDING' AND rejection_notified=false` garantiza que en condiciones de concurrencia solo uno de los procesos procesa cada orden, sin locks explícitos de base de datos.

### Provisioning automático (Grafana)
Los dashboards se cargan desde ConfigMaps al arrancar Grafana, haciendo el estado de la herramienta completamente reproducible y versionado en Git.

---

## 10. Decisiones de diseño relevantes

### ¿Por qué namespace separado para ELK y Monitoring?

`logging` y `monitoring` son namespaces separados de `delivereats` para:
- Gestionar recursos y quotas independientemente.
- Aplicar RBAC diferente (los pods de monitoreo necesitan permisos de cluster).
- Poder destruir o actualizar el stack de observabilidad sin afectar la app.

### ¿Por qué Fluentd y no un sidecar de logging por pod?

Un sidecar requeriría modificar cada Deployment para agregar el contenedor de logging. El DaemonSet centraliza la recolección en el nodo, sin modificar los manifests de los microservicios.

### ¿Por qué Cloud Run para el frontend?

El frontend Angular es estático (archivos compilados servidos por nginx). Cloud Run escala a cero cuando no hay tráfico, reduciendo costos. En GKE el Deployment siempre consume al menos 1 réplica activa.

### ¿Por qué SQL Server y no PostgreSQL en Cloud SQL?

El enunciado de la Fase 3 especifica explícitamente "MS SQL Server desplegada fuera del clúster de K8s". Se usa la edición Express (gratuita en licencia) dado que es un entorno académico.

### ¿Por qué `backoffLimit: 2` y no `Never` en el CronJob?

`backoffLimit: 0` (Never) significaría que si el pod falla por un error transitorio (ej. la BD tarda en responder), la orden no se procesa hasta el siguiente ciclo. Con `backoffLimit: 2` se reintenta dos veces antes de marcar el Job como fallido, cubriendo errores transitorios sin crear bucles infinitos.

### ¿Por qué el smoke test usa un email único por timestamp?

Si se usara siempre el mismo email, el segundo run fallaría en el paso de registro (email ya existe). El timestamp garantiza un usuario nuevo en cada ejecución sin necesitar limpiar la base de datos entre runs.

---

## 11. Guía de pruebas paso a paso (GKE — Google Cloud)

Esta sección documenta cómo verificar manualmente que cada componente de la Fase 3 funciona correctamente sobre el cluster de GKE desplegado en GCP mediante Terraform.

### Prerrequisitos

```bash
# Herramientas necesarias instaladas en la máquina local
gcloud   # Google Cloud SDK autenticado con la cuenta del proyecto
kubectl  # v1.28+ (se instala con: gcloud components install kubectl)
curl     # para peticiones HTTP manuales
jq       # para parsear JSON en la terminal
```

```bash
# Autenticarse con GCP
gcloud auth login
gcloud config set project <GCP_PROJECT_ID>
```

### Paso 1 — Conectarse al cluster GKE

```bash
# Obtener las credenciales del cluster (genera el kubeconfig local)
gcloud container clusters get-credentials delivereats-cluster \
  --zone us-central1-a \
  --project <GCP_PROJECT_ID>

# Verificar la conexión
kubectl get nodes
# NAME                                          STATUS   ROLES    AGE
# gke-delivereats-cluster-pool-xxxxx-xxxxxx     Ready    <none>   Xm
# gke-delivereats-cluster-pool-xxxxx-yyyyyy     Ready    <none>   Xm
# gke-delivereats-cluster-pool-xxxxx-zzzzzz     Ready    <none>   Xm
```

### Paso 2 — Obtener la IP externa del Ingress

El Ingress-NGINX ya fue instalado por el pipeline de CI/CD. Obtener su IP pública:

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# NAME                       TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)
# ingress-nginx-controller   LoadBalancer   10.52.X.X     34.X.X.X         80:32080/TCP

# Guardar la IP en una variable para usarla en los comandos siguientes
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Ingress IP: $INGRESS_IP"
```

> **Nota**: Como el Ingress usa el header `Host: delivereats.local` para enrutar las peticiones, se debe incluir ese header en cada `curl`. Alternativamente, agregar `<INGRESS_IP> delivereats.local` al archivo `/etc/hosts` de la máquina local para poder usar el dominio directamente en el navegador.

### Paso 3 — Verificar que la aplicación responde

```bash
# Health check del api-gateway
curl -s -H "Host: delivereats.local" http://$INGRESS_IP/health
# {"status":"ok"}

# Verificar todos los pods del namespace delivereats
kubectl get pods -n delivereats
# NAME                                READY   STATUS      RESTARTS
# api-gateway-xxxxxxxxx-xxxxx         1/1     Running     0
# auth-service-xxxxxxxxx-xxxxx        1/1     Running     0
# catalog-service-xxxxxxxxx-xxxxx     1/1     Running     0
# order-service-xxxxxxxxx-xxxxx       1/1     Running     0
# delivery-service-xxxxxxxxx-xxxxx    1/1     Running     0
# payment-service-xxxxxxxxx-xxxxx     1/1     Running     0
# notification-service-xxxxxxxxx      1/1     Running     0
# fx-service-xxxxxxxxx-xxxxx          1/1     Running     0
# auth-db-0                           1/1     Running     0
# catalog-db-0                        1/1     Running     0
# order-db-0                          1/1     Running     0
# ...
```

### Paso 4 — Verificar el Stack ELK

```bash
# Ver el estado de todos los pods del namespace logging
kubectl get pods -n logging
# NAME                      READY   STATUS    RESTARTS
# elasticsearch-0           1/1     Running   0
# kibana-xxxxxxxxx-xxxxx    1/1     Running   0
# fluentd-xxxxx             1/1     Running   0   ← uno por cada nodo GKE
# fluentd-yyyyy             1/1     Running   0
# fluentd-zzzzz             1/1     Running   0
```

**Verificar que Elasticsearch está sano:**
```bash
# Port-forward para acceder a ES desde la máquina local
kubectl port-forward -n logging svc/elasticsearch 9200:9200

# En otra terminal:
curl http://localhost:9200/_cluster/health?pretty
# Respuesta esperada:
# {
#   "cluster_name" : "docker-cluster",
#   "status" : "yellow",   ← yellow es normal en single-node (sin réplicas)
#   "number_of_nodes" : 1,
#   ...
# }

# Ver los índices creados por Fluentd
curl http://localhost:9200/_cat/indices?v
# health status index                              docs.count
# yellow open   delivereats-api-gateway-2026.04.23     245
# yellow open   delivereats-auth-service-2026.04.23    102
# yellow open   delivereats-order-service-2026.04.23    38
# ...
# Deben aparecer índices separados por cada microservicio
```

**Verificar que Fluentd está enviando logs:**
```bash
kubectl logs -n logging daemonset/fluentd --tail=20

# Mensajes esperados:
# [info]: #0 Connection opened to Elasticsearch
# [info]: #0 fluentd worker is now running worker=0

# Si aparece esto, hay un problema:
# [warn]: #0 failed to flush the buffer. retry_time=X
```

**Acceder a Kibana:**
```bash
# Kibana está expuesto via Ingress en /kibana
# Abrir en el navegador:
http://$INGRESS_IP/kibana
# O si se configuró /etc/hosts:
http://delivereats.local/kibana
```

Pasos para configurar Kibana y ver los logs:
1. Ir a **Management → Stack Management → Data Views**
2. Click en **Create data view**
3. **Name**: `DeliverEats Logs`
4. **Index pattern**: `delivereats-*`
5. **Timestamp field**: `@timestamp`
6. Click **Save data view to Kibana**
7. Ir a **Discover** en el menú lateral
8. Seleccionar la data view `DeliverEats Logs`
9. Los logs de todos los microservicios deben aparecer en tiempo real

**Filtros útiles en Kibana Discover (KQL):**
```
# Ver solo logs de un servicio
kubernetes.labels.app : "auth-service"

# Ver solo logs con errores
log : "ERROR" or message : "ERROR"

# Ver logs de auth-service con error en los últimos 15 min
kubernetes.labels.app : "auth-service" and log : "ERROR"
```

### Paso 5 — Verificar el Stack de Monitoreo

```bash
kubectl get pods -n monitoring
# NAME                                  READY   STATUS
# prometheus-xxxxxxxxx-xxxxx            1/1     Running
# grafana-xxxxxxxxx-xxxxx               1/1     Running
# node-exporter-xxxxx                   1/1     Running   ← uno por nodo GKE
# node-exporter-yyyyy                   1/1     Running
# node-exporter-zzzzz                   1/1     Running
# kube-state-metrics-xxxxxxxxx-xxxxx    1/1     Running
```

**Verificar que Prometheus hace scrape correctamente:**
```bash
# Port-forward a Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Abrir en el navegador: http://localhost:9090/targets
# Todos los targets deben estar en estado "UP":
#   - api-gateway        → http://api-gateway.delivereats:3000/metrics
#   - node-exporter      → http://<node-ip>:9100/metrics
#   - kube-state-metrics → http://kube-state-metrics.monitoring:8080/metrics
#   - prometheus         → http://localhost:9090/metrics (self)
```

**Consultar métricas en PromQL:**
```bash
# En http://localhost:9090 → Graph, escribir estas queries:

# Total de requests al api-gateway
http_requests_total

# Tasa de requests por segundo (últimos 5 min)
rate(http_requests_total[5m])

# Percentil 95 de latencia por ruta
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)

# CPU de los nodos GKE
100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**Acceder a Grafana:**
```bash
# Grafana está expuesto via Ingress en /grafana
http://$INGRESS_IP/grafana
# O: http://delivereats.local/grafana

# Credenciales: admin / admin
```

Los 3 dashboards deben aparecer precargados (provisioning automático desde ConfigMaps):
- **DeliverEats — Estado General**: pods running, req/s, tasa de error, reinicios
- **DeliverEats — Latencia HTTP**: p50/p95/p99 por ruta, errores por ruta
- **DeliverEats — Sistema (Nodos)**: CPU %, RAM %, disco %, tráfico de red de los nodos GKE

Si los dashboards no muestran datos:
1. Ir a **Configuration → Data Sources → Prometheus**
2. La URL debe ser `http://prometheus.monitoring.svc.cluster.local:9090`
3. Click **Save & Test** → debe decir "Data source is working"

### Paso 6 — Insertar datos de prueba (seed)

El seed Job se ejecuta automáticamente en el pipeline de CI/CD. Para ejecutarlo manualmente:

```bash
# Aplicar el Job de seed
kubectl apply -f k8s/jobs/seed-data.yaml

# Esperar a que complete
kubectl wait --for=condition=complete job/seed-data -n delivereats --timeout=60s

# Ver los logs del seed
kubectl logs -n delivereats job/seed-data

# Verificar que los restaurantes existen
kubectl exec -it -n delivereats catalog-db-0 -- \
  psql -U catalog_user -d catalog_db -c "SELECT id, name FROM restaurants;"
```

Si se quiere insertar datos manualmente sin el Job:

```bash
kubectl exec -it -n delivereats catalog-db-0 -- psql -U catalog_user -d catalog_db -c "
INSERT INTO restaurants (id, name, description, address, phone, category, is_active, owner_id)
VALUES
  ('99999999-9999-9999-9999-999999999999', 'Restaurante Central', 'Comida guatemalteca', 'Zona 1', '22222222', 'GUATEMALTECA', true, '00000000-0000-0000-0000-000000000001'),
  ('88888888-8888-8888-8888-888888888888', 'Pizzeria Italia', 'Pizzas artesanales', 'Zona 4', '33333333', 'ITALIANA', true, '00000000-0000-0000-0000-000000000002'),
  ('77777777-7777-7777-7777-777777777777', 'Burger House', 'Hamburguesas gourmet', 'Zona 10', '44444444', 'AMERICANA', true, '00000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;"
```

### Paso 7 — Verificar el CronJob manualmente

```bash
# Ver el estado del CronJob
kubectl get cronjobs -n delivereats
# NAME            SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
# order-cleanup   */5 * * * *   False     0        2m ago          1d

# Ver el historial de Jobs creados por el CronJob
kubectl get jobs -n delivereats
# NAME                       COMPLETIONS   DURATION   AGE
# order-cleanup-1745450400   1/1           8s         5m

# Disparar manualmente un Job del CronJob (sin esperar el schedule)
kubectl create job --from=cronjob/order-cleanup order-cleanup-test -n delivereats

# Ver el pod que se creó
kubectl get pods -n delivereats | grep order-cleanup-test
# order-cleanup-test-xxxxx   0/1   Completed   0   15s

# Ver los logs del run
kubectl logs -n delivereats job/order-cleanup-test
# [order-cleanup] Iniciando — verificando órdenes PENDING > 60 min
# [order-cleanup] 0 órdenes procesadas, 0 emails enviados, 0 errores
# [order-cleanup] Completado.

# Limpiar el job de prueba
kubectl delete job order-cleanup-test -n delivereats
```

**Probar el flujo completo de rechazo automático:**

```bash
# 1. Registrar un usuario y hacer login para obtener token
TOKEN=$(curl -s -X POST -H "Host: delivereats.local" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@prueba.com","password":"Test1234!","name":"Usuario Prueba"}' \
  http://$INGRESS_IP/auth/register | jq -r '.data.token // empty')

# Si ya existe el usuario, hacer login:
TOKEN=$(curl -s -X POST -H "Host: delivereats.local" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@prueba.com","password":"Test1234!"}' \
  http://$INGRESS_IP/auth/login | jq -r '.data.token')

echo "Token: $TOKEN"

# 2. Crear una orden
ORDER_ID=$(curl -s -X POST -H "Host: delivereats.local" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"restaurantId":"99999999-9999-9999-9999-999999999999","items":[{"productId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","quantity":1}]}' \
  http://$INGRESS_IP/orders | jq -r '.data.orderId')

echo "Order ID: $ORDER_ID"

# 3. Retroceder la fecha de la orden para simular 1h+ de espera
kubectl exec -it -n delivereats order-db-0 -- psql -U order_user -d order_db -c "
UPDATE orders SET created_at = NOW() - INTERVAL '61 minutes'
WHERE status = 'PENDING';"

# 4. Disparar el CronJob manualmente
kubectl create job --from=cronjob/order-cleanup order-cleanup-manual -n delivereats

# 5. Esperar a que termine
kubectl wait --for=condition=complete job/order-cleanup-manual -n delivereats --timeout=60s

# 6. Ver los logs
kubectl logs -n delivereats job/order-cleanup-manual
# Esperado: "1 órdenes procesadas, 1 emails enviados, 0 errores"

# 7. Verificar que la orden cambió a CANCELLED y rejection_notified=true
kubectl exec -it -n delivereats order-db-0 -- psql -U order_user -d order_db -c "
SELECT id, status, rejection_notified FROM orders WHERE id='$ORDER_ID';"
# id | status    | rejection_notified
# ...| CANCELLED | t

# 8. Limpiar
kubectl delete job order-cleanup-manual -n delivereats
```

### Paso 8 — Ejecutar el Smoke Test manualmente

El smoke test se ejecuta automáticamente en el pipeline de CI/CD. Para ejecutarlo a mano:

```bash
# Obtener la IP del Ingress (si no está en la variable)
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Ejecutar el smoke test
chmod +x tests/smoke/smoke_test.sh
INGRESS_IP=$INGRESS_IP bash tests/smoke/smoke_test.sh

# Salida esperada:
# [CHECK 1] Health check... OK
# [CHECK 2] Registro de usuario... OK
# [CHECK 3] Login... OK
# [CHECK 4] Listar restaurantes... OK (3 restaurantes)
# [CHECK 5] Productos de restaurante... OK
# [CHECK 6] Crear pedido... OK (orderId: xxxx-xxxx)
# [CHECK 7] Consultar pedido... OK (status: PENDING)
# ✔ Todos los checks pasaron (7/7)
```

Si algún check falla, ver los logs del pod correspondiente:
```bash
# Si falla el check de auth:
kubectl logs -n delivereats deployment/auth-service --tail=30

# Si falla el check de catalog:
kubectl logs -n delivereats deployment/catalog-service --tail=30
```

### Paso 9 — Ejecutar la prueba de carga con Locust

Locust se ejecuta desde la VM de load testing que fue provisionada por Terraform y configurada por Ansible. Para ejecutarlo:

**Opción A — Desde la VM de load testing (vía SSH):**
```bash
# Obtener la IP de la VM (output de Terraform)
LOADTEST_VM_IP=$(cd terraform && terraform output -raw loadtest_vm_ip)

# Conectarse a la VM
ssh -i ~/.ssh/id_rsa ubuntu@$LOADTEST_VM_IP

# Dentro de la VM, activar el virtualenv y ejecutar Locust
cd /home/ubuntu/delivereats-tests
source venv/bin/activate

# Modo headless (genera reporte HTML)
locust --headless \
       --host http://<INGRESS_IP> \
       --users 10 \
       --spawn-rate 2 \
       --run-time 2m \
       --html report.html \
       --locustfile locustfile.py

# Ver el reporte
cat report.html | grep -A5 "Statistics"
```

**Opción B — Desde la máquina local (si Locust está instalado):**
```bash
pip install locust==2.20.0

# Modo UI (abre un dashboard en el navegador)
locust --host http://$INGRESS_IP \
       --locustfile tests/load/locustfile.py

# Abrir: http://localhost:8089
# Configurar: Number of users: 10, Spawn rate: 2
# Click "Start swarming"
# Observar RPS, latencia p50/p95/p99 y tasa de fallos (debe ser 0%)
```

**Métricas que se deben observar en el reporte:**
| Métrica | Valor esperado |
|---|---|
| Requests/sec (RPS) | > 5 req/s con 10 usuarios |
| Tasa de fallos | 0% |
| Latencia p50 | < 500ms |
| Latencia p95 | < 2000ms |

### Paso 10 — Verificar alertas en Prometheus

```bash
# Con port-forward a Prometheus activo (kubectl port-forward ... 9090:9090)
# Abrir: http://localhost:9090/alerts

# Para probar la alerta PodDown:
kubectl scale deployment api-gateway --replicas=0 -n delivereats
# Esperar ~2 minutos → en /alerts debe aparecer "PodDown" en estado FIRING

# Restaurar:
kubectl scale deployment api-gateway --replicas=1 -n delivereats
```

### Resumen de URLs de acceso en GKE

| Servicio | URL | Credenciales |
|---|---|---|
| API Gateway | `http://<INGRESS_IP>/` (con header `Host: delivereats.local`) | — |
| Kibana | `http://<INGRESS_IP>/kibana` | Sin auth |
| Grafana | `http://<INGRESS_IP>/grafana` | admin / admin |
| Prometheus | `kubectl port-forward -n monitoring svc/prometheus 9090:9090` → `http://localhost:9090` | Sin auth |
| Elasticsearch | `kubectl port-forward -n logging svc/elasticsearch 9200:9200` → `http://localhost:9200` | Sin auth |

> Prometheus y Elasticsearch no están expuestos via Ingress (son internos al cluster). Se accede a ellos con `port-forward` desde la máquina local.

---

## 12. Teoría extendida — Conceptos clave de cada componente

### 12.1 Kubernetes CronJob y el patrón Job

**¿Qué es un Job en Kubernetes?**

Un `Job` es un objeto de Kubernetes que garantiza que uno o más pods ejecuten una tarea hasta completarla exitosamente. A diferencia de un `Deployment` (que mantiene pods corriendo indefinidamente), un Job termina cuando el pod sale con código 0.

Un `CronJob` es un controlador que crea Jobs según un schedule definido en formato cron estándar:

```
┌─ minuto (0-59)
│ ┌─ hora (0-23)
│ │ ┌─ día del mes (1-31)
│ │ │ ┌─ mes (1-12)
│ │ │ │ ┌─ día de semana (0-6, 0=domingo)
│ │ │ │ │
* * * * *
```

`*/5 * * * *` = cada 5 minutos.

**¿Qué es `concurrencyPolicy: Forbid`?**

Si el Job tarda más de 5 minutos (más que el intervalo del schedule), Kubernetes tiene tres opciones:
- `Allow`: lanza otro Job en paralelo (peligroso — dos instancias procesando las mismas órdenes).
- `Forbid`: salta el siguiente disparo si el actual sigue corriendo (solución elegida).
- `Replace`: cancela el Job actual y lanza uno nuevo.

`Forbid` es la opción más segura para tareas de mantenimiento que no deben ejecutarse en paralelo.

**`restartPolicy: OnFailure` vs `Never`**

- `Never`: si el pod falla, no se reinicia; Kubernetes crea un pod nuevo (hasta `backoffLimit`).
- `OnFailure`: si el contenedor falla, se reinicia en el mismo pod.

Se usa `OnFailure` para Jobs: evita la proliferación de pods fallidos en el historial.

---

### 12.2 Elasticsearch — Motor de búsqueda y análisis de logs

**¿Qué es Elasticsearch?**

Elasticsearch (ES) es un motor de búsqueda y análisis distribuido basado en Apache Lucene. Para el caso de centralización de logs:

- **Indexación invertida**: almacena qué documentos contienen cada término. Esto permite buscar "ERROR" en millones de logs en milisegundos.
- **Documentos JSON**: cada log es un documento JSON con campos como `message`, `@timestamp`, `kubernetes.pod_name`.
- **Índices**: agrupación lógica de documentos. Se usa un índice por microservicio y por día (`delivereats-auth-service-2026.04.23`).
- **Shard**: partición de un índice. Con un solo nodo hay un shard por índice (sin réplicas).

**¿Por qué StatefulSet y no Deployment?**

Los `Deployments` tratan los pods como intercambiables: si un pod muere, se crea uno nuevo con un nombre y IP distintos. Elasticsearch requiere:

1. **Identidad de red estable**: el nombre DNS `elasticsearch-0.elasticsearch` siempre resuelve al mismo pod. Esto es crítico para el descubrimiento entre nodos del cluster ES.
2. **Almacenamiento pegado al pod**: el PVC `es-data` se asocia permanentemente a `elasticsearch-0`. Si el pod muere y se recrea, monta exactamente el mismo volumen con los datos existentes.

Los `StatefulSets` garantizan ambas propiedades.

**`node.store.allow_mmap=false`**

Por defecto, ES usa `mmap` (memory-mapped files) para acceder a los índices en disco. `mmap` requiere que `vm.max_map_count=262144` esté configurado en el kernel del nodo. En GKE, cambiar este parámetro requiere un `initContainer` privilegiado, que GKE no permite en todos los modos.

Con `node.store.allow_mmap=false`, ES usa `nio` (Java NIO) para acceder a disco. Es ligeramente más lento pero no requiere permisos especiales del nodo.

**Formato de índice `logstash_format`**

Fluentd usa el plugin `fluent-plugin-elasticsearch` en modo `logstash_format`. Esto:
1. Agrega el campo `@timestamp` con la hora del log.
2. Nombra el índice como `<prefix>-YYYY.MM.DD` (rotación diaria automática).
3. No requiere configurar mappings explícitos — ES infiere los tipos.

---

### 12.3 Fluentd — Recolector y procesador de logs

**¿Cómo funciona el pipeline de Fluentd?**

Fluentd procesa logs mediante una cadena de plugins organizados en directivas:

```
<source>  →  <filter>  →  <filter>  →  <match>
 input        transform    transform    output
```

Cada registro (evento) tiene:
- **Tag**: identificador del flujo (ej. `kubernetes.var.log.containers.auth-service_...`).
- **Time**: timestamp del evento.
- **Record**: el objeto JSON con los campos del log.

**Plugin `kubernetes_metadata`**

Este plugin intercepta cada evento con tag `kubernetes.**` y hace una llamada a la API de Kubernetes para enriquecer el record con:
```json
{
  "kubernetes": {
    "namespace_name": "delivereats",
    "pod_name": "auth-service-abc123-xyz",
    "container_name": "auth-service",
    "labels": { "app": "auth-service", "version": "1.0" }
  }
}
```
Esto permite filtrar y enrutar logs basándose en metadata de Kubernetes sin que los microservicios hagan nada especial.

**Plugin `rewrite_tag_filter`**

Cambia el tag del evento basándose en el valor de un campo del record. Se usa para enrutar:
- `kubernetes.**` con `label.app=auth-service` → tag `delivereats.auth-service`
- `kubernetes.**` con `label.app=order-service` → tag `delivereats.order-service`

Una vez reescrito el tag, el evento pasa al bloque `<match>` correspondiente.

**Parser CRI (Container Runtime Interface)**

GKE con `containerd` escribe los logs de contenedores en formato CRI, no en JSON:

```
2026-04-23T10:15:30.123456789Z stdout F {"message":"Server started","port":3000}
│                              │      │ └─ contenido del log
│                              │      └─ F=full line, P=partial
│                              └─ stream (stdout/stderr)
└─ timestamp ISO8601
```

El parser `regexp` extrae estos campos con la expresión:
```
/^(?<time>.+) (?<stream>stdout|stderr) (?<logtag>[^ ]*) (?<log>.*)$/
```

Si se usara `@type json` como parser, fallaría porque el wrapping CRI es texto plano, no JSON.

**Buffer en disco**

El buffer evita pérdida de logs cuando Elasticsearch no está disponible:
1. Fluentd recibe un log → lo escribe en un archivo de buffer en disco.
2. Cada 5 segundos (`flush_interval`) intenta enviar el buffer a ES.
3. Si falla, espera con backoff exponencial (1s, 2s, 4s... hasta 30s).
4. El buffer sobrevive reinicios del pod de Fluentd (el archivo está en el nodo).

---

### 12.4 Kibana — Visualización de logs

**¿Qué es un Data View (antes llamado Index Pattern)?**

Para que Kibana pueda mostrar logs, necesita saber en qué índices buscar y cuál campo usar como timestamp. El Data View `delivereats-*` le indica a Kibana:
- Buscar en todos los índices que empiecen con `delivereats-` (wildcard `*`).
- Usar `@timestamp` como el campo de tiempo para el filtro temporal.

**Discover vs Dashboard**

- **Discover**: exploración libre de logs. Se puede filtrar por tiempo, buscar texto, ver campos individuales. Equivalente a hacer `grep` pero con UI.
- **Dashboard**: conjunto de visualizaciones fijas. Gráficas de barras, tablas, métricas calculadas. Útil para monitoreo continuo.

**Lenguaje de consulta KQL (Kibana Query Language)**

```
# Logs de un servicio específico
kubernetes.labels.app : "auth-service"

# Logs con nivel ERROR
log : "ERROR" or message : "ERROR"

# Logs de auth-service con ERROR en los últimos 15 minutos
kubernetes.labels.app : "auth-service" and log : "ERROR"
```

---

### 12.5 Prometheus — Sistema de métricas

**Modelo de datos: series temporales**

Prometheus almacena métricas como series temporales: cada combinación única de nombre de métrica + labels es una serie independiente.

```
http_requests_total{method="GET", route="/catalog/restaurants", status_code="200"}  → 1547
http_requests_total{method="POST", route="/orders", status_code="201"}              → 89
http_requests_total{method="POST", route="/orders", status_code="500"}              → 3
```

Cada serie tiene múltiples muestras (samples) a lo largo del tiempo, separadas por el intervalo de scrape (15s).

**Tipos de métricas**

| Tipo | Descripción | Ejemplo |
|---|---|---|
| **Counter** | Solo sube, se resetea al reiniciar | `http_requests_total` |
| **Gauge** | Sube y baja | `memory_used_bytes` |
| **Histogram** | Distribución de valores en buckets | `http_request_duration_seconds` |
| **Summary** | Percentiles precalculados | (menos común) |

**¿Por qué Histogram para latencia?**

Un Histogram almacena:
- `_count`: total de observaciones.
- `_sum`: suma de todos los valores.
- `_bucket{le="0.1"}`: observaciones <= 100ms.
- `_bucket{le="0.5"}`: observaciones <= 500ms.
- etc.

Con estos buckets, `histogram_quantile(0.95, ...)` calcula el percentil 95 **al momento de la consulta** en PromQL, sin necesidad de almacenar todos los valores individuales.

**PromQL — Lenguaje de consulta**

```promql
# Rate: tasa de requests por segundo (últimos 5 minutos)
rate(http_requests_total[5m])

# Tasa de error por ruta
sum(rate(http_errors_total[5m])) by (route)
/ sum(rate(http_requests_total[5m])) by (route)

# CPU del nodo: 100% menos el % idle
100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memoria disponible en MB
node_memory_MemAvailable_bytes / 1024 / 1024
```

**`[5m]` — Ventana de tiempo**

El rango selector `[5m]` le dice a Prometheus que tome todas las muestras de los últimos 5 minutos para calcular la función `rate()`. Un rango más corto es más reactivo pero más ruidoso; uno más largo es más estable pero tarda en detectar cambios.

---

### 12.6 Grafana — Dashboards y alertas visuales

**Provisioning automático**

Grafana puede ser configurado 100% vía archivos YAML y JSON sin intervención manual:

```
/etc/grafana/provisioning/
├── datasources/
│   └── prometheus.yaml     ← Define la conexión a Prometheus
└── dashboards/
    └── provider.yaml        ← Indica dónde están los JSON de dashboards

/var/lib/grafana/dashboards/
├── overview.json            ← Dashboard "Estado General"
├── latency.json             ← Dashboard "Latencia HTTP"
└── system.json              ← Dashboard "Sistema (Nodos)"
```

Al iniciar Grafana, lee estos archivos y configura todo automáticamente. Los ConfigMaps de Kubernetes montan estos archivos en el pod.

**Variables en dashboards**

Los dashboards de Grafana soportan variables que actúan como filtros dinámicos. Por ejemplo, una variable `$namespace` permite seleccionar el namespace de Kubernetes desde un dropdown, y todas las queries del dashboard se actualizan automáticamente.

---

### 12.7 Terraform — Infraestructura como Código

**Estado de Terraform (`tfstate`)**

Terraform mantiene un archivo de estado que mapea los recursos declarados en el código a los recursos reales en GCP. Este estado es la "fuente de verdad" de Terraform.

- **Sin estado**: Terraform no sabría qué recursos ya existen y los volvería a crear.
- **Estado local**: riesgo de pérdida; no compartible con el equipo.
- **Estado en GCS**: compartido, con bloqueo para evitar modificaciones concurrentes, con historial de versiones.

**Ciclo de vida: init → plan → apply**

```
terraform init    # Descarga providers y módulos; conecta al backend GCS
terraform plan    # Lee tfstate + consulta GCP; muestra qué va a crear/modificar/destruir
terraform apply   # Ejecuta el plan; actualiza tfstate
terraform destroy # Elimina todos los recursos; actualiza tfstate
```

**`depends_on` explícito vs implícito**

Terraform detecta dependencias automáticamente cuando un output de un recurso se usa como input de otro. Pero a veces la dependencia existe sin referencias directas (ej. GKE necesita que la VPC exista aunque no referencie su ID). En esos casos se usa `depends_on` explícito.

**Workload Identity vs JSON Key**

Las GitHub Actions necesitan autenticarse con GCP para ejecutar `terraform apply` y `kubectl`. Hay dos formas:

- **JSON Key**: se descarga una clave de Service Account y se guarda en GitHub Secrets. Riesgo: si se filtra la clave, el atacante tiene acceso indefinido.
- **Workload Identity Federation**: GitHub Actions presenta un token OIDC de GitHub; GCP lo valida y emite credenciales temporales de corta duración. No hay secreto persistente que pueda filtrarse.

---

### 12.8 Ansible — Gestión de Configuración

**Push vs Pull**

Ansible usa modelo **push**: desde la máquina de control (CI/CD) se conecta por SSH a los hosts remotos y ejecuta las tareas. El host remoto no necesita tener Ansible instalado.

Alternativas de modelo pull (ej. Chef, Puppet) requieren un agente corriendo en cada host que consulta un servidor central. Ansible es más simple de instalar pero requiere acceso SSH.

**Idempotencia en detalle**

Una tarea idempotente produce el mismo resultado sin importar cuántas veces se ejecute:

```yaml
# NO idempotente: agrega la línea cada vez que se ejecuta
- name: Agregar PATH
  lineinfile:
    path: /etc/profile
    line: 'export PATH=$PATH:/usr/local/bin'
  # → si se corre 3 veces, la línea aparece 3 veces

# SÍ idempotente: verifica que la línea exista, la agrega solo si no está
- name: Agregar PATH
  lineinfile:
    path: /etc/profile
    line: 'export PATH=$PATH:/usr/local/bin'
    state: present
  # → el módulo lineinfile ya maneja esto internamente
```

El módulo `apt` con `state: present` nunca reinstala un paquete que ya está instalado. El módulo `pip` verifica la versión antes de instalar.

**Inventario inline**

```bash
ansible-playbook playbook.yml -i "1.2.3.4,"
```

La coma al final de la IP es la sintaxis para un inventario inline de un solo host. Sin la coma, Ansible lo interpretaría como un nombre de archivo de inventario.

---

### 12.9 Locust — Pruebas de carga

**¿Qué mide una prueba de carga?**

- **Throughput (RPS)**: cuántos requests por segundo puede manejar el sistema.
- **Latencia bajo carga**: el sistema puede ser rápido con 1 usuario pero lento con 100.
- **Punto de quiebre**: a cuántos usuarios concurrentes el sistema comienza a fallar.
- **Comportamiento de recuperación**: ¿el sistema se recupera cuando la carga baja?

**Percentiles de latencia**

- **p50 (mediana)**: el 50% de los requests fue más rápido que este valor.
- **p95**: el 95% fue más rápido. Los 5% más lentos superan este valor.
- **p99**: el 99% fue más rápido. Solo el 1% más lento supera este valor.

En producción se monitorea el p95 y p99 porque representan la experiencia del usuario más exigente. Un p50 de 100ms con un p99 de 5000ms indica que hay casos extremos muy lentos.

**Spawn rate vs usuarios totales**

- **Users (usuarios totales)**: número final de usuarios virtuales concurrentes.
- **Spawn rate**: cuántos usuarios se agregan por segundo hasta llegar al total.

Con `--users 10 --spawn-rate 2`: Locust arranca, y cada segundo agrega 2 usuarios hasta llegar a 10 (después de 5 segundos todos los usuarios están activos). Esto simula una llegada gradual de usuarios en lugar de una carga instantánea.

**`on_start()` en Locust**

El método `on_start()` se ejecuta una vez cuando el usuario virtual "nace". Es el lugar para hacer login y guardar el token, evitando que cada tarea deba autenticarse individualmente. El token se guarda en `self.token` y se reutiliza en todas las tareas del mismo usuario virtual.
