import { Order } from '../entities/Order';

export interface OrderFilters {
  statuses?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  restaurantId?: string;
}

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  findByRestaurantId(restaurantId: string): Promise<Order[]>;
  findAll(filters: OrderFilters): Promise<Order[]>;
  save(order: Order): Promise<Order>;
  delete(id: string): Promise<void>;
}
