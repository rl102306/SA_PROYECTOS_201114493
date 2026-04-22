# =============================================================
# MÓDULO: networking
# =============================================================
# Crea la red base de toda la infraestructura:
#   - VPC personalizada (no default) para aislar el proyecto
#   - Subred de GKE con rangos secundarios para pods y servicios
#   - Subred de VMs (load testing)
#   - Reglas de firewall mínimas (SSH, tráfico interno)
#   - Cloud Router + NAT para que los nodos privados accedan internet
#
# Por qué VPC personalizada y no la default:
#   La VPC default existe en todos los proyectos y puede tener
#   reglas permisivas. Usar una VPC dedicada aplica el principio
#   de mínimo privilegio desde la capa de red.
# =============================================================

resource "google_compute_network" "vpc" {
  name                    = "${var.prefix}-vpc"
  auto_create_subnetworks = false # Manual: controlamos exactamente qué subredes existen
  description             = "VPC principal de DeliverEats"
}

# ── Subred para GKE ──────────────────────────────────────────────────────────
# Los rangos secundarios son obligatorios en GKE con VPC-native networking.
# - pod_range:     /16 → hasta 65k IPs para pods
# - service_range: /20 → hasta 4k IPs para ClusterIPs de Services

resource "google_compute_subnetwork" "gke" {
  name          = "${var.prefix}-gke-subnet"
  ip_cidr_range = "10.0.0.0/20"   # Nodos del cluster
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "pod-range"
    ip_cidr_range = "10.48.0.0/16"
  }

  secondary_ip_range {
    range_name    = "service-range"
    ip_cidr_range = "10.52.0.0/20"
  }

  private_ip_google_access = true # Los nodos privados pueden llamar a APIs de Google
}

# ── Subred para VMs (load testing, etc.) ────────────────────────────────────

resource "google_compute_subnetwork" "vms" {
  name          = "${var.prefix}-vm-subnet"
  ip_cidr_range = "10.1.0.0/24"   # Suficiente para pocas VMs
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# ── Firewall: acceso SSH desde cualquier IP ──────────────────────────────────
# Necesario para que Ansible pueda conectarse a la VM de load testing.
# En producción real se restringiría a IPs de oficina/CI.

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.prefix}-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["allow-ssh"]
  description   = "Permite SSH para administración y Ansible"
}

# ── Firewall: tráfico interno entre todos los recursos de la VPC ─────────────

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.prefix}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
  description   = "Tráfico interno entre nodos, pods y VMs"
}

# ── Firewall: health checks de GCP (necesario para load balancers) ───────────

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.prefix}-allow-health-checks"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }

  # Rangos IP que GCP usa para health checks
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  description   = "Health checks de Google Cloud Load Balancer"
}

# ── Cloud Router ─────────────────────────────────────────────────────────────
# Necesario para Cloud NAT. Los nodos sin IP pública usan NAT para salir a internet.

resource "google_compute_router" "router" {
  name    = "${var.prefix}-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

# ── Cloud NAT ────────────────────────────────────────────────────────────────
# Permite que nodos privados de GKE descarguen imágenes, actualicen paquetes, etc.

resource "google_compute_router_nat" "nat" {
  name                               = "${var.prefix}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
