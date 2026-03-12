import { Coupon } from '../entities/Coupon';

export interface ICouponRepository {
  save(coupon: Coupon): Promise<Coupon>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  findByRestaurantId(restaurantId: string): Promise<Coupon[]>;
  findPendingApproval(): Promise<Coupon[]>;
  delete(id: string): Promise<void>;
}
