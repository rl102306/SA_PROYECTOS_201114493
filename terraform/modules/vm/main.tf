# =============================================================
# MÓDULO: vm
# =============================================================
# Crea una VM Compute Engine dedicada a load testing con Locust.
#
# Esta VM tiene IP pública para que Ansible pueda conectarse desde CI/CD.
# El tag "allow-ssh" activa la regla de firewall definida en networking.
#
# Ansible (definido en /ansible/) instalará en esta VM:
#   - Python 3, pip
#   - Locust
#   - Scripts de smoke test y carga
# =============================================================

data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2204-lts"
  project = "ubuntu-os-cloud"
}

resource "google_compute_instance" "loadtest" {
  name         = var.vm_name
  machine_type = var.machine_type
  zone         = var.zone

  tags = ["allow-ssh", "loadtest"]

  boot_disk {
    initialize_params {
      image = data.google_compute_image.ubuntu.self_link
      size = 20 # GB — suficiente para Ubuntu + Python + Locust
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = var.vm_subnet_name

    # IP pública para acceso SSH desde Ansible/CI
    access_config {}
  }

  metadata = {
    # Script de arranque: actualiza paquetes e instala dependencias base.
    # Ansible luego hace la configuración idempotente completa.
    startup-script = <<-EOF
      #!/bin/bash
      apt-get update -y
      apt-get install -y python3 python3-pip
    EOF
  }

  labels = {
    env     = var.environment
    purpose = "loadtest"
  }

  # Permitir que Terraform destruya la VM (útil en CI/CD de pruebas)
  allow_stopping_for_update = true
}
