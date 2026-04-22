output "gke_cluster_name" {
  description = "Nombre del cluster GKE"
  value       = module.gke.cluster_name
}

output "artifact_registry_url" {
  description = "URL del Artifact Registry para las imágenes Docker"
  value       = module.gke.registry_url
}

output "cloudsql_private_ip" {
  description = "IP privada de Cloud SQL SQL Server"
  value       = module.cloudsql.private_ip
}

output "cloudsql_connection_name" {
  description = "Connection name para Cloud SQL Proxy"
  value       = module.cloudsql.connection_name
}

output "frontend_url" {
  description = "URL pública del frontend en Cloud Run"
  value       = module.cloudrun.service_url
}

output "loadtest_vm_ip" {
  description = "IP pública de la VM de load testing (usar en inventario de Ansible)"
  value       = module.vm.public_ip
}
