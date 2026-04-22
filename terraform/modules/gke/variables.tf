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
