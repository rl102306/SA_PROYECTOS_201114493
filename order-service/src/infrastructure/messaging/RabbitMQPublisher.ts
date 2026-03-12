import * as amqplib from 'amqplib';

const EXCHANGE = 'delivereats.orders';
const RETRY_DELAY = 5000;
const MAX_RETRIES = 10;

let connection: any = null;
let channel: any = null;
let retryCount = 0;

async function connect(): Promise<void> {
  const url = process.env.RABBITMQ_URL || 'amqp://delivereats:delivereats_pass@localhost:5672';
  try {
    connection = await amqplib.connect(url);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    retryCount = 0;
    console.log('✅ RabbitMQ Publisher conectado');

    connection.on('error', (err: any) => {
      console.error('❌ RabbitMQ connection error:', err.message);
      scheduleReconnect();
    });
    connection.on('close', () => {
      console.warn('⚠️ RabbitMQ connection closed, reconectando...');
      scheduleReconnect();
    });
  } catch (err: any) {
    console.warn(`⚠️ RabbitMQ no disponible (intento ${retryCount + 1}): ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(connect, RETRY_DELAY);
  }
}

export async function initRabbitMQPublisher(): Promise<void> {
  await connect();
}

export function publishOrderCreated(order: {
  orderId: string;
  restaurantId: string;
  userId: string;
  totalAmount: number;
  deliveryAddress: string;
  items: any[];
}): void {
  if (!channel) {
    console.warn('⚠️ RabbitMQ channel no disponible, omitiendo publicación');
    return;
  }
  try {
    const message = JSON.stringify({ event: 'ORDER_CREATED', ...order, timestamp: new Date().toISOString() });
    channel.publish(EXCHANGE, 'order.created', Buffer.from(message), { persistent: true });
    console.log(`📤 Evento ORDER_CREATED publicado para restaurante ${order.restaurantId}`);
  } catch (err: any) {
    console.error('❌ Error publicando a RabbitMQ:', err.message);
  }
}
