# DeliverEats — Errores y Soluciones — Fase 3

Registro completo de todos los errores encontrados durante la implementación y despliegue de la Fase 3, con la causa raíz y la solución aplicada.

---

## Índice

1. [Fluentd — Parser incompatible con containerd (GKE)](#1-fluentd--parser-incompatible-con-containerd-gke)
2. [Fluentd — Todos los logs iban a un solo índice en Elasticsearch](#2-fluentd--todos-los-logs-iban-a-un-solo-índice-en-elasticsearch)
3. [Fluentd — OOMKilled (falta de memoria)](#3-fluentd--oomkilled-falta-de-memoria)
4. [Fluentd — Buffer con `timekey` no configurado](#4-fluentd--buffer-con-timekey-no-configurado)
5. [Kibana — No servía correctamente en la ruta /kibana](#5-kibana--no-servía-correctamente-en-la-ruta-kibana)
6. [Elasticsearch — Requiere vm.max_map_count alto (privilegios de nodo)](#6-elasticsearch--requiere-vmmax_map_count-alto-privilegios-de-nodo)
7. [Elasticsearch / Prometheus — Pods en CrashLoopBackOff por permisos de filesystem](#7-elasticsearch--prometheus--pods-en-crashloopbackoff-por-permisos-de-filesystem)
8. [Elasticsearch / Prometheus — Recursos insuficientes en Minikube](#8-elasticsearch--prometheus--recursos-insuficientes-en-minikube)
9. [Smoke Test — Peticiones al Ingress sin header Host fallan](#9-smoke-test--peticiones-al-ingress-sin-header-host-fallan)
10. [Smoke Test — Fallo por falta de datos de prueba (restaurantes)](#10-smoke-test--fallo-por-falta-de-datos-de-prueba-restaurantes)
11. [Seed Job — Columnas incorrectas en el INSERT](#11-seed-job--columnas-incorrectas-en-el-insert)
12. [CI/CD — Smoke test corría antes de que los pods estuvieran listos](#12-cicd--smoke-test-corría-antes-de-que-los-pods-estuvieran-listos)
13. [Terraform — Backend GCS sin credenciales en CI](#13-terraform--backend-gcs-sin-credenciales-en-ci)
14. [Terraform — Fallos de `terraform fmt` en CI](#14-terraform--fallos-de-terraform-fmt-en-ci)
15. [Terraform — Quota insuficiente de PD-SSD en GKE](#15-terraform--quota-insuficiente-de-pd-ssd-en-gke)
16. [Terraform — Cloud SQL SQL Server requiere `root_password`](#16-terraform--cloud-sql-sql-server-requiere-root_password)
17. [Terraform — Atributo `enable_private_path_for_google_cloud_services` no soportado en SQL Server](#17-terraform--atributo-enable_private_path_for_google_cloud_services-no-soportado-en-sql-server)
18. [Fluentd — ClusterRole insuficiente para el SA de CI/CD](#18-fluentd--clusterrole-insuficiente-para-el-sa-de-cicd)
19. [CI/CD — GKE no existía cuando se ejecutaba deploy (terraform apply faltaba)](#19-cicd--gke-no-existía-cuando-se-ejecutaba-deploy-terraform-apply-faltaba)

---

## 1. Fluentd — Parser incompatible con containerd (GKE)

**Commit de fix:** `5c4feff8`

### Síntoma

Fluentd arrancaba pero no enviaba logs a Elasticsearch. En los logs del pod de Fluentd aparecía:

```
[error] failed to parse log: invalid byte in literal null value (expecting 'u')
```

Los índices `delivereats-*` nunca se creaban en Elasticsearch.

### Causa raíz

La configuración inicial usaba `@type json` como parser para leer los archivos `/var/log/containers/*.log`:

```xml
<parse>
  @type json
</parse>
```

Esto funciona en clústeres con Docker como runtime (Docker envuelve los logs en JSON: `{"log":"mensaje\n","stream":"stdout","time":"..."}`).

GKE usa **containerd** como container runtime desde Kubernetes 1.24+. Containerd escribe los logs en formato **CRI (Container Runtime Interface)**:

```
2026-04-23T10:15:30.123456789Z stdout F {"message":"Server started"}
```

El formato CRI es texto plano con 4 campos separados por espacios: timestamp, stream, flag (F=full/P=partial), contenido. Al intentar parsear esto como JSON, Fluentd fallaba en el primer carácter (`2` de la fecha).

### Solución

Cambiar el parser a `@type regexp` con una expresión regular que capture los 4 campos del formato CRI:

```xml
<parse>
  @type regexp
  expression /^(?<time>.+) (?<stream>stdout|stderr) (?<logtag>[^ ]*) (?<log>.*)$/
  time_format %Y-%m-%dT%H:%M:%S.%NZ
</parse>
```

- `(?<time>.+)` → captura el timestamp ISO8601.
- `(?<stream>stdout|stderr)` → captura el stream.
- `(?<logtag>[^ ]*)` → captura el flag CRI (F o P).
- `(?<log>.*)` → captura el contenido real del log (que puede ser JSON o texto plano).

---

## 2. Fluentd — Todos los logs iban a un solo índice en Elasticsearch

**Commits de fix:** `11a3d4b4`, `41eb556d`

### Síntoma

Todos los logs aparecían en Kibana bajo un único índice (`delivereats-YYYY.MM.DD`) en lugar de índices separados por microservicio (`delivereats-auth-service-YYYY.MM.DD`, etc.).

### Causa raíz (intento 1)

Se intentó usar un único bloque `<match>` con `logstash_prefix_key` apuntando a un campo del record:

```xml
<match delivereats.**>
  @type elasticsearch
  logstash_format true
  logstash_prefix_key $.kubernetes.labels.app
</match>
```

El problema: `logstash_prefix_key` espera que el campo exista en el nivel raíz del record. El campo `$.kubernetes.labels.app` está anidado y el plugin no lo resolvía correctamente, usando el prefijo por defecto (`logstash`) para todos los registros.

Se intentó también `record_transformer` para copiar el label al nivel raíz:

```xml
<filter delivereats.**>
  @type record_transformer
  <record>
    service_name ${record.dig("kubernetes", "labels", "app") || "unknown"}
  </record>
</filter>
```

Esto añadía el campo pero el plugin de ES aún no lo usaba como prefijo correctamente.

### Causa raíz (real)

El plugin `fluent-plugin-elasticsearch` v5.x cambió el comportamiento de `logstash_prefix_key`: el campo debe estar en el nivel raíz Y no puede ser una ruta anidada con `$.`. La documentación del plugin para la versión usada no especificaba esto claramente.

### Solución

Usar un bloque `<match>` separado para cada microservicio, cada uno con su propio `logstash_prefix` hardcodeado:

```xml
<match delivereats.api-gateway>
  @type elasticsearch
  logstash_format true
  logstash_prefix delivereats-api-gateway
  logstash_dateformat %Y.%m.%d
  ...
</match>

<match delivereats.auth-service>
  @type elasticsearch
  logstash_format true
  logstash_prefix delivereats-auth-service
  ...
</match>
```

El flujo completo: el bloque `<match kubernetes.**>` con `rewrite_tag_filter` asigna un tag específico a cada microservicio (`delivereats.auth-service`, `delivereats.order-service`, etc.). Luego cada bloque `<match delivereats.X>` captura exactamente ese tag y usa su propio prefijo.

Esto es más verboso pero completamente determinístico: no hay ambigüedad sobre a qué índice va cada log.

---

## 3. Fluentd — OOMKilled (falta de memoria)

**Commit de fix:** `89dd52ff`

### Síntoma

El pod de Fluentd era terminado por Kubernetes con estado `OOMKilled`:

```
kubectl get pods -n logging
NAME           READY   STATUS      RESTARTS   AGE
fluentd-xxxxx  0/1     OOMKilled   5          10m
```

Los logs de Fluentd mostraban que el buffer en memoria crecía sin parar antes del kill.

### Causa raíz

El límite de memoria original era `200Mi`. Con el volumen de logs de 9 microservicios + el buffer en disco (que Fluentd carga parcialmente en memoria para procesar), más el overhead de Ruby (el runtime de Fluentd), 200Mi era insuficiente.

El buffer `overflow_action: block` hacía que Fluentd bloqueara la ingesta de nuevos logs en lugar de descartarlos, acumulando registros en memoria mientras Elasticsearch tardaba en responder.

### Solución

Aumentar los límites de memoria:

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"    # era 128Mi
  limits:
    cpu: "500m"
    memory: "600Mi"    # era 200Mi
```

Con 600Mi Fluentd tiene suficiente espacio para el buffer en memoria, el heap de Ruby y el procesamiento de logs concurrentes de todos los microservicios.

---

## 4. Fluentd — Buffer con `timekey` no configurado

**Commit de fix:** `cce39355`

### Síntoma

El pod de Fluentd arrancaba pero mostraba el warning:

```
[warn] 'time' is specified in buffer's <chunk> keys without 'timekey'
```

Los logs aún se enviaban pero con latencia variable.

### Causa raíz

El buffer del bloque `<match>` final tenía configurado:

```xml
<buffer tag, time>
  @type file
  ...
</buffer>
```

Al incluir `time` como key del buffer, Fluentd espera que también esté configurado `timekey` (que define el tamaño de la ventana de tiempo para agrupar chunks). Sin `timekey`, Fluentd no sabía cómo agrupar por tiempo y emitía el warning.

### Solución

Quitar `time` como key del buffer. Solo se necesita `tag` para agrupar los chunks por destino:

```xml
<buffer tag>
  @type file
  ...
</buffer>
```

`timekey` solo es necesario si se quiere hacer rotación de archivos de buffer por ventana de tiempo, lo cual no es necesario aquí porque Elasticsearch ya maneja la rotación diaria de índices.

---

## 5. Kibana — No servía correctamente en la ruta /kibana

**Commit de fix:** `7b31c1bd`

### Síntoma

Al acceder a `http://delivereats.local/kibana`, el navegador mostraba un error 404 o una página en blanco. Los assets de Kibana (JS, CSS) fallaban con 404 porque apuntaban a rutas relativas como `/bundles/...` en lugar de `/kibana/bundles/...`.

### Causa raíz

Se había configurado el Ingress con `rewrite-target` para quitar el prefijo `/kibana` antes de enviar la petición a Kibana:

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
path: /kibana(/|$)(.*)
```

Con este rewrite, cuando el navegador pedía `/kibana`, el Ingress enviaba `/` a Kibana. Kibana recibía la petición en `/` y renderizaba la página, pero los links internos de Kibana apuntaban a `/bundles/...` (sin el prefijo `/kibana`). El Ingress no sabía enrutar `/bundles/...` a Kibana y retornaba 404.

Además, se había quitado la configuración de `SERVER_BASEPATH` en Kibana, lo que hacía que Kibana no supiera que estaba detrás de un subpath.

### Solución

**No usar rewrite en el Ingress.** Configurar en Kibana que él mismo maneje el basepath:

```yaml
# En el Deployment de Kibana:
env:
  - name: SERVER_BASEPATH
    value: "/kibana"
  - name: SERVER_REWRITEBASEPATH
    value: "true"
```

```yaml
# En el Ingress: sin rewrite, solo Prefix
path: /kibana
pathType: Prefix
```

Con `SERVER_BASEPATH=/kibana` y `SERVER_REWRITEBASEPATH=true`:
- Kibana sabe que está montado en `/kibana`.
- Genera todos sus links internos con el prefijo `/kibana/`.
- El Ingress reenvía `/kibana/*` a Kibana sin modificar la ruta.
- Kibana recibe `/kibana/bundles/...` y sirve el asset correctamente.

---

## 6. Elasticsearch — Requiere vm.max_map_count alto (privilegios de nodo)

**Commits de fix:** `64a9553f`, `6ed2774f`

### Síntoma

El pod de Elasticsearch entraba en `CrashLoopBackOff` con el siguiente error en los logs:

```
ERROR: [1] bootstrap checks failed.
bootstrap check failure [1] of [1]: max virtual memory areas
vm.max_map_count [65530] is too low, increase to at least [262144]
```

### Causa raíz

Elasticsearch usa `mmap` (memory-mapped files) para acceder a sus índices en disco. `mmap` requiere que el kernel del nodo tenga `vm.max_map_count >= 262144`. El valor por defecto en Linux es `65530`.

La solución habitual es un `initContainer` que ejecuta:
```bash
sysctl -w vm.max_map_count=262144
```

Pero este comando requiere que el `initContainer` corra como `privileged: true`, y GKE Standard (en ciertos modos) puede rechazar contenedores privilegiados por políticas de seguridad del cluster (PodSecurityPolicy / PodSecurity Admission).

### Solución

Configurar Elasticsearch para no usar `mmap` y en su lugar usar el store `nio` de Java:

```yaml
env:
  - name: node.store.allow_mmap
    value: "false"
```

Con `allow_mmap=false`, ES usa Java NIO para acceder a los archivos de índice en lugar de mmap. No requiere modificar parámetros del kernel ni permisos especiales.

**Impacto en rendimiento**: NIO es ligeramente más lento que mmap para operaciones de búsqueda intensiva, pero para un entorno académico con pocas consultas simultáneas, la diferencia es imperceptible.

---

## 7. Elasticsearch / Prometheus — Pods en CrashLoopBackOff por permisos de filesystem

**Commits de fix:** `64a9553f`, `6ed2774f`

### Síntoma

Los pods de Elasticsearch y Prometheus fallaban al intentar escribir en sus directorios de datos:

```
# Elasticsearch:
Caused by: java.nio.file.AccessDeniedException: /usr/share/elasticsearch/data

# Prometheus:
level=error msg="Opening storage failed" err="open /prometheus/chunks_head: permission denied"
```

### Causa raíz

Los procesos dentro de los contenedores corrían como usuarios no-root (ES como UID 1000, Prometheus como UID 65534). Los volúmenes montados desde PVCs o `emptyDir` son creados por Kubernetes con UID/GID root (0:0). El proceso no-root no tenía permisos de escritura.

### Solución

Configurar `securityContext` a nivel de Pod con `fsGroup`. Kubernetes cambia el grupo propietario del volumen al valor de `fsGroup` antes de montarlo, y el proceso puede escribir porque su GID coincide:

```yaml
# Elasticsearch
spec:
  securityContext:
    fsGroup: 1000
    runAsUser: 1000

# Prometheus
spec:
  securityContext:
    fsGroup: 65534
    runAsUser: 65534
    runAsNonRoot: true
```

`fsGroup` hace que Kubernetes ejecute `chown :<fsGroup>` en el volumen y lo haga group-writable (`chmod g+s`). El proceso, aunque no es root, puede escribir porque pertenece al grupo `fsGroup`.

---

## 8. Elasticsearch / Prometheus — Recursos insuficientes en Minikube

**Commits de fix:** `304b8f4e`, `6020ec0b`

### Síntoma

Los pods de Elasticsearch o Prometheus quedaban en estado `Pending` sin poder ser schedulados:

```
kubectl describe pod elasticsearch-0 -n logging
# Events:
# Warning  FailedScheduling  0/1 nodes are available: 1 Insufficient memory
```

### Causa raíz

Los requests de recursos originales eran demasiado altos para un Minikube con 3.8GB de RAM compartida entre el sistema operativo, los microservicios de DeliverEats, las BDs, y ahora el stack ELK + Monitoring:

```yaml
# Configuración original (muy alta para Minikube):
resources:
  requests:
    memory: "2Gi"   # Solo para ES
  limits:
    memory: "4Gi"
```

Kubernetes usa los `requests` para decidir en qué nodo schedulear un pod. Si ningún nodo tiene suficiente memoria libre según los requests, el pod queda en `Pending`.

### Solución

Reducir los requests a valores que encajen en el entorno disponible, manteniendo limits razonables:

```yaml
# Elasticsearch
resources:
  requests:
    cpu: "200m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "1Gi"

# Prometheus
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "300m"
    memory: "512Mi"
```

También se redujo el número de nodos GKE de 4 a 3 en el módulo de Terraform para reducir costos.

**Nota**: El heap de ES también se ajustó via `ES_JAVA_OPTS=-Xms512m -Xmx512m` para que coincida con el límite del contenedor y evitar que ES intente usar más RAM de la disponible.

---

## 9. Smoke Test — Peticiones al Ingress sin header Host fallan

**Commits de fix:** `92bdedde`, `00b38c59`

### Síntoma

El smoke test fallaba en todos los checks con respuesta 404:

```
[CHECK 1] Health check...
< HTTP/1.1 404 Not Found
FAIL: esperado 200, recibido 404
```

El mismo curl funcionaba manualmente desde la máquina de desarrollo.

### Causa raíz

El smoke test en CI hacía las peticiones directamente a la IP del Ingress controller (ej. `http://34.X.X.X/health`) sin el header `Host`. El Ingress-NGINX usa el header `Host` para decidir a qué backend enrutar la petición.

Si no hay un `Host` header que coincida con ninguna regla del Ingress, NGINX retorna 404 (o usa el backend por defecto si hay uno configurado).

En la máquina de desarrollo, el archivo `/etc/hosts` tenía `127.0.0.1 delivereats.local`, por lo que el navegador y curl enviaban `Host: delivereats.local` automáticamente. En CI, las peticiones iban directo a la IP sin resolución DNS.

### Solución

Agregar el header `Host: delivereats.local` explícitamente en todas las peticiones del smoke test:

```bash
# Antes:
curl -s http://$INGRESS_IP/health

# Después:
curl -s -H "Host: delivereats.local" http://$INGRESS_IP/health
```

Y en Locust:

```python
# Antes:
self.client.get("/health")

# Después:
self.client.get("/health", headers={"Host": "delivereats.local"})
```

---

## 10. Smoke Test — Fallo por falta de datos de prueba (restaurantes)

**Commit de fix:** `53070ccb`

### Síntoma

El check 4 del smoke test fallaba:

```
[CHECK 4] Listar restaurantes...
< {"success":true,"data":{"restaurants":[]}}
FAIL: esperado al menos 1 restaurante, recibido lista vacía
```

### Causa raíz

El smoke test asumía que habría datos en la base de datos al momento de ejecutarse. En cada despliegue nuevo en GKE (cluster limpio o namespace recreado), las bases de datos empiezan vacías. No había un mecanismo automático para insertar datos de prueba.

### Solución

Agregar un **seed Job** de Kubernetes que se ejecuta antes del smoke test en el pipeline. El Job ejecuta un contenedor con `kubectl exec` o directamente con `psql` para insertar restaurantes y productos de prueba:

```yaml
# k8s/jobs/seed-data.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: seed-data
  namespace: delivereats
spec:
  template:
    spec:
      containers:
        - name: seed
          image: postgres:15
          command: ["psql"]
          args:
            - "-h"
            - "catalog-db.delivereats.svc.cluster.local"
            - "-U"
            - "catalog_user"
            - "-d"
            - "catalog_db"
            - "-c"
            - |
              INSERT INTO restaurants (id, name, ...) VALUES (...) ON CONFLICT (id) DO NOTHING;
      restartPolicy: OnFailure
```

El `ON CONFLICT (id) DO NOTHING` hace que el seed sea idempotente: si los datos ya existen (ej. redeploy sin limpiar la BD), no falla.

En el pipeline de CI, el seed Job se aplica y se espera a que complete antes de ejecutar el smoke test:

```bash
kubectl apply -f k8s/jobs/seed-data.yaml
kubectl wait --for=condition=complete job/seed-data -n delivereats --timeout=60s
```

---

## 11. Seed Job — Columnas incorrectas en el INSERT

**Commit de fix:** `3a083262`

### Síntoma

El Job de seed fallaba con:

```
ERROR:  column "category" of relation "restaurants" does not exist
```

o

```
ERROR:  null value in column "owner_id" violates not-null constraint
```

### Causa raíz

El INSERT del seed job fue escrito asumiendo un esquema de tabla, pero el esquema real de la tabla `restaurants` (generado por las migraciones del servicio `catalog`) tenía columnas con nombres o tipos distintos. Por ejemplo:
- La columna se llamaba `cuisine_type` en lugar de `category`.
- `owner_id` era NOT NULL y no tenía valor por defecto.
- Algunas columnas adicionales requeridas no estaban en el INSERT.

### Solución

Inspeccionar el esquema real de la tabla y corregir el INSERT:

```bash
# Ver el esquema real:
kubectl exec -it -n delivereats catalog-db-0 -- psql -U catalog_user -d catalog_db -c "\d restaurants"
```

Luego actualizar el seed con las columnas correctas según el output de `\d restaurants`. Se verificó que cada columna NOT NULL sin DEFAULT tuviera un valor en el INSERT.

**Lección**: siempre derivar el seed de la migración o del `\d` real de la tabla, nunca asumir el esquema de memoria.

---

## 12. CI/CD — Smoke test corría antes de que los pods estuvieran listos

**Commit de fix:** `31efd178`

### Síntoma

El smoke test fallaba en el check 1 (health check) con `Connection refused` o `502 Bad Gateway`:

```
[CHECK 1] Health check...
curl: (7) Failed to connect to delivereats.local port 80: Connection refused
```

Al revisar manualmente los pods después del fallo, todos estaban `Running` y el smoke test pasaba.

### Causa raíz

El job `deploy` del pipeline aplicaba los manifiestos con `kubectl apply -f k8s/` y luego el job `smoke-test` arrancaba inmediatamente. El `kubectl apply` retorna tan pronto como el API server acepta los manifiestos, sin esperar a que los pods estén realmente `Ready`.

Secuencia problemática:
```
t=0s   kubectl apply → API server acepta manifiestos
t=1s   Pods en estado "Pending" (imagen descargándose)
t=5s   smoke-test job inicia (pods aún no Ready)
t=5s   curl → Connection refused / 502
t=30s  Pods finalmente en estado "Running"
```

### Solución

Agregar un paso de espera explícito después del `kubectl apply`, antes de ejecutar el seed y el smoke test:

```bash
# Esperar a que todos los pods del namespace estén Ready
kubectl wait --for=condition=ready pod \
  -l tier=backend \
  -n delivereats \
  --timeout=300s

# Esperar también a que los pods de bases de datos estén Ready
kubectl wait --for=condition=ready pod \
  -l tier=database \
  -n delivereats \
  --timeout=300s

# Solo entonces ejecutar el seed
kubectl apply -f k8s/jobs/seed-data.yaml
kubectl wait --for=condition=complete job/seed-data -n delivereats --timeout=60s

# Y luego el smoke test
bash tests/smoke/smoke_test.sh
```

`--timeout=300s` da hasta 5 minutos para que los pods arranquen, cubriendo el tiempo de pull de imágenes del Artifact Registry.

---

## 13. Terraform — Backend GCS sin credenciales en CI

**Commits de fix:** `f930ca10`, `163e4ef1`

### Síntoma

El step `terraform init` en CI fallaba con:

```
Error: Failed to get existing workspaces: querying Cloud Storage failed:
googleapi: Error 403: Insufficient Permission
```

### Causa raíz

El backend de Terraform está en GCS:

```hcl
backend "gcs" {
  bucket = "delivereats-tfstate"
  prefix = "terraform/state"
}
```

Inicialmente se usaba una Service Account Key (archivo JSON) para autenticar. El JSON estaba en un GitHub Secret y se escribía a un archivo temporal. Sin embargo, el orden de operaciones era incorrecto: `terraform init` se ejecutaba antes de que las credenciales estuvieran disponibles en el environment.

También se intentó `-backend=false` para evitar el backend en pasos de validación, pero el job de `terraform plan` sí necesita el estado real para calcular diferencias.

### Solución

Migrar a **Workload Identity Federation** entre GitHub Actions y GCP:

1. En GCP: configurar un Workload Identity Pool que confíe en los tokens OIDC de GitHub.
2. En Terraform: el módulo `gke` crea el binding de IAM necesario.
3. En el pipeline: usar la action `google-github-actions/auth` con `workload_identity_provider` y `service_account`.

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
```

Esto genera credenciales temporales de Application Default Credentials (ADC) que Terraform y `gcloud` usan automáticamente. No hay JSON key que almacenar ni rotar.

---

## 14. Terraform — Fallos de `terraform fmt` en CI

**Commits de fix:** `f47287d1`, `3da39722`, `b85f6409`

### Síntoma

El job `terraform` fallaba con:

```
Error: Files not in the canonical format.
The following files are not formatted correctly: modules/gke/main.tf
```

### Causa raíz

`terraform fmt` aplica un formato canónico estricto a los archivos `.tf`:
- Alineación de `=` en bloques de asignación de variables.
- Indentación con 2 espacios.
- Espacios alrededor de comentarios inline.

Al escribir código Terraform en Windows con el editor de texto, se introducían diferencias sutiles en la alineación que pasaban desapercibidas localmente pero fallaban en el check de CI.

### Solución

En el pipeline de CI, ejecutar `terraform fmt` **antes** del check, y luego hacer el check:

```yaml
- name: Formatear Terraform
  run: terraform fmt -recursive

- name: Verificar formato
  run: terraform fmt -check -recursive
```

Y localmente, antes de hacer commit, ejecutar siempre:

```bash
terraform fmt -recursive
```

Alternativamente, configurar el editor (VS Code con la extensión HashiCorp Terraform) para formatear automáticamente al guardar.

---

## 15. Terraform — Quota insuficiente de PD-SSD en GKE

**Commit de fix:** `85e52b6e`

### Síntoma

La creación del node pool de GKE fallaba con:

```
Error: Error waiting for creating GKE NodePool: QUOTA_EXCEEDED
Quota 'SSD_TOTAL_GB' exceeded. Limit: 500.0 in region us-central1.
```

### Causa raíz

El tipo de disco por defecto de GKE para los nodos es `pd-ssd` (SSD persistente). La cuenta de GCP usada tenía una quota limitada de 500GB de SSD, que ya estaba parcialmente utilizada por otros recursos.

### Solución

Cambiar el tipo de disco del node pool a `pd-standard` (HDD persistente), que tiene quotas más altas y menor costo:

```hcl
# modules/gke/main.tf
node_config {
  disk_type    = "pd-standard"   # era pd-ssd (default)
  disk_size_gb = 50
  ...
}
```

`pd-standard` es suficiente para un entorno académico. El impacto en rendimiento es en operaciones de I/O intensivo en disco (lectura de imágenes Docker, escritura de logs), que en este contexto son aceptables.

---

## 16. Terraform — Cloud SQL SQL Server requiere `root_password`

**Commit de fix:** `084a0120`

### Síntoma

`terraform apply` fallaba al crear la instancia de Cloud SQL:

```
Error: Error creating instance: googleapi: Error 400: Invalid request:
database_flags requires root_password for SQL Server instances.
```

### Causa raíz

Para PostgreSQL y MySQL, Cloud SQL no requiere `root_password` en el recurso de Terraform (puede setearse después). Para **SQL Server**, es obligatorio especificarlo en la creación de la instancia porque SQL Server usa autenticación integrada de Windows + SQL auth, y la cuenta `sa` requiere una contraseña desde el inicio.

### Solución

Agregar `root_password` como variable en el módulo `cloudsql` y pasarlo al recurso:

```hcl
# modules/cloudsql/main.tf
resource "google_sql_database_instance" "main" {
  name             = var.instance_name
  database_version = "SQLSERVER_2019_EXPRESS"
  root_password    = var.root_password    # ← agregado
  ...
}
```

```hcl
# modules/cloudsql/variables.tf
variable "root_password" {
  description = "Contraseña para la cuenta sa de SQL Server"
  type        = string
  sensitive   = true
}
```

El valor se pasa desde `terraform.tfvars` o desde un secret en CI y nunca se hardcodea en el código.

---

## 17. Terraform — Atributo `enable_private_path_for_google_cloud_services` no soportado en SQL Server

**Commit de fix:** `03d39a44`

### Síntoma

`terraform validate` retornaba:

```
Error: Unsupported argument
An argument named "enable_private_path_for_google_cloud_services" is not expected here.
```

### Causa raíz

El atributo `enable_private_path_for_google_cloud_services` dentro del bloque `ip_configuration` de `google_sql_database_instance` solo está soportado para instancias **PostgreSQL y MySQL**. Para SQL Server no existe este atributo y Terraform lo rechaza en la validación.

Este atributo habilita que otros servicios de Google (como BigQuery) puedan conectarse a la instancia via red privada, lo cual no aplica para SQL Server en este contexto.

### Solución

Quitar el atributo del bloque `ip_configuration`:

```hcl
# Antes:
ip_configuration {
  ipv4_enabled                                  = false
  private_network                               = var.vpc_id
  enable_private_path_for_google_cloud_services = true   # ← quitar
}

# Después:
ip_configuration {
  ipv4_enabled    = false
  private_network = var.vpc_id
}
```

---

## 18. Fluentd — ClusterRole insuficiente para el SA de CI/CD

**Commit de fix:** `e75e7a67`

### Síntoma

El step `kubectl apply -f k8s/elk/` en el job `deploy` fallaba con:

```
Error from server (Forbidden): error when creating "k8s/elk/04-fluentd.yaml":
clusterroles.rbac.authorization.k8s.io is forbidden:
User "system:serviceaccount:..." cannot create resource "clusterroles"
in API group "rbac.authorization.k8s.io" at the cluster scope
```

### Causa raíz

El manifiesto de Fluentd incluye un `ClusterRole` (recurso a nivel de cluster, no de namespace). El Service Account de CI/CD solo tenía el rol `roles/container.developer` en GKE, que permite gestionar recursos dentro de namespaces pero no crear `ClusterRoles` (que requiere `roles/container.admin` o permisos RBAC de cluster-admin).

### Solución

Dar al Service Account de CI/CD el rol `roles/container.admin` en GKE. Esto se hace en el módulo Terraform de GKE:

```hcl
# modules/gke/main.tf
resource "google_project_iam_member" "ci_container_admin" {
  project = var.project_id
  role    = "roles/container.admin"
  member  = "serviceAccount:${var.ci_service_account}"
}
```

`roles/container.admin` permite gestionar todos los recursos de Kubernetes incluyendo recursos a nivel de cluster como `ClusterRole` y `ClusterRoleBinding`.

**Nota de seguridad**: en producción se usaría un rol más específico (solo los verbos necesarios sobre ClusterRole), pero para un entorno académico `container.admin` es aceptable.

---

## 19. CI/CD — GKE no existía cuando se ejecutaba deploy (terraform apply faltaba)

**Commits de fix:** `81b79d33`, `27f1e603`, `035dd00f`

### Síntoma

El job `deploy` fallaba con:

```
ERROR: (gcloud.container.clusters.get-credentials) ResponseError:
code=404, message=Not found: projects/.../locations/.../clusters/delivereats-cluster.
```

### Causa raíz

El pipeline tenía `terraform validate` (solo verificación de sintaxis) pero no `terraform apply`. El cluster de GKE no existía porque nunca se había creado via Terraform — se asumía que la infraestructura se creaba manualmente o que existía de antes.

Al limpiar el entorno de GCP para empezar desde cero, el cluster ya no existía y el job `deploy` fallaba al intentar obtener las credenciales.

### Proceso de resolución (varios intentos)

**Intento 1**: Agregar `terraform apply -auto-approve` al pipeline → funcionó para crear infraestructura pero `terraform apply` tarda ~10 minutos, haciendo cada pipeline muy lento.

**Intento 2**: `continue-on-error: true` en los jobs `deploy`, `ansible`, `smoke-test` → no es solución real, solo silencia el error.

**Solución final**: El `terraform apply` se ejecuta en el pipeline solo cuando se hace push a main, y los recursos de GKE se crean una vez. Después se usa `terraform plan` en PRs para verificar cambios sin aplicarlos. Se documentó el proceso de bootstrap:

```bash
# Bootstrap manual (solo la primera vez):
cd terraform
terraform init
terraform apply -auto-approve

# Obtener las credenciales del cluster creado:
gcloud container clusters get-credentials delivereats-cluster \
  --zone us-central1-a \
  --project $PROJECT_ID

# Verificar:
kubectl get nodes
```

Una vez el cluster existe, el pipeline de CI/CD puede hacer `gke-auth` y deployar normalmente.
