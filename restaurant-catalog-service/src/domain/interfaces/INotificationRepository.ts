export interface OrderNotification {
  id: string;
  restaurantId: string;
  orderId: string;
  userId: string;
  totalAmount: number;
  deliveryAddress: string;
  items: any[];
  isRead: boolean;
  createdAt: Date;
}

export interface INotificationRepository {
  save(notification: Omit<OrderNotification, 'id' | 'createdAt'>): Promise<OrderNotification>;
  findByRestaurantId(restaurantId: string, unreadOnly?: boolean): Promise<OrderNotification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(restaurantId: string): Promise<void>;
}
