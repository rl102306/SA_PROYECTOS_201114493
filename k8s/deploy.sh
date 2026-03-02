#!/bin/bash
# Script de despliegue de Delivereats en Kubernetes
# Uso: ./deploy.sh [up|down]

set -e

ACTION=${1:-up}

if [ "$ACTION" = "down" ]; then
  echo "🛑 Eliminando namespace delivereats..."
  kubectl delete namespace delivereats --ignore-not-found=true
  echo "✅ Namespace eliminado"
  exit 0
fi

echo "🚀 Desplegando Delivereats en Kubernetes..."

# 1. Namespace
echo "📁 Creando namespace..."
kubectl apply -f namespace/namespace.yaml

# 2. Secretos y configuraciones base
echo "🔐 Aplicando secretos..."
kubectl apply -f auth-service/auth-secret.yaml

# 3. Bases de datos (orden importa: deben estar listas antes que los servicios)
echo "🗄️ Desplegando bases de datos..."
kubectl apply -f auth-service/auth-db-statefulset.yaml
kubectl apply -f catalog-service/catalog-service.yaml
kubectl apply -f order-service/order-service.yaml
kubectl apply -f delivery-service/delivery-service.yaml
kubectl apply -f payment-service/payment-service.yaml

# 4. Redis
echo "📦 Desplegando Redis..."
kubectl apply -f redis/

# 5. Esperar que las DBs estén listas
echo "⏳ Esperando que las bases de datos estén listas..."
kubectl rollout status statefulset/auth-db -n delivereats --timeout=120s
kubectl rollout status statefulset/catalog-db -n delivereats --timeout=120s
kubectl rollout status statefulset/order-db -n delivereats --timeout=120s
kubectl rollout status statefulset/delivery-db -n delivereats --timeout=120s
kubectl rollout status statefulset/payment-db -n delivereats --timeout=120s

# 6. Microservicios
echo "⚙️ Desplegando microservicios..."
kubectl apply -f auth-service/auth-service-deployment.yaml
kubectl apply -f catalog-service/catalog-service.yaml
kubectl apply -f notification-service/notification-service.yaml
kubectl apply -f fx-service/fx-service.yaml

# 7. Esperar FX service para payment
kubectl rollout status deployment/fx-service -n delivereats --timeout=60s

# 8. Payment service (depende de fx-service y order-service)
kubectl apply -f payment-service/payment-service.yaml

# 9. API Gateway
echo "🌐 Desplegando API Gateway..."
kubectl apply -f api-gateway/api-gateway.yaml

# 10. Frontend
echo "🖥️ Desplegando Frontend..."
kubectl apply -f frontend/frontend.yaml

# 11. Verificar estado
echo ""
echo "✅ Despliegue completado. Estado de los pods:"
kubectl get pods -n delivereats

echo ""
echo "🔗 Servicios disponibles:"
kubectl get svc -n delivereats

echo ""
echo "📡 Ingress:"
kubectl get ingress -n delivereats
