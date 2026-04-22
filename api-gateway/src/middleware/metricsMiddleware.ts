import { Registry, collectDefaultMetrics, Histogram, Counter } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Registry global — agrupa todas las métricas del proceso
export const register = new Registry();
register.setDefaultLabels({ app: 'api-gateway' });

// Métricas por defecto de Node.js: event loop lag, heap, GC, handles, etc.
collectDefaultMetrics({ register });

// ── Histogram: duración de cada request HTTP ──────────────────────────────
// Buckets en segundos: miden desde requests muy rápidos (10ms) hasta lentos (10s)
// Permite calcular p50, p95, p99 en Grafana con histogram_quantile()
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de requests HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// ── Counter: total de requests por ruta y resultado ───────────────────────
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP procesados',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// ── Counter: errores (status >= 500) ──────────────────────────────────────
export const httpErrorTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total de errores HTTP (5xx)',
  labelNames: ['method', 'route'],
  registers: [register]
});

// ── Middleware Express ─────────────────────────────────────────────────────
// Intercepta cada request, inicia el timer y registra métricas al finalizar.
// Se usa res.on('finish') para garantizar que tenemos el status code final.

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    // Normalizar la ruta: reemplaza IDs dinámicos para no crear cardinalidad alta
    // Ejemplo: /orders/abc-123-def → /orders/:id
    const route = req.route?.path || normalizeRoute(req.path);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    end(labels);
    httpRequestTotal.inc(labels);

    if (res.statusCode >= 500) {
      httpErrorTotal.inc({ method: req.method, route });
    }
  });

  next();
}

// Normaliza rutas con IDs para evitar cardinalidad explosiva en Prometheus.
// /orders/550e8400-e29b → /orders/:id
// /catalog/restaurants/abc123/products → /catalog/restaurants/:id/products
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}
