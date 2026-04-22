# =============================================================
# MÓDULO: cloudrun
# =============================================================
# Despliega el frontend Angular en Cloud Run.
#
# Por qué Cloud Run para el frontend:
#   El frontend es estático (nginx sirve archivos compilados).
#   Cloud Run escala a cero cuando no hay tráfico, reduciendo costos.
#   No necesita el overhead de un Deployment+Service+Ingress en GKE.
#
# Tráfico:
#   Cloud Run expone el servicio con HTTPS automático.
#   El frontend llama al API Gateway en GKE via la IP del Ingress.
# =============================================================

resource "google_cloud_run_v2_service" "frontend" {
  name     = var.service_name
  location = var.region

  template {
    containers {
      image = var.image

      ports {
        container_port = 80
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "API_GATEWAY_URL"
        value = var.api_gateway_url
      }
    }

    scaling {
      min_instance_count = 0   # Escala a cero cuando no hay tráfico
      max_instance_count = 3
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Permite acceso público al servicio de Cloud Run (sin autenticación de GCP)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
