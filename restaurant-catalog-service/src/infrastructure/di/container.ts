import { Pool } from 'pg';
import { IProductRepository } from '../../domain/interfaces/IProductRepository';
import { IRestaurantRepository } from '../../domain/interfaces/IRestaurantRepository';
import { IPromotionRepository } from '../../domain/interfaces/IPromotionRepository';
import { ICouponRepository } from '../../domain/interfaces/ICouponRepository';
import { IRatingRepository } from '../../domain/interfaces/IRatingRepository';
import { INotificationRepository } from '../../domain/interfaces/INotificationRepository';
import { PostgresProductRepository } from '../database/postgres/PostgresProductRepository';
import { PostgresRestaurantRepository } from '../database/postgres/PostgresRestaurantRepository';
import { PostgresPromotionRepository } from '../database/postgres/PostgresPromotionRepository';
import { PostgresCouponRepository } from '../database/postgres/PostgresCouponRepository';
import { PostgresRatingRepository } from '../database/postgres/PostgresRatingRepository';
import { PostgresNotificationRepository } from '../database/postgres/PostgresNotificationRepository';
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
    const productRepository: IProductRepository = new PostgresProductRepository(pool);
    const restaurantRepository: IRestaurantRepository = new PostgresRestaurantRepository(pool);
    const promotionRepository: IPromotionRepository = new PostgresPromotionRepository(pool);
    const couponRepository: ICouponRepository = new PostgresCouponRepository(pool);
    const ratingRepository: IRatingRepository = new PostgresRatingRepository(pool);
    const notificationRepository: INotificationRepository = new PostgresNotificationRepository(pool);

    this.services.set('ProductRepository', productRepository);
    this.services.set('RestaurantRepository', restaurantRepository);
    this.services.set('PromotionRepository', promotionRepository);
    this.services.set('CouponRepository', couponRepository);
    this.services.set('RatingRepository', ratingRepository);
    this.services.set('NotificationRepository', notificationRepository);

    const validateOrderUseCase = new ValidateOrderUseCase(productRepository);
    this.services.set('ValidateOrderUseCase', validateOrderUseCase);

    const catalogServiceHandler = new CatalogServiceHandler(
      validateOrderUseCase,
      productRepository,
      restaurantRepository,
      promotionRepository,
      couponRepository,
      ratingRepository,
      notificationRepository
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
