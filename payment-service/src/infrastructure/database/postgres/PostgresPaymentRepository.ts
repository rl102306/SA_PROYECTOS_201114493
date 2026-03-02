import { Pool } from 'pg';
import { Payment, PaymentMethod, PaymentStatus } from '../../../domain/entities/Payment';
import { IPaymentRepository } from '../../../domain/interfaces/IPaymentRepository';

export class PostgresPaymentRepository implements IPaymentRepository {
  constructor(private readonly pool: Pool) {}

  async save(payment: Payment): Promise<Payment> {
    const query = `
      INSERT INTO payments (id, order_id, amount, currency, amount_gtq, amount_usd, exchange_rate, payment_method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      payment.id,
      payment.orderId,
      payment.amount,
      payment.currency,
      payment.amountGtq,
      payment.amountUsd,
      payment.exchangeRate,
      payment.paymentMethod,
      payment.status,
      payment.createdAt
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const result = await this.pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await this.pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  private mapToEntity(row: any): Payment {
    return new Payment({
      id: row.id,
      orderId: row.order_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      amountGtq: parseFloat(row.amount_gtq),
      amountUsd: parseFloat(row.amount_usd),
      exchangeRate: parseFloat(row.exchange_rate),
      paymentMethod: row.payment_method as PaymentMethod,
      status: row.status as PaymentStatus,
      createdAt: new Date(row.created_at)
    });
  }
}
