import { v4 as uuidv4 } from 'uuid';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  IN_DELIVERY = 'IN_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID'
}

export interface OrderItemProps {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
}

export interface OrderProps {
  id?: string;
  userId: string;
  restaurantId: string;
  items: OrderItemProps[];
  status: OrderStatus;
  totalAmount: number;
  deliveryAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Order {
  private readonly _id: string;
  private _userId: string;
  private _restaurantId: string;
  private _items: OrderItemProps[];
  private _status: OrderStatus;
  private _totalAmount: number;
  private _deliveryAddress?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: OrderProps) {
    this._id = props.id || uuidv4();
    this._userId = props.userId;
    this._restaurantId = props.restaurantId;
    this._items = props.items;
    this._status = props.status;
    this._totalAmount = props.totalAmount;
    this._deliveryAddress = props.deliveryAddress;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  // Getters
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get restaurantId(): string { return this._restaurantId; }
  get items(): OrderItemProps[] { return this._items; }
  get status(): OrderStatus { return this._status; }
  get totalAmount(): number { return this._totalAmount; }
  get deliveryAddress(): string | undefined { return this._deliveryAddress; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Métodos de dominio
  updateStatus(newStatus: OrderStatus): void {
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === OrderStatus.DELIVERED) {
      throw new Error('No se puede cancelar una orden ya entregada');
    }
    this._status = OrderStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  calculateTotal(): number {
    return this._items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  toJSON() {
    return {
      id: this._id,
      userId: this._userId,
      restaurantId: this._restaurantId,
      items: this._items,
      status: this._status,
      totalAmount: this._totalAmount,
      deliveryAddress: this._deliveryAddress,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
