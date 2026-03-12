import * as amqplib from 'amqplib';
import { INotificationRepository } from '../../domain/interfaces/INotificationRepository';

const EXCHANGE = 'delivereats.orders';
const QUEUE = 'catalog.order.notifications';
const ROUTING_KEY = 'order.created';
const RETRY_DELAY = 5000;
const MAX_RETRIES = 10;

let retryCount = 0;

export async function startOrderConsumer(notificationRepo: INotificationRepository): Promise<void> {
  const url = process.env.RABBITMQ_URL || 'amqp://delivereats:delivereats_pass@localhost:5672';
  try {
    const connection: any = await amqplib.connect(url);
    const channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    const q = await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(q.queue, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    retryCount = 0;
    console.log('✅ RabbitMQ Consumer iniciado, escuchando ordenes...');

    channel.consume(q.queue, async (msg: any) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        console.log(`📥 Nueva orden recibida: ${data.orderId} para restaurante ${data.restaurantId}`);

        await notificationRepo.save({
          restaurantId: data.restaurantId,
          orderId: data.orderId,
          userId: data.userId,
          totalAmount: data.totalAmount || 0,
          deliveryAddress: data.deliveryAddress || '',
          items: data.items || [],
          isRead: false
        });

        channel.ack(msg);
      } catch (err: any) {
        console.error('❌ Error procesando mensaje RabbitMQ:', err.message);
        channel.nack(msg, false, false);
      }
    });

    connection.on('error', (err: any) => {
      console.error('❌ RabbitMQ consumer error:', err.message);
      scheduleReconnect(notificationRepo);
    });
    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ consumer connection closed, reconectando...');
      scheduleReconnect(notificationRepo);
    });
  } catch (err: any) {
    console.warn(`⚠️ RabbitMQ consumer no disponible (intento ${retryCount + 1}): ${err.message}`);
    scheduleReconnect(notificationRepo);
  }
}

function scheduleReconnect(notificationRepo: INotificationRepository): void {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(() => startOrderConsumer(notificationRepo), RETRY_DELAY);
  }
}
