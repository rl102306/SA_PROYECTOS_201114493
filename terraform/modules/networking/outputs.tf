output "vpc_id" {
  description = "ID de la VPC"
  value       = google_compute_network.vpc.id
}

output "vpc_name" {
  description = "Nombre de la VPC"
  value       = google_compute_network.vpc.name
}

output "gke_subnet_name" {
  description = "Nombre de la subred de GKE"
  value       = google_compute_subnetwork.gke.name
}

output "gke_subnet_id" {
  description = "ID de la subred de GKE"
  value       = google_compute_subnetwork.gke.id
}

output "vm_subnet_name" {
  description = "Nombre de la subred de VMs"
  value       = google_compute_subnetwork.vms.name
}
