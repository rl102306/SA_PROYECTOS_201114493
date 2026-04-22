variable "project_id" {
  description = "ID del proyecto GCP"
  type        = string
}

variable "region" {
  description = "Región principal de GCP"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zona principal dentro de la región"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Entorno (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# ── GKE ─────────────────────────────────────────────────────────────────────

variable "gke_cluster_name" {
  description = "Nombre del cluster GKE"
  type        = string
  default     = "delivereats-cluster"
}

variable "gke_node_count" {
  description = "Número de nodos en el node pool"
  type        = number
  default     = 2
}

variable "gke_machine_type" {
  description = "Tipo de máquina para los nodos"
  type        = string
  default     = "e2-standard-2"
}

# ── Cloud SQL ────────────────────────────────────────────────────────────────

variable "sql_instance_name" {
  description = "Nombre de la instancia Cloud SQL (SQL Server)"
  type        = string
  default     = "delivereats-mssql"
}

variable "sql_database_version" {
  description = "Versión de SQL Server"
  type        = string
  default     = "SQLSERVER_2019_EXPRESS"
}

variable "sql_tier" {
  description = "Tier de Cloud SQL"
  type        = string
  default     = "db-custom-1-3840"
}

variable "sql_user" {
  description = "Usuario administrador de SQL Server"
  type        = string
  default     = "delivereats_admin"
}

variable "sql_password" {
  description = "Contraseña del usuario de SQL Server"
  type        = string
  sensitive   = true
}

# ── Cloud Run ────────────────────────────────────────────────────────────────

variable "frontend_image" {
  description = "Imagen Docker del frontend en Artifact Registry"
  type        = string
  default     = "us-central1-docker.pkg.dev/PROJECT_ID/delivereats/frontend:latest"
}

# ── VM Load Testing ──────────────────────────────────────────────────────────

variable "vm_name" {
  description = "Nombre de la VM de load testing"
  type        = string
  default     = "delivereats-loadtest"
}

variable "vm_machine_type" {
  description = "Tipo de máquina para la VM de load testing"
  type        = string
  default     = "e2-medium"
}
