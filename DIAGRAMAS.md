# DeliverEats — Diagramas de Arquitectura

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Carnet: 201114493**

---

## Tabla de Contenidos

1. [Arquitectura General del Sistema](#1-arquitectura-general-del-sistema)
2. [Infraestructura en GCP — Terraform](#2-infraestructura-en-gcp--terraform)
3. [Stack de Observabilidad — ELK](#3-stack-de-observabilidad--elk)
4. [Stack de Observabilidad — Prometheus y Grafana](#4-stack-de-observabilidad--prometheus-y-grafana)
5. [Pipeline CI/CD](#5-pipeline-cicd)
6. [CronJob — Rechazo Automático de Órdenes](#6-cronjob--rechazo-automático-de-órdenes)
7. [Flujo de una Orden (End-to-End)](#7-flujo-de-una-orden-end-to-end)

---

## 1. Arquitectura General del Sistema

Visión completa del sistema: frontend, API Gateway, microservicios, bases de datos, colas y herramientas de observabilidad desplegados en GKE.

```mermaid
graph TB
    subgraph Internet
        USER[Cliente Web]
        ADMIN[Admin Web]
        REST[Restaurante Web]
    end

    subgraph GCP["GCP — Google Cloud Platform"]
        subgraph CloudRun["Cloud Run"]
            FRONTEND[Frontend Angular :4200]
        end

        subgraph GKE["GKE Cluster — namespace: delivereats"]
            INGRESS[Ingress NGINX]

            subgraph Gateway["API Gateway :3000"]
                GW[REST → gRPC\n/metrics]
            end

            subgraph Services["Microservicios"]
                AUTH[auth-service :50052]
                CATALOG[catalog-service :50051]
                ORDER[order-service :50053]
                DELIVERY[delivery-service :50054]
                PAYMENT[payment-service :50057]
                FX[fx-service :50056]
                NOTIF[notification-service :50055]
            end

            subgraph Databases["Bases de Datos — StatefulSets"]
                AUTH_DB[(auth-db\nPostgreSQL :5432)]
                CATALOG_DB[(catalog-db\nPostgreSQL :5433)]
                ORDER_DB[(order-db\nPostgreSQL :5434)]
                DELIVERY_DB[(delivery-db\nPostgreSQL :5435)]
                PAYMENT_DB[(payment-db\nPostgreSQL :5436)]
                REDIS[(Redis :6379)]
            end

            subgraph Messaging["Mensajeria"]
                RABBIT[RabbitMQ]
            end

            subgraph Automation["Automatizacion"]
                CRONJOB[order-cleanup\nCronJob cada 5 min]
            end

            subgraph Observability["Observabilidad — namespace: logging / monitoring"]
                ES[Elasticsearch]
                KIBANA[Kibana /kibana]
                FLUENTD[Fluentd DaemonSet]
                PROM[Prometheus]
                GRAFANA[Grafana /grafana]
                NODE_EXP[Node Exporter\nDaemonSet]
                KSM[kube-state-metrics]
            end
        end

        subgraph CloudSQL["Cloud SQL"]
            SQLSERVER[(SQL Server 2019\nIP Privada)]
        end
    end

    USER --> FRONTEND
    ADMIN --> FRONTEND
    REST --> FRONTEND
    FRONTEND --> INGRESS
    INGRESS --> GW
    GW -->|gRPC| AUTH
    GW -->|gRPC| CATALOG
    GW -->|gRPC| ORDER
    GW -->|gRPC| DELIVERY
    GW -->|gRPC| PAYMENT
    GW -->|gRPC| FX

    AUTH --> AUTH_DB
    CATALOG --> CATALOG_DB
    ORDER --> ORDER_DB
    DELIVERY --> DELIVERY_DB
    PAYMENT --> PAYMENT_DB
    FX --> REDIS

    ORDER -->|publish| RABBIT
    CATALOG -->|consume| RABBIT

    PAYMENT --> NOTIF
    DELIVERY --> NOTIF
    CRONJOB --> ORDER_DB
    CRONJOB -->|gRPC| AUTH
    CRONJOB -->|gRPC| NOTIF

    FLUENTD -->|tail logs| ES
    ES --> KIBANA
    GW -->|/metrics| PROM
    NODE_EXP --> PROM
    KSM --> PROM
    PROM --> GRAFANA
```

---

## 2. Infraestructura en GCP — Terraform

Recursos aprovisionados por cada módulo de Terraform y sus dependencias.

```mermaid
graph TB
    subgraph TF["Terraform — 5 Módulos"]
        subgraph MOD_NET["Módulo: networking"]
            VPC[VPC Custom\ndelivereats-vpc]
            SUBNET_GKE[Subred GKE\n10.0.0.0/20]
            SUBNET_VM[Subred VM\n10.0.16.0/24]
            FIREWALL[Reglas Firewall\nSSH / HTTP / HTTPS]
            NAT[Cloud NAT\nSalida a internet]
        end

        subgraph MOD_GKE["Módulo: gke"]
            GKE_CLUSTER[GKE Standard Cluster]
            NODE_POOL[Node Pool\ne2-standard-4 x3]
            AR[Artifact Registry\nDocker images]
        end

        subgraph MOD_SQL["Módulo: cloudsql"]
            SQL[Cloud SQL\nSQL Server 2019 Express]
            PSA[Private Services Access\nIP Privada]
        end

        subgraph MOD_RUN["Módulo: cloudrun"]
            CR[Cloud Run Service\nFrontend Angular]
            CR_IAM[IAM — allUsers\ninvoker]
        end

        subgraph MOD_VM["Módulo: vm"]
            VM[VM Ubuntu e2-medium\nLocust + Ansible]
            VM_IP[IP Pública estática]
        end

        subgraph STATE["Estado remoto"]
            GCS[GCS Bucket\ndelivereats-tfstate]
        end
    end

    VPC --> SUBNET_GKE
    VPC --> SUBNET_VM
    VPC --> FIREWALL
    VPC --> NAT
    SUBNET_GKE --> GKE_CLUSTER
    GKE_CLUSTER --> NODE_POOL
    SUBNET_VM --> VM
    VM --> VM_IP
    VPC --> PSA
    PSA --> SQL
    CR --> CR_IAM

    GCS -.->|backend| TF
```

---

## 3. Stack de Observabilidad — ELK

Flujo completo desde la generación de logs en los pods hasta su visualización en Kibana.

```mermaid
flowchart LR
    subgraph Pods["Pods — namespace: delivereats"]
        P1[api-gateway]
        P2[auth-service]
        P3[order-service]
        P4[catalog-service]
        P5[delivery-service]
        P6[payment-service]
        P7[notification-service]
        P8[fx-service]
        P9[order-cleanup CronJob]
    end

    subgraph Node["Nodo GKE"]
        LOGS["/var/log/containers/\n*.log"]
    end

    subgraph Fluentd["Fluentd DaemonSet\n(un pod por nodo)"]
        TAIL[tail plugin\nleer archivos .log]
        META[kubernetes_metadata\nenriquecer con labels]
        GREP[grep filter\nnamespace=delivereats]
        PARSE[parser\nJSON o regexp CRI]
        REWRITE[rewrite_tag_filter\nasignar tag por servicio]
    end

    subgraph ES["Elasticsearch\nStatefulSet — PVC 10Gi"]
        IDX1[delivereats-api-gateway-YYYY.MM.DD]
        IDX2[delivereats-auth-service-YYYY.MM.DD]
        IDX3[delivereats-order-service-YYYY.MM.DD]
        IDXN[delivereats-...-YYYY.MM.DD]
    end

    subgraph Kibana["Kibana\nDeployment + Ingress /kibana"]
        DISC[Discover\nIndex Patterns]
        DASH[Dashboards\npor servicio]
    end

    P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8 & P9 -->|stdout| LOGS
    LOGS --> TAIL
    TAIL --> META
    META --> GREP
    GREP --> PARSE
    PARSE --> REWRITE
    REWRITE -->|delivereats.api-gateway| IDX1
    REWRITE -->|delivereats.auth-service| IDX2
    REWRITE -->|delivereats.order-service| IDX3
    REWRITE -->|otros servicios| IDXN
    IDX1 & IDX2 & IDX3 & IDXN --> DISC
    DISC --> DASH
```

---

## 4. Stack de Observabilidad — Prometheus y Grafana

Recoleccion de metricas desde los servicios, nodos y estado del cluster, con alertas y dashboards.

```mermaid
flowchart TB
    subgraph Sources["Fuentes de Métricas"]
        GW_M[api-gateway\nGET /metrics\nprom-client]
        NE[Node Exporter\nDaemonSet\nCPU / RAM / Disco / Red]
        KSM[kube-state-metrics\nPods / Deployments / CronJobs]
    end

    subgraph Prometheus["Prometheus — scrape cada 15s"]
        SC[Scrape Config\nscrape_configs]
        RULES[Reglas de Alerta\n5 alertas definidas]
        TSDB[(TSDB\nTime Series DB)]
    end

    subgraph Alerts["Alertas configuradas"]
        A1[PodDown\npod no disponible > 1m]
        A2[HighErrorRate\n5xx > 10% en 5m]
        A3[HighLatency\np95 latencia > 2s]
        A4[HighNodeCPU\nCPU nodo > 80% en 5m]
        A5[LowNodeMemory\nRAM nodo < 20%]
    end

    subgraph Grafana["Grafana — /grafana\nadmin/admin"]
        D1[Dashboard: Estado General\npods up/down por servicio]
        D2[Dashboard: Latencia HTTP\np50 / p95 / p99 por ruta]
        D3[Dashboard: Sistema Nodos\nCPU / RAM / Disco / Red]
    end

    GW_M -->|HTTP pull| SC
    NE -->|HTTP pull| SC
    KSM -->|HTTP pull| SC
    SC --> TSDB
    TSDB --> RULES
    RULES --> A1 & A2 & A3 & A4 & A5
    TSDB -->|PromQL| D1 & D2 & D3
```

---

## 5. Pipeline CI/CD

Flujo completo del pipeline de GitHub Actions con sus 7 jobs y dependencias.

```mermaid
flowchart LR
    subgraph Triggers["Trigger"]
        PUSH[Push a main\no Pull Request]
    end

    subgraph Jobs["GitHub Actions Jobs"]
        TF["terraform\nfmt-check\nvalidate\nplan"]
        BUILD["build\nDocker build\n10 imágenes"]
        TEST["test\nUnit tests\nts-jest"]
        PUSH_JOB["push\nDocker push\nArtifact Registry"]
        DEPLOY["deploy\nkubectl apply\nK8s manifests\nELK + Monitoring"]
        ANSIBLE["ansible\nProvisionar VM\nInstalar Locust"]
        SMOKE["smoke-test\n7 checks\nflujo crítico"]
    end

    subgraph Artifacts["Artefactos"]
        JSON[smoke-test-results\nretención 7 días]
    end

    PUSH --> TF
    PUSH --> TEST
    TF --> BUILD
    BUILD --> PUSH_JOB
    TEST --> PUSH_JOB
    PUSH_JOB --> DEPLOY
    DEPLOY --> ANSIBLE
    ANSIBLE --> SMOKE
    SMOKE --> JSON

    style TF fill:#fff3cd
    style BUILD fill:#d4edda
    style TEST fill:#d4edda
    style PUSH_JOB fill:#cce5ff
    style DEPLOY fill:#cce5ff
    style ANSIBLE fill:#f8d7da
    style SMOKE fill:#f8d7da
```

---

## 6. CronJob — Rechazo Automático de Órdenes

Logica del `order-cleanup` con mecanismo anti-spam y manejo de condiciones de carrera.

```mermaid
flowchart TD
    START([Kubernetes ejecuta CronJob\ncada 5 minutos])

    subgraph Init["Inicialización"]
        CONN[Conectar a order-db\nPostgreSQL]
        MIGRATE[ALTER TABLE orders\nADD COLUMN IF NOT EXISTS\nrejection_notified BOOLEAN DEFAULT false]
    end

    subgraph Query["Consulta"]
        SELECT["SELECT órdenes donde:\nstatus = 'PENDING'\nAND created_at < NOW() - INTERVAL '60 min'\nAND rejection_notified = false"]
    end

    subgraph Loop["Por cada orden encontrada"]
        GRPC_AUTH[gRPC → auth-service\nGetUserById → email del cliente]

        UPDATE["UPDATE orders SET\nstatus = 'CANCELLED'\nrejection_notified = true\nWHERE id = ?\nAND status = 'PENDING'\nAND rejection_notified = false\nRETURNING id"]

        CHECK{rowCount > 0?}

        GRPC_NOTIF[gRPC → notification-service\nSendOrderRejectedNotification\nemail al cliente]

        SKIP[Omitir — otro proceso\nya manejó esta orden\nCondición de carrera resuelta]
    end

    subgraph Summary["Resumen final"]
        LOG[Imprimir:\n- Órdenes procesadas\n- Emails enviados\n- Errores]
    end

    END_OK([process.exit 0\nJob completado])
    END_ERR([process.exit 1\nK8s reintenta — backoffLimit: 2])

    START --> CONN --> MIGRATE --> SELECT
    SELECT -->|Órdenes encontradas| GRPC_AUTH
    SELECT -->|Sin órdenes| LOG
    GRPC_AUTH --> UPDATE
    UPDATE --> CHECK
    CHECK -->|Si| GRPC_NOTIF --> Loop
    CHECK -->|No| SKIP --> Loop
    Loop -->|Siguiente orden| GRPC_AUTH
    Loop -->|Fin del loop| LOG
    LOG --> END_OK
    CONN -->|Error de conexión| END_ERR

    style CHECK fill:#fff3cd
    style SKIP fill:#f8d7da
    style GRPC_NOTIF fill:#d4edda
    style END_OK fill:#d4edda
    style END_ERR fill:#f8d7da
```

---

## 7. Flujo de una Orden (End-to-End)

Secuencia completa desde que el cliente hace un pedido hasta la entrega o rechazo.

```mermaid
sequenceDiagram
    actor Cliente
    participant FE as Frontend Angular
    participant GW as API Gateway
    participant AUTH as auth-service
    participant CATALOG as catalog-service
    participant ORDER as order-service
    participant FX as fx-service
    participant PAYMENT as payment-service
    participant RABBIT as RabbitMQ
    participant DELIVERY as delivery-service
    participant NOTIF as notification-service
    participant CLEANUP as order-cleanup (CronJob)

    Cliente->>FE: Selecciona restaurante y productos
    FE->>GW: POST /orders (JWT)
    GW->>AUTH: ValidateToken (gRPC)
    AUTH-->>GW: userId válido

    GW->>FX: GetExchangeRate USD/GTQ (gRPC)
    FX-->>GW: tipo de cambio (cache Redis 1h)

    GW->>ORDER: CreateOrder (gRPC)
    ORDER->>ORDER: INSERT orders (status=PENDING)
    ORDER->>RABBIT: publish order.created
    RABBIT->>CATALOG: consume order.created (inbox)
    ORDER-->>GW: orderId
    GW-->>FE: 201 Created

    FE->>GW: POST /payments
    GW->>PAYMENT: ProcessPayment (gRPC)
    PAYMENT->>PAYMENT: INSERT payment (status=COMPLETED)
    PAYMENT->>ORDER: UpdateOrderStatus (status=PAID)
    PAYMENT->>NOTIF: SendPaymentConfirmation
    NOTIF-->>Cliente: Email "Pago confirmado"

    alt Restaurante acepta (< 60 min)
        FE->>GW: PUT /orders/:id/accept (restaurante)
        GW->>ORDER: UpdateOrderStatus (status=ACCEPTED)
        ORDER->>DELIVERY: AssignDelivery (gRPC)
        DELIVERY->>NOTIF: SendOrderAccepted
        NOTIF-->>Cliente: Email "Pedido en camino"

        FE->>GW: PUT /orders/:id/deliver (repartidor)
        GW->>DELIVERY: UpdateDeliveryStatus (DELIVERED)
        DELIVERY->>NOTIF: SendDeliveryConfirmation
        NOTIF-->>Cliente: Email "Pedido entregado"
    else Restaurante no responde (> 60 min)
        CLEANUP->>ORDER: SELECT PENDING > 60min
        CLEANUP->>AUTH: GetUserById (gRPC)
        CLEANUP->>ORDER: UPDATE status=CANCELLED, rejection_notified=true
        CLEANUP->>NOTIF: SendOrderRejectedNotification
        NOTIF-->>Cliente: Email "Pedido cancelado"
    end
```

---

*DeliverEats — Software Avanzado 2026 — Carnet 201114493*
