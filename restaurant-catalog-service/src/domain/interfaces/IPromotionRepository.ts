import { Promotion } from '../entities/Promotion';

export interface IPromotionRepository {
  save(promotion: Promotion): Promise<Promotion>;
  findById(id: string): Promise<Promotion | null>;
  findByRestaurantId(restaurantId: string): Promise<Promotion[]>;
  findActiveByRestaurantId(restaurantId: string): Promise<Promotion[]>;
  findAllActive(): Promise<Promotion[]>;
  delete(id: string): Promise<void>;
}
