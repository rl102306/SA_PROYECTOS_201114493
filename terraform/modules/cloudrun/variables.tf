variable "project_id" {
  type = string
}

variable "service_name" {
  type    = string
  default = "delivereats-frontend"
}

variable "region" {
  type = string
}

variable "image" {
  description = "Imagen Docker del frontend"
  type        = string
}

variable "api_gateway_url" {
  description = "URL del API Gateway (Ingress de GKE)"
  type        = string
  default     = ""
}
