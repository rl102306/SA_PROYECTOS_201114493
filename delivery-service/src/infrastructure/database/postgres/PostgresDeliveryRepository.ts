import { Pool } from 'pg';
import { IDeliveryRepository } from '../../../domain/interfaces/IDeliveryRepository';
import { Delivery, DeliveryStatus } from '../../../domain/entities/Delivery';

export class PostgresDeliveryRepository implements IDeliveryRepository {
  constructor(private readonly pool: Pool) {}

  async save(delivery: Delivery): Promise<Delivery> {
    const query = `
      INSERT INTO deliveries (
        id, order_id, delivery_person_id, delivery_person_name, status,
        pickup_address, delivery_address, estimated_time, actual_delivery_time,
        cancellation_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      delivery.id,
      delivery.orderId,
      delivery.deliveryPersonId || null,
      delivery.deliveryPersonName || null,
      delivery.status,
      delivery.pickupAddress,
      delivery.deliveryAddress,
      delivery.estimatedTime || null,
      delivery.actualDeliveryTime || null,
      delivery.cancellationReason || null,
      delivery.createdAt,
      delivery.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Delivery | null> {
    const result = await this.pool.query(
      'SELECT * FROM deliveries WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  async findByOrderId(orderId: string): Promise<Delivery | null> {
    const result = await this.pool.query(
      'SELECT * FROM deliveries WHERE order_id = $1',
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  async findPendingDeliveries(): Promise<Delivery[]> {
    const result = await this.pool.query(
      'SELECT * FROM deliveries WHERE status = $1 ORDER BY created_at ASC',
      [DeliveryStatus.PENDING]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByDeliveryPersonId(deliveryPersonId: string): Promise<Delivery[]> {
    const result = await this.pool.query(
      'SELECT * FROM deliveries WHERE delivery_person_id = $1 ORDER BY created_at DESC',
      [deliveryPersonId]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async update(delivery: Delivery): Promise<Delivery> {
    const query = `
      UPDATE deliveries SET
        delivery_person_id = $2,
        delivery_person_name = $3,
        status = $4,
        actual_delivery_time = $5,
        cancellation_reason = $6,
        updated_at = $7
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      delivery.id,
      delivery.deliveryPersonId || null,
      delivery.deliveryPersonName || null,
      delivery.status,
      delivery.actualDeliveryTime || null,
      delivery.cancellationReason || null,
      delivery.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  private mapToEntity(row: any): Delivery {
    return new Delivery({
      id: row.id,
      orderId: row.order_id,
      deliveryPersonId: row.delivery_person_id,
      deliveryPersonName: row.delivery_person_name,
      status: row.status as DeliveryStatus,
      pickupAddress: row.pickup_address,
      deliveryAddress: row.delivery_address,
      estimatedTime: row.estimated_time,
      actualDeliveryTime: row.actual_delivery_time,
      cancellationReason: row.cancellation_reason,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
