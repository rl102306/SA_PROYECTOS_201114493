import { Pool } from 'pg';
import { Order, OrderStatus } from '../../../domain/entities/Order';
import { IOrderRepository, OrderFilters } from '../../../domain/interfaces/IOrderRepository';

export class PostgresOrderRepository implements IOrderRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [restaurantId]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async save(order: Order): Promise<Order> {
    const query = `
      INSERT INTO orders (id, user_id, restaurant_id, items, status, total_amount, delivery_address, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        restaurant_id = EXCLUDED.restaurant_id,
        items = EXCLUDED.items,
        status = EXCLUDED.status,
        total_amount = EXCLUDED.total_amount,
        delivery_address = EXCLUDED.delivery_address,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      order.id,
      order.userId,
      order.restaurantId,
      JSON.stringify(order.items),
      order.status,
      order.totalAmount,
      order.deliveryAddress || null,
      order.createdAt,
      order.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findAll(filters: OrderFilters): Promise<Order[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(`status = ANY($${idx++})`);
      values.push(filters.statuses);
    }
    if (filters.dateFrom) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filters.dateTo);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${idx++}`);
      values.push(filters.userId);
    }
    if (filters.restaurantId) {
      conditions.push(`restaurant_id = $${idx++}`);
      values.push(filters.restaurantId);
    }

    const WHERE = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM orders ${WHERE} ORDER BY created_at DESC`,
      values
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM orders WHERE id = $1', [id]);
  }

  private mapToEntity(row: any): Order {
    return new Order({
      id: row.id,
      userId: row.user_id,
      restaurantId: row.restaurant_id,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      status: row.status as OrderStatus,
      totalAmount: parseFloat(row.total_amount),
      deliveryAddress: row.delivery_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}
