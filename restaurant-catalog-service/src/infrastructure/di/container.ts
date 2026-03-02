import { Pool } from 'pg';
import { IProductRepository } from '../../domain/interfaces/IProductRepository';
import { IRestaurantRepository } from '../../domain/interfaces/IRestaurantRepository';
import { PostgresProductRepository } from '../database/postgres/PostgresProductRepository';
import { PostgresRestaurantRepository } from '../database/postgres/PostgresRestaurantRepository';
import { ValidateOrderUseCase } from '../../application/usecases/ValidateOrderUseCase';
import { CatalogServiceHandler } from '../grpc/handlers/CatalogServiceHandler';

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
    const productRepository: IProductRepository = new PostgresProductRepository(pool);
    const restaurantRepository: IRestaurantRepository = new PostgresRestaurantRepository(pool);
    this.services.set('ProductRepository', productRepository);
    this.services.set('RestaurantRepository', restaurantRepository);

    // Use Cases
    const validateOrderUseCase = new ValidateOrderUseCase(productRepository);
    this.services.set('ValidateOrderUseCase', validateOrderUseCase);

    // Handlers
    const catalogServiceHandler = new CatalogServiceHandler(
      validateOrderUseCase,
      productRepository,
      restaurantRepository
    );
    this.services.set('CatalogServiceHandler', catalogServiceHandler);
  }

  resolve<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }
    return service as T;
  }
}
