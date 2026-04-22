variable "vm_name" {
  type = string
}

variable "machine_type" {
  type    = string
  default = "e2-medium"
}

variable "zone" {
  type = string
}

variable "vm_subnet_name" {
  type = string
}

variable "environment" {
  type    = string
  default = "prod"
}
