import { NodemailerEmailService } from '../email/NodemailerEmailService';
import { SendNotificationUseCase } from '../../application/usecases/SendNotificationUseCase';
import { NotificationServiceHandler } from '../grpc/handlers/NotificationServiceHandler';

export class DIContainer {
  private static instance: DIContainer;
  private emailService: NodemailerEmailService;
  private sendNotificationUseCase: SendNotificationUseCase;
  private notificationServiceHandler: NotificationServiceHandler;

  private constructor() {
    this.emailService = new NodemailerEmailService();
    this.sendNotificationUseCase = new SendNotificationUseCase(this.emailService);
    this.notificationServiceHandler = new NotificationServiceHandler(this.sendNotificationUseCase);
  }

  static initialize(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      throw new Error('DIContainer no inicializado');
    }
    return DIContainer.instance;
  }

  getNotificationServiceHandler(): NotificationServiceHandler {
    return this.notificationServiceHandler;
  }
}
