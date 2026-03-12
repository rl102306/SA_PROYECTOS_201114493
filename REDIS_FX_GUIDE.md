# Redis & FX Service — Guía de consultas

## Flujo del tipo de cambio

```
Cliente HTTP  →  API Gateway (:3000)  →  FX Service (:50056)
                                              │
                                    ┌─────────┴──────────┐
                                    │                    │
                               1° Redis               2° API externa
                            clave "fx:USD:GTQ"    open.er-api.com
                            TTL: 24h (86400s)      /v6/latest/USD
                                    │
                           MISS → guarda en Redis
                           HIT  → devuelve directo
                           API FAIL → usa "fx:stale:fx:USD:GTQ"
```

**API externa:** `https://open.er-api.com/v6/latest/{FROM}`
- Pública y gratuita, sin API key
- Ejemplo real: `https://open.er-api.com/v6/latest/USD`
- Responde JSON con todas las tasas desde la moneda base

**Fuente que devuelve el servicio:**
- `"CACHE"` → vino de Redis (TTL vigente)
- `"API"` → vino de open.er-api.com, guardado en Redis
- `"CACHE_FALLBACK"` → API falló, usó copia stale sin TTL

---

## Patrón de claves en Redis

| Clave | Descripción | TTL |
|---|---|---|
| `fx:USD:GTQ` | Tasa USD→GTQ activa | 86400s (24h) |
| `fx:stale:fx:USD:GTQ` | Copia permanente de respaldo | Sin TTL |

---

## Acceder a redis-cli

### Con Docker (local)
```bash
# Entrar al contenedor interactivo
docker exec -it delivereats-redis redis-cli

# Ejecutar comando directo sin entrar
docker exec delivereats-redis redis-cli KEYS "*"
docker exec delivereats-redis redis-cli GET "fx:USD:GTQ"
```

### Con Kubernetes (GKE)
```bash
# El pod se llama redis-0 (StatefulSet)
kubectl exec -it redis-0 -n delivereats -- redis-cli

# Comando directo sin entrar
kubectl exec redis-0 -n delivereats -- redis-cli KEYS "*"
kubectl exec redis-0 -n delivereats -- redis-cli GET "fx:USD:GTQ"
```

---

## Comandos redis-cli importantes

```bash
# Ver todas las claves guardadas
KEYS *

# Obtener una tasa específica
GET fx:USD:GTQ

# Ver tiempo de vida restante en segundos (-1 = sin TTL, -2 = no existe)
TTL fx:USD:GTQ

# Ver la copia stale/fallback (no expira nunca)
GET fx:stale:fx:USD:GTQ

# Tipo de dato de una clave
TYPE fx:USD:GTQ          # → string

# Borrar una clave (fuerza llamada a API en la próxima consulta)
DEL fx:USD:GTQ

# Cantidad total de claves
DBSIZE

# Info general del servidor
INFO server
INFO memory
INFO keyspace
```

---

## Archivos clave del código

| Archivo | Responsabilidad |
|---|---|
| `fx-service/src/infrastructure/http/ExchangeRateApiClient.ts` | Llama a open.er-api.com |
| `fx-service/src/infrastructure/cache/RedisExchangeRateCache.ts` | Lee/escribe en Redis |
| `fx-service/src/application/usecases/GetExchangeRateUseCase.ts` | Lógica: caché → API → fallback |
| `fx-service/src/infrastructure/grpc/handlers/FxServiceHandler.ts` | Handler gRPC |
| `fx-service/src/infrastructure/di/DIContainer.ts` | Inyección de dependencias |

---

## Variables de entorno del fx-service

```env
REDIS_HOST=redis          # nombre del servicio dentro de Docker/K8s
REDIS_PORT=6379
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest   # opcional, es el default
GRPC_PORT=50056
```
