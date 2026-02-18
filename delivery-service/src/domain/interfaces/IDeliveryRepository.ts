import { Delivery } from '../entities/Delivery';

export interface IDeliveryRepository {
  save(delivery: Delivery): Promise<Delivery>;
  findById(id: string): Promise<Delivery | null>;
  findByOrderId(orderId: string): Promise<Delivery | null>;
  findPendingDeliveries(): Promise<Delivery[]>;
  findByDeliveryPersonId(deliveryPersonId: string): Promise<Delivery[]>;
  update(delivery: Delivery): Promise<Delivery>;
}
