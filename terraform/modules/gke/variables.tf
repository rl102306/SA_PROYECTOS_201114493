variable "project_id" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "zone" {
  type = string
}

variable "region" {
  type = string
}

variable "vpc_name" {
  type = string
}

variable "gke_subnet_name" {
  type = string
}

variable "node_count" {
  type    = number
  default = 2
}

variable "machine_type" {
  type    = string
  default = "e2-standard-2"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "ci_service_account" {
  description = "Email del SA de CI/CD. Si se provee, recibe roles/container.admin para crear ClusterRoles."
  type        = string
  default     = ""
}
