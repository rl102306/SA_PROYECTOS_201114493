# =============================================================
# DeliverEats — Infraestructura como Código (Terraform)
# =============================================================
# Este archivo ensambla todos los módulos en el orden correcto.
# El orden importa: networking debe existir antes que GKE y VMs.
#
# Módulos:
#   1. networking → VPC, subredes, firewall, NAT
#   2. gke        → Cluster GKE + node pool + Artifact Registry
#   3. cloudsql   → SQL Server externo (Cloud SQL managed)
#   4. cloudrun   → Frontend Angular como servicio serverless
#   5. vm         → VM de load testing (Ansible la configura)
# =============================================================

locals {
  prefix = "delivereats-${var.environment}"
}

# ── 1. Networking ─────────────────────────────────────────────────────────────

module "networking" {
  source = "./modules/networking"

  prefix = local.prefix
  region = var.region
}

# ── 2. GKE ───────────────────────────────────────────────────────────────────

module "gke" {
  source = "./modules/gke"

  project_id      = var.project_id
  cluster_name    = var.gke_cluster_name
  zone            = var.zone
  region          = var.region
  vpc_name        = module.networking.vpc_name
  gke_subnet_name = module.networking.gke_subnet_name
  node_count      = var.gke_node_count
  machine_type    = var.gke_machine_type
  environment     = var.environment

  depends_on = [module.networking]
}

# ── 3. Cloud SQL (SQL Server externo) ────────────────────────────────────────

module "cloudsql" {
  source = "./modules/cloudsql"

  instance_name    = var.sql_instance_name
  database_version = var.sql_database_version
  tier             = var.sql_tier
  region           = var.region
  vpc_id           = module.networking.vpc_id
  sql_user         = var.sql_user
  sql_password     = var.sql_password

  depends_on = [module.networking]
}

# ── 4. Cloud Run (Frontend) ───────────────────────────────────────────────────

module "cloudrun" {
  source = "./modules/cloudrun"

  project_id = var.project_id
  region     = var.region
  image      = var.frontend_image

  depends_on = [module.gke]
}

# ── 5. VM de Load Testing ─────────────────────────────────────────────────────

module "vm" {
  source = "./modules/vm"

  vm_name        = var.vm_name
  machine_type   = var.vm_machine_type
  zone           = var.zone
  vm_subnet_name = module.networking.vm_subnet_name
  environment    = var.environment

  depends_on = [module.networking]
}
