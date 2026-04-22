variable "instance_name" {
  type = string
}

variable "database_version" {
  type    = string
  default = "SQLSERVER_2019_EXPRESS"
}

variable "tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "sql_user" {
  type = string
}

variable "sql_password" {
  type      = string
  sensitive = true
}
