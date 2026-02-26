# 📚 GUÍA RÁPIDA - Delivereats

## 🧪 Pruebas Locales

```bash
# 1. Configurar SMTP
cp .env.example .env
nano .env  # Editar con tus credenciales Gmail

# 2. Levantar todo
docker-compose up -d --build

# 3. Insertar productos
./insert-products.sh

# 4. Acceder
http://localhost:4200
```

**Prueba el flujo:**
1. Registrarse
2. Login
3. Crear orden
4. ✅ Recibir email de confirmación

---

## ☁️ Despliegue en GCP

### Opción Rápida (Scripts)

```bash
# 1. Construir y subir imágenes
./deploy-build.sh

# 2. Seguir DESPLIEGUE-GCP.md para:
#    - Crear Cloud SQL
#    - Crear Secrets
#    - Desplegar servicios
```

### Opción Manual

Ver: `DESPLIEGUE-GCP.md` para paso a paso completo.

---

## 📖 Documentación

| Archivo | Contenido |
|---------|-----------|
| `README.md` | Documentación general |
| `PROYECTO-COMPLETO.md` | Visión general de los 6 servicios |
| `PRUEBAS-LOCALES.md` | Guía completa de pruebas locales |
| `DESPLIEGUE-GCP.md` | Guía completa para la nube |
| `RUBRICA-COMPLETA.md` | Mapeo de requisitos del proyecto |
| `QUE-ES-GRPC.md` | Explicación de gRPC |
| `EXPLICACION-VALIDACIONES.md` | Cómo funcionan las validaciones |

---

## 🏗️ Arquitectura

```
Frontend (Angular) → API Gateway (REST) → Microservicios (gRPC)
                                        ├─ Auth Service
                                        ├─ Catalog Service
                                        ├─ Order Service
                                        ├─ Delivery Service
                                        └─ Notification Service
```

---

## 📡 Puertos Locales

| Servicio | Puerto |
|----------|--------|
| Frontend | 4200 |
| API Gateway | 3000 |
| Auth Service | 50052 |
| Catalog Service | 50051 |
| Order Service | 50053 |
| Delivery Service | 50054 |
| Notification Service | 50055 |

---

## 🔑 Variables de Entorno Importantes

```env
# SMTP (requerido para Notification Service)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=app-password

# JWT
JWT_SECRET=tu-secret-super-seguro

# Databases (automático en Docker)
DB_HOST=localhost
DB_PORT=5432  # Auth
DB_PORT=5433  # Catalog
DB_PORT=5434  # Order
DB_PORT=5435  # Delivery
```

---

## 🐛 Comandos Útiles

### Docker

```bash
# Ver servicios
docker-compose ps

# Logs
docker-compose logs -f [servicio]

# Reiniciar
docker-compose restart [servicio]

# Limpiar todo
docker-compose down -v
```

### Base de Datos

```bash
# Conectar a Auth DB
docker exec -it delivereats-auth-db psql -U auth_user -d auth_db

# Ver usuarios
SELECT email, role FROM users;

# Ver órdenes
docker exec -it delivereats-order-db psql -U order_user -d order_db -c "SELECT * FROM orders;"
```

### GCP

```bash
# Ver servicios en la nube
gcloud run services list

# Logs en tiempo real
gcloud run services logs read [servicio] --follow

# Actualizar servicio
gcloud run services update [servicio] --set-env-vars KEY=VALUE
```

---

## ✅ Checklist del Proyecto

### Local
- [ ] Docker instalado
- [ ] Servicios corriendo
- [ ] SMTP configurado
- [ ] Emails funcionando
- [ ] Frontend accesible

### Nube
- [ ] Cuenta GCP con billing
- [ ] gcloud CLI instalado
- [ ] Imágenes subidas a GCR
- [ ] Cloud SQL creado
- [ ] Secrets configurados
- [ ] Servicios desplegados
- [ ] Frontend público accesible

---

## 🎓 Entrega del Proyecto

### Requerido:
1. ✅ Código fuente en GitHub
2. ✅ Tag: v1.0.0
3. ✅ README.md completo
4. ✅ Docker Compose
5. ✅ Colaborador: Samashoas
6. ✅ Repositorio: SA_PROYECTO_[Carnet]

### Documentación:
- Arquitectura de microservicios
- Clean Architecture por servicio
- gRPC communication
- Casos de prueba
- Logs de validaciones
- URL de la aplicación desplegada

---

## 📞 Soporte

Si algo no funciona:

1. Ver logs: `docker-compose logs [servicio]`
2. Verificar `.env`
3. Revisar `SOLUCION-ERRORES.md`
4. Limpiar y reiniciar: `docker-compose down -v && docker-compose up -d`

---

¡Buena suerte! 🚀
