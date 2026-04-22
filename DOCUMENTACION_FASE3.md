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
