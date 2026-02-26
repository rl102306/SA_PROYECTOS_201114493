import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { PostgresOrderRepository } from './infrastructure/database/postgres/PostgresOrderRepository';
import { CreateOrderUseCase } from './application/usecases/CreateOrderUseCase';
import { CatalogServiceClient } from './infrastructure/grpc/clients/CatalogServiceClient';
import { Order } from './domain/entities/Order';
import { CreateOrderDTO } from './application/dtos/CreateOrderDTO';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/order.proto');
const PORT = process.env.GRPC_PORT || 50053;

interface CreateOrderRequest {
  user_id: string;
  restaurant_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
  delivery_address: string;
}

interface OrderResponse {
  success: boolean;
  message: string;
  order?: any;
}

async function main() {
  try {
    console.log('🚀 Iniciando Order Service...');

    const pool = createDatabasePool();
    await initializeDatabase(pool);

    const orderRepository = new PostgresOrderRepository(pool);
    const catalogClient = new CatalogServiceClient();
    const createOrderUseCase = new CreateOrderUseCase(orderRepository, catalogClient);

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const orderProto = grpc.loadPackageDefinition(packageDefinition).order as any;
    const server = new grpc.Server();

    server.addService(orderProto.OrderService.service, {
      CreateOrder: async (call: any, callback: any) => {
        try {
          const request: CreateOrderRequest = call.request;

         const dto = new CreateOrderDTO({
			  userId: request.user_id,
			  restaurantId: request.restaurant_id,
			  items: request.items.map((item: any) => ({
				productId: item.product_id,
				quantity: item.quantity,
				price: item.price
			  })),
			  deliveryAddress: request.delivery_address
			});

		const order = await createOrderUseCase.execute(dto);
          callback(null, {
            success: true,
            message: 'Orden creada exitosamente',
            order: {
              id: order.id,
              user_id: order.userId,
              restaurant_id: order.restaurantId,
              items: JSON.stringify(order.items),
              status: order.status,
              total_amount: order.totalAmount,
              delivery_address: order.deliveryAddress,
              created_at: order.createdAt.toISOString()
            }
          });
        } catch (error: any) {
          callback(null, {
            success: false,
            message: error.message || 'Error al crear orden'
          });
        }
      },

      GetOrder: async (call: any, callback: any) => {
        try {
          const order: Order | null = await orderRepository.findById(call.request.order_id);

          if (!order) {
            callback(null, { success: false, message: 'Orden no encontrada' });
            return;
          }

          callback(null, {
            success: true,
            order: {
              id: order.id,
              user_id: order.userId,
              restaurant_id: order.restaurantId,
              status: order.status,
              total_amount: order.totalAmount
            }
          });
        } catch (error: any) {
          callback(null, { success: false, message: error.message });
        }
      }
    });

    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        console.error('❌ Error:', error);
        return;
      }
      console.log(`🚀 Order Service en puerto ${port}`);
    });

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();