import { Payment } from '../entities/Payment';

export interface IPaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
  refundByOrderId(orderId: string): Promise<Payment | null>;
}
