output "instance_name" {
  value = google_sql_database_instance.mssql.name
}

output "private_ip" {
  description = "IP privada de Cloud SQL (accesible desde los pods via VPC)"
  value       = google_sql_database_instance.mssql.private_ip_address
}

output "connection_name" {
  description = "Connection name para Cloud SQL Proxy"
  value       = google_sql_database_instance.mssql.connection_name
}
