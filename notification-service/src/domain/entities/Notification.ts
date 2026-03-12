export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CANCELLED_BY_CLIENT = 'ORDER_CANCELLED_BY_CLIENT',
  ORDER_CANCELLED_BY_RESTAURANT = 'ORDER_CANCELLED_BY_RESTAURANT',
  ORDER_CANCELLED_BY_DELIVERY = 'ORDER_CANCELLED_BY_DELIVERY',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_IN_TRANSIT = 'ORDER_IN_TRANSIT',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED'
}

export interface NotificationProps {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: NotificationType;
  orderId: string;
  orderNumber: string;
  products: string;
  totalAmount?: number;
  restaurantName?: string;
  deliveryPersonName?: string;
  cancellationReason?: string;
  amountGtq?: number;
  amountUsd?: number;
  exchangeRate?: number;
  paymentMethod?: string;
  currency?: string;
  status: string;
  sentAt?: Date;
  createdAt: Date;
}

export class Notification {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get userEmail(): string {
    return this.props.userEmail;
  }

  get userName(): string {
    return this.props.userName;
  }

  get type(): NotificationType {
    return this.props.type;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get orderNumber(): string {
    return this.props.orderNumber;
  }

  get products(): string {
    return this.props.products;
  }

  get totalAmount(): number | undefined {
    return this.props.totalAmount;
  }

  get restaurantName(): string | undefined {
    return this.props.restaurantName;
  }

  get deliveryPersonName(): string | undefined {
    return this.props.deliveryPersonName;
  }

  get cancellationReason(): string | undefined {
    return this.props.cancellationReason;
  }

  get amountGtq(): number | undefined {
    return this.props.amountGtq;
  }

  get amountUsd(): number | undefined {
    return this.props.amountUsd;
  }

  get exchangeRate(): number | undefined {
    return this.props.exchangeRate;
  }

  get paymentMethod(): string | undefined {
    return this.props.paymentMethod;
  }

  get currency(): string | undefined {
    return this.props.currency;
  }

  get status(): string {
    return this.props.status;
  }

  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  markAsSent(): void {
    this.props.sentAt = new Date();
  }

  toJSON() {
    return { ...this.props };
  }
}
