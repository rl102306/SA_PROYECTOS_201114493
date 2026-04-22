output "vm_name" {
  value = google_compute_instance.loadtest.name
}

output "public_ip" {
  description = "IP pública de la VM (para Ansible y SSH)"
  value       = google_compute_instance.loadtest.network_interface[0].access_config[0].nat_ip
}

output "private_ip" {
  value = google_compute_instance.loadtest.network_interface[0].network_ip
}
