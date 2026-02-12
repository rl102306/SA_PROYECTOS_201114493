# 🚀 Guía Rápida de Inicio - Delivereats

## ⚡ Inicio Rápido en 5 Pasos

### 1️⃣ Descomprimir y entrar al proyecto
```bash
unzip delivereats-project-complete.zip
cd delivereats-project
```

### 2️⃣ Levantar todos los servicios
```bash
docker-compose up -d
```
**Espera 30 segundos** para que todo inicie correctamente.

### 3️⃣ Insertar productos de prueba
```bash
./insert-products.sh
```

### 4️⃣ Ejecutar pruebas automatizadas
```bash
./test-all.sh
```

### 5️⃣ Ver los logs
```bash
docker-compose logs -f order-service catalog-service
```

---

## 🎯 URLs Importantes

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Frontend | http://localhost:4200 | Interfaz web |
| API Gateway | http://localhost:3000 | API REST |
| Auth Service | localhost:50052 | gRPC |
| Catalog Service | localhost:50051 | gRPC |
| Order Service | localhost:50053 | gRPC |

---

## 📝 Prueba Manual Rápida

### Paso 1: Registrar usuario
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "CLIENT"
  }'
```

### Paso 2: Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```
**Guarda el token que te devuelve.**

### Paso 3: Crear orden (reemplaza TOKEN)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -d '{
    "restaurantId": "99999999-9999-9999-9999-999999999999",
    "items": [
      {
        "productId": "11111111-1111-1111-1111-111111111111",
        "quantity": 2,
        "price": 12.99
      }
    ]
  }'
```

---

## 🛠️ Comandos Útiles

```bash
# Ver estado de servicios
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs -f auth-service
docker-compose logs -f order-service
docker-compose logs -f catalog-service

# Reiniciar un servicio
docker-compose restart order-service

# Detener todo
docker-compose down

# Limpiar TODO (⚠️ borra bases de datos)
docker-compose down -v
```

---

## 📊 Verificar que todo funciona

### Check 1: API Gateway
```bash
curl http://localhost:3000/health
# Debe responder: {"status":"OK",...}
```

### Check 2: Ver usuarios en DB
```bash
docker-compose exec auth-db psql -U auth_user -d auth_db -c "SELECT email, role FROM users;"
```

### Check 3: Ver productos en DB
```bash
docker-compose exec catalog-db psql -U catalog_user -d catalog_db -c "SELECT name, price, is_available FROM products;"
```

### Check 4: Ver órdenes en DB
```bash
docker-compose exec order-db psql -U order_user -d order_db -c "SELECT id, status, total_amount FROM orders;"
```

---

## 🎓 Para tus Entregables

### Práctica 2 (Auth + JWT):
1. Ejecuta: `./test-all.sh` (sección de Auth)
2. Captura los logs: `docker-compose logs auth-service > logs-practica2.txt`
3. Toma screenshots de las respuestas

### Práctica 3 (gRPC):
1. Ejecuta: `./test-all.sh` (sección de Orders)
2. Captura los logs: `docker-compose logs order-service catalog-service > logs-practica3.txt`
3. Busca en los logs:
   - ✅ "Validación gRPC exitosa"
   - ❌ "Validación fallida"
   - 📦 "Validando orden para restaurante"

---

## ❓ Problemas Comunes

### "Puerto ya en uso"
```bash
docker-compose down
# Espera 10 segundos
docker-compose up -d
```

### "No hay productos"
```bash
./insert-products.sh
```

### "Token inválido"
```bash
# Haz login de nuevo para obtener un token nuevo
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

---

## 📖 Documentación Completa

Para más detalles, consulta:
- `GUIA-COMPLETA.md` - Guía detallada paso a paso
- `README.md` - Documentación del proyecto

---

## ✅ Checklist Antes de Entregar

- [ ] Todos los servicios levantados: `docker-compose ps`
- [ ] Productos insertados: `./insert-products.sh`
- [ ] Pruebas ejecutadas: `./test-all.sh`
- [ ] Logs capturados para entregables
- [ ] Screenshots tomados
- [ ] Repositorio actualizado
- [ ] Tag v0.3.0 creado
- [ ] Auxiliar agregado como colaborador

---

¡Listo para entregar! 🎉
