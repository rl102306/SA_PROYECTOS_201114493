import { Pool } from 'pg';
import { INotificationRepository, OrderNotification } from '../../../domain/interfaces/INotificationRepository';

export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async save(notification: Omit<OrderNotification, 'id' | 'createdAt'>): Promise<OrderNotification> {
    const query = `
      INSERT INTO restaurant_order_notifications
        (restaurant_id, order_id, user_id, total_amount, delivery_address, items, is_read)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      notification.restaurantId,
      notification.orderId,
      notification.userId,
      notification.totalAmount,
      notification.deliveryAddress || '',
      JSON.stringify(notification.items),
      false
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findByRestaurantId(restaurantId: string, unreadOnly = false): Promise<OrderNotification[]> {
    const query = unreadOnly
      ? `SELECT * FROM restaurant_order_notifications WHERE restaurant_id = $1 AND is_read = false ORDER BY created_at DESC`
      : `SELECT * FROM restaurant_order_notifications WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 50`;
    const result = await this.pool.query(query, [restaurantId]);
    return result.rows.map(r => this.mapToEntity(r));
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE restaurant_order_notifications SET is_read = true WHERE id = $1',
      [notificationId]
    );
  }

  async markAllAsRead(restaurantId: string): Promise<void> {
    await this.pool.query(
      'UPDATE restaurant_order_notifications SET is_read = true WHERE restaurant_id = $1',
      [restaurantId]
    );
  }

  private mapToEntity(row: any): OrderNotification {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      orderId: row.order_id,
      userId: row.user_id,
      totalAmount: parseFloat(row.total_amount),
      deliveryAddress: row.delivery_address,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      isRead: row.is_read,
      createdAt: new Date(row.created_at)
    };
  }
}
