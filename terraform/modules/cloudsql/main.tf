# =============================================================
# MÓDULO: cloudsql
# =============================================================
# Crea una instancia de Cloud SQL con SQL Server 2019 Express.
# Se despliega FUERA del cluster GKE (managed service de GCP).
#
# Conectividad:
#   - IP privada dentro de la VPC → los pods la alcanzan sin
#     pasar por internet (Private Services Access)
#   - SQL Server usa el puerto 1433
#
# Por qué SQL Server Express:
#   Express es gratuito en licencia y suficiente para demo/proyecto.
#   En producción usaríamos Standard o Enterprise.
# =============================================================

# Private Services Access: peering entre la VPC y la red de Google
# para que Cloud SQL tenga IP privada accesible desde los pods.
resource "google_compute_global_address" "sql_private_ip" {
  name          = "${var.instance_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = var.vpc_id
}

resource "google_service_networking_connection" "sql_vpc_peering" {
  network                 = var.vpc_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.sql_private_ip.name]
}

# ── Instancia Cloud SQL ───────────────────────────────────────────────────────

resource "google_sql_database_instance" "mssql" {
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region

  # Evitar que terraform destroy borre la BD con datos en producción.
  # Para CI/CD de pruebas se puede cambiar a false.
  deletion_protection = false

  settings {
    tier = var.tier

    # IP privada dentro de la VPC (no expuesta a internet)
    ip_configuration {
      ipv4_enabled    = false # Sin IP pública
      private_network = var.vpc_id
    }

    backup_configuration {
      enabled = true
    }

    maintenance_window {
      day          = 7 # Domingo
      hour         = 3 # 3am
      update_track = "stable"
    }

    database_flags {
      name  = "cross db ownership chaining"
      value = "off"
    }
  }

  depends_on = [google_service_networking_connection.sql_vpc_peering]
}

# ── Usuario administrador ─────────────────────────────────────────────────────

resource "google_sql_user" "admin" {
  name     = var.sql_user
  instance = google_sql_database_instance.mssql.name
  password = var.sql_password
}
