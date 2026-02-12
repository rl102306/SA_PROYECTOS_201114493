import { Pool } from 'pg';
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { PostgresOrderRepository } from '../database/postgres/PostgresOrderRepository';
import { CatalogServiceClient } from '../grpc/clients/CatalogServiceClient';
import { CreateOrderUseCase } from '../../application/usecases/CreateOrderUseCase';

export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  register(pool: Pool): void {
    // Repositories
    const orderRepository: IOrderRepository = new PostgresOrderRepository(pool);
    this.services.set('OrderRepository', orderRepository);

    // gRPC Clients
    const catalogClient = new CatalogServiceClient();
    this.services.set('CatalogServiceClient', catalogClient);

    // Use Cases
    const createOrderUseCase = new CreateOrderUseCase(orderRepository, catalogClient);
    this.services.set('CreateOrderUseCase', createOrderUseCase);
  }

  resolve<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }
    return service as T;
  }
}
