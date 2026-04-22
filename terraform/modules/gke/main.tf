# =============================================================
# MÓDULO: gke
# =============================================================
# Crea un cluster GKE Standard (no Autopilot) con:
#   - Nodos privados (sin IP pública) → más seguro
#   - VPC-native networking → rangos secundarios para pods/services
#   - Workload Identity → los pods se autentican en GCP sin JSON keys
#   - Node pool separado del default → el default viene vacío
#
# Por qué Standard sobre Autopilot:
#   Autopilot no permite CronJobs con imágenes privadas sin
#   configuración adicional de Workload Identity en el pod.
#   Standard nos da control total sobre los nodos.
# =============================================================

# Service Account que usarán los nodos del cluster
resource "google_service_account" "gke_nodes" {
  account_id   = "${var.cluster_name}-nodes"
  display_name = "GKE Node Service Account — ${var.cluster_name}"
}

# Permisos mínimos para los nodos:
# - logging.logWriter: escribir logs a Cloud Logging
# - monitoring.metricWriter: enviar métricas a Cloud Monitoring
# - artifactregistry.reader: descargar imágenes del registry privado
locals {
  node_roles = [
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/artifactregistry.reader",
  ]
}

resource "google_project_iam_member" "gke_node_roles" {
  for_each = toset(local.node_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# ── Cluster GKE ──────────────────────────────────────────────────────────────

resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.zone      # Zonal (1 control plane) — más barato que regional

  # Eliminar el node pool default y crear el nuestro con parámetros específicos.
  # El pool default no se puede desactivar, por eso se crea con 0 nodos.
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = var.vpc_name
  subnetwork = var.gke_subnet_name

  # VPC-native: usa rangos secundarios de la subred para pods y services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pod-range"
    services_secondary_range_name = "service-range"
  }

  # Nodos privados: sin IP pública → Cloud NAT maneja el egress
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # El master sí es accesible por IP pública (para kubectl)
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Workload Identity: los pods pueden obtener tokens de GCP sin JSON keys
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Logging y monitoring nativos de GKE
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
  }

  # Deshabilitar dashboard legacy
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  deletion_protection = false # Permite destruir con terraform destroy en dev/testing
}

# ── Node Pool ─────────────────────────────────────────────────────────────────
# Pool separado del default con configuración controlada.

resource "google_container_node_pool" "main" {
  name       = "${var.cluster_name}-pool"
  cluster    = google_container_cluster.main.id
  node_count = var.node_count

  node_config {
    machine_type    = var.machine_type
    service_account = google_service_account.gke_nodes.email

    # Scopes mínimos necesarios (Workload Identity los reemplaza para APIs de GCP)
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Habilitar Workload Identity en los nodos
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      env     = var.environment
      cluster = var.cluster_name
    }

    tags = ["gke-node", var.cluster_name]

    disk_size_gb = 50
    disk_type    = "pd-standard"
  }

  # Actualización progresiva: reemplaza nodos de a uno para no bajar el cluster
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  management {
    auto_repair  = true   # GKE repara nodos unhealthy automáticamente
    auto_upgrade = true   # Mantiene el Kubernetes version al día
  }
}

# ── Artifact Registry ─────────────────────────────────────────────────────────
# Repositorio Docker donde el CI/CD pushea las imágenes.
# Lo ponemos en este módulo porque GKE lo consume directamente.

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = "delivereats"
  description   = "Imágenes Docker de DeliverEats"
  format        = "DOCKER"
}
