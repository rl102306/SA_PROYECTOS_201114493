# ERROR_VOL — Guia de Fallos Voluntarios en el Pipeline CI/CD

**Universidad de San Carlos de Guatemala**
**Curso: Software Avanzado — 2026**
**Carnet: 201114493**

Este documento describe como provocar fallos voluntarios en cada etapa del
pipeline de CI/CD para demostrar que el sistema de deteccion de errores funciona
correctamente y que los jobs dependientes se cancelan automaticamente.

---

## Como ver los resultados

1. Ir al repositorio en GitHub
2. Hacer clic en la pestana **"Actions"**
3. Seleccionar el ultimo workflow run
4. Los jobs fallidos aparecen en rojo con una X
5. Los jobs que dependian del fallido aparecen cancelados (icono gris)

---

## Fallo 1 — Etapa BUILD (Error de compilacion Docker)

### Como provocarlo

Agregar una instruccion invalida en cualquier Dockerfile. Por ejemplo en `api-gateway/Dockerfile`:

```dockerfile
# Agregar esta linea invalida al final del Dockerfile
RUN comando_que_no_existe_en_docker
```

### Que ocurre en el pipeline

```
Job: Build Docker Images   ❌ FALLA
Job: Run Unit Tests        ✅ corre en paralelo (independiente del build)
Job: Push Images           ⛔ CANCELADO (necesita que build pase)
Job: Deploy to GKE         ⛔ CANCELADO (necesita que push pase)
```

### Como revertir

Eliminar la linea invalida del Dockerfile y hacer push nuevamente.

---

## Fallo 2 — Etapa TEST (Test unitario falla)

### Como provocarlo

Modificar un assertion en cualquier archivo de tests para que falle.
Por ejemplo en `auth-service/__tests__/login.test.ts`:

```typescript
// Cambiar esta linea:
expect(result.token).toBeDefined();
// Por esta (siempre falla):
expect(1).toBe(2);
```

### Que ocurre en el pipeline

```
Job: Build Docker Images   ✅ corre en paralelo (independiente de tests)
Job: Run Unit Tests        ❌ FALLA — Jest reporta test fallido
Job: Push Images           ⛔ CANCELADO (necesita que test pase)
Job: Deploy to GKE         ⛔ CANCELADO (necesita que push pase)
```

El pipeline imprime en los logs exactamente que test fallo y en que linea,
lo que permite identificar y corregir el problema rapidamente.

### Como revertir

Restaurar el assertion original y hacer push.

---

## Fallo 3 — Etapa PUSH (Sin permisos al registry)

### Como provocarlo

Revocar el permiso `roles/artifactregistry.writer` del service account de GitHub Actions:

```bash
gcloud projects remove-iam-policy-binding delivereats-201114493 \
  --member="serviceAccount:github-actions-sa@delivereats-201114493.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"
```

### Que ocurre en el pipeline

```
Job: Build Docker Images   ✅ PASA
Job: Run Unit Tests        ✅ PASA
Job: Push Images           ❌ FALLA — 403 Forbidden al hacer docker push
Job: Deploy to GKE         ⛔ CANCELADO
```

### Como revertir

Restaurar el permiso:

```bash
gcloud projects add-iam-policy-binding delivereats-201114493 \
  --member="serviceAccount:github-actions-sa@delivereats-201114493.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"
```

---

## Fallo 4 — Etapa DEPLOY (Manifest invalido)

### Como provocarlo

Cambiar el nombre de una imagen a una que no existe en el registry.
Por ejemplo en `k8s/api-gateway/api-gateway.yaml`:

```yaml
# Cambiar:
image: delivereats/api-gateway:latest
# Por:
image: delivereats/servicio-que-no-existe:latest
```

### Que ocurre en el pipeline

```
Job: Build Docker Images   ✅ PASA
Job: Run Unit Tests        ✅ PASA
Job: Push Images           ✅ PASA
Job: Deploy to GKE         ❌ FALLA — kubectl reporta ImagePullBackOff
```

El resumen del despliegue en los logs muestra el estado de los pods,
donde se puede ver el error de imagen.

### Como revertir

Restaurar el nombre de imagen correcto y hacer push.

---

## Resumen de dependencias del pipeline

```
[ Build ] ──┐
            ├──► [ Push ] ──► [ Deploy ]
[ Test  ] ──┘
```

- **Build y Test** corren en paralelo (independientes entre si)
- **Push** solo corre si AMBOS (Build y Test) pasan
- **Deploy** solo corre si Push pasa
- Solo se ejecuta push y deploy en la rama `main`

Esta cadena garantiza que ningun codigo roto llegue al cluster de produccion.

---

## Evidencia esperada en GitHub Actions

Al provocar un fallo, el workflow run en GitHub Actions deberia verse asi:

| Job | Estado |
|---|---|
| Build Docker Images | ❌ Failure / ✅ Success |
| Run Unit Tests | ❌ Failure / ✅ Success |
| Push Images to Artifact Registry | ❌ Failure / ⛔ Cancelled |
| Deploy to GKE | ⛔ Cancelled |

El color rojo en GitHub Actions indica fallo, el gris indica cancelacion
por dependencia fallida.
