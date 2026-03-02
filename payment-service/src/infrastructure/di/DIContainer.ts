import { Pool } from 'pg';
import { PostgresPaymentRepository } from '../database/postgres/PostgresPaymentRepository';
import { FxServiceClient } from '../grpc/clients/FxServiceClient';
import { OrderServiceClient } from '../grpc/clients/OrderServiceClient';
import { NotificationServiceClient } from '../grpc/clients/NotificationServiceClient';
import { ProcessPaymentUseCase } from '../../application/usecases/ProcessPaymentUseCase';
import { PaymentServiceHandler } from '../grpc/handlers/PaymentServiceHandler';

export class DIContainer {
  private static instance: DIContainer;
  private handler: PaymentServiceHandler;

  private constructor(pool: Pool) {
    const paymentRepository = new PostgresPaymentRepository(pool);
    const fxClient = new FxServiceClient();
    const orderClient = new OrderServiceClient();
    const notificationClient = new NotificationServiceClient();
    const processPaymentUseCase = new ProcessPaymentUseCase(paymentRepository, fxClient, orderClient, notificationClient);
    this.handler = new PaymentServiceHandler(processPaymentUseCase, paymentRepository);
  }

  static initialize(pool: Pool): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer(pool);
    }
    return DIContainer.instance;
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      throw new Error('DIContainer no inicializado');
    }
    return DIContainer.instance;
  }

  getPaymentServiceHandler(): PaymentServiceHandler {
    return this.handler;
  }
}
