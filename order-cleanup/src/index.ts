import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ─── Configuración ───────────────────────────────────────────────────────────

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'order_db',
  user:     process.env.DB_USER     || 'order_user',
  password: process.env.DB_PASSWORD || 'order_password',
};

const AUTH_SERVICE_URL         = process.env.AUTH_SERVICE_URL         || 'localhost:50052';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'localhost:50055';

// Tiempo máximo sin confirmar antes de rechazar (en minutos)
const PENDING_TIMEOUT_MINUTES = parseInt(process.env.PENDING_TIMEOUT_MINUTES || '60');

// ─── gRPC clients ─────────────────────────────────────────────────────────────

function loadAuthClient(): any {
  const def = protoLoader.loadSync(path.join(__dirname, 'proto/auth.proto'), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(def).auth as any;
  return new proto.AuthService(AUTH_SERVICE_URL, grpc.credentials.createInsecure());
}

function loadNotificationClient(): any {
  const def = protoLoader.loadSync(path.join(__dirname, 'proto/notification.proto'), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(def).notification as any;
  return new proto.NotificationService(NOTIFICATION_SERVICE_URL, grpc.credentials.createInsecure());
}

// Wrapper de promesa para llamadas gRPC
function grpcCall<T>(client: any, method: string, request: object): Promise<T> {
  return new Promise((resolve, reject) => {
    client[method](request, (err: any, response: T) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`[order-cleanup] Iniciando — ${new Date().toISOString()}`);
  console.log(`[order-cleanup] Timeout configurado: ${PENDING_TIMEOUT_MINUTES} minutos`);

  const pool = new Pool(DB_CONFIG);

  // Asegurar que la columna anti-spam exista (idempotente)
  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS rejection_notified BOOLEAN NOT NULL DEFAULT false
  `);

  // Buscar órdenes PENDING sin atender que superaron el timeout
  // Anti-spam: rejection_notified = false garantiza que no enviamos email duplicado
  const { rows: expiredOrders } = await pool.query<{
    id: string;
    user_id: string;
    restaurant_id: string;
    items: any;
    total_amount: string;
    created_at: Date;
  }>(`
    SELECT id, user_id, restaurant_id, items, total_amount, created_at
    FROM orders
    WHERE status = 'PENDING'
      AND rejection_notified = false
      AND created_at < NOW() - INTERVAL '${PENDING_TIMEOUT_MINUTES} minutes'
  `);

  console.log(`[order-cleanup] Órdenes expiradas encontradas: ${expiredOrders.length}`);

  if (expiredOrders.length === 0) {
    console.log('[order-cleanup] Nada que procesar. Saliendo.');
    await pool.end();
    return;
  }

  const authClient         = loadAuthClient();
  const notificationClient = loadNotificationClient();

  let notificacionesEnviadas = 0;
  let errores = 0;

  for (const order of expiredOrders) {
    console.log(`[order-cleanup] Procesando orden ${order.id} (creada: ${order.created_at.toISOString()})`);

    try {
      // 1. Obtener datos del usuario (email, nombre) desde auth-service
      const userResponse = await grpcCall<any>(authClient, 'GetUserById', {
        user_id: order.user_id
      });

      const userEmail = userResponse?.user?.email || '';
      const userName  = `${userResponse?.user?.first_name || ''} ${userResponse?.user?.last_name || ''}`.trim();

      if (!userEmail) {
        console.warn(`[order-cleanup] Usuario ${order.user_id} sin email, se omite notificación.`);
      }

      // 2. Construir resumen de productos para el email
      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
      const products = items
        .map((i: any) => `${i.productName || i.product_name || 'Producto'} x${i.quantity}`)
        .join(', ');

      // 3. Actualizar estado + marcar como notificado en una sola query atómica
      //    Patrón: UPDATE con WHERE para evitar condición de carrera si dos jobs corren en paralelo
      const updateResult = await pool.query(
        `UPDATE orders
         SET status = 'CANCELLED',
             rejection_notified = true,
             updated_at = NOW()
         WHERE id = $1
           AND status = 'PENDING'
           AND rejection_notified = false
         RETURNING id`,
        [order.id]
      );

      // Si no se actualizó ninguna fila, otro job ya la procesó — saltar
      if (updateResult.rowCount === 0) {
        console.log(`[order-cleanup] Orden ${order.id} ya fue procesada por otra instancia. Saltando.`);
        continue;
      }

      // 4. Enviar notificación de rechazo (solo si hay email)
      if (userEmail) {
        await grpcCall<any>(notificationClient, 'SendOrderRejectedNotification', {
          user_id:         order.user_id,
          user_email:      userEmail,
          user_name:       userName,
          order_id:        order.id,
          order_number:    order.id.slice(0, 8).toUpperCase(),
          products:        products,
          restaurant_name: 'El restaurante',
          status:          'CANCELLED'
        });
        notificacionesEnviadas++;
        console.log(`[order-cleanup] Notificación enviada para orden ${order.id} → ${userEmail}`);
      }

    } catch (err: any) {
      errores++;
      console.error(`[order-cleanup] Error procesando orden ${order.id}: ${err.message}`);
      // Continúa con la siguiente orden aunque esta falle
    }
  }

  await pool.end();

  // Resumen del run — importante para los logs de K8s
  console.log('─'.repeat(50));
  console.log(`[order-cleanup] Run completado — ${new Date().toISOString()}`);
  console.log(`[order-cleanup] Órdenes procesadas: ${expiredOrders.length}`);
  console.log(`[order-cleanup] Notificaciones enviadas: ${notificacionesEnviadas}`);
  console.log(`[order-cleanup] Errores: ${errores}`);
  console.log('─'.repeat(50));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[order-cleanup] Error fatal:', err);
    process.exit(1);
  });
