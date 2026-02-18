import { Pool } from 'pg';
import { PostgresDeliveryRepository } from '../database/postgres/PostgresDeliveryRepository';
import { DeliveryServiceHandler } from '../grpc/handlers/DeliveryServiceHandler';

export class DIContainer {
  private static instance: DIContainer;
  private deliveryRepository: PostgresDeliveryRepository;
  private deliveryServiceHandler: DeliveryServiceHandler;

  private constructor(pool: Pool) {
    // Repositorio
    this.deliveryRepository = new PostgresDeliveryRepository(pool);

    // Handler
    this.deliveryServiceHandler = new DeliveryServiceHandler(this.deliveryRepository);
  }

  static initialize(pool: Pool): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer(pool);
    }
    return DIContainer.instance;
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      throw new Error('DIContainer no ha sido inicializado');
    }
    return DIContainer.instance;
  }

  getDeliveryServiceHandler(): DeliveryServiceHandler {
    return this.deliveryServiceHandler;
  }
}
