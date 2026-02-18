export enum DeliveryStatus {
  PENDING = 'PENDING',           // Esperando asignación
  ASSIGNED = 'ASSIGNED',         // Asignado a repartidor
  PICKED_UP = 'PICKED_UP',       // Recogido del restaurante
  IN_TRANSIT = 'IN_TRANSIT',     // En camino al cliente
  DELIVERED = 'DELIVERED',       // Entregado
  CANCELLED = 'CANCELLED'        // Cancelado
}

export interface DeliveryProps {
  id: string;
  orderId: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  status: DeliveryStatus;
  pickupAddress: string;
  deliveryAddress: string;
  estimatedTime?: number;
  actualDeliveryTime?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Delivery {
  private props: DeliveryProps;

  constructor(props: DeliveryProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get deliveryPersonId(): string | undefined {
    return this.props.deliveryPersonId;
  }

  get deliveryPersonName(): string | undefined {
    return this.props.deliveryPersonName;
  }

  get status(): DeliveryStatus {
    return this.props.status;
  }

  get pickupAddress(): string {
    return this.props.pickupAddress;
  }

  get deliveryAddress(): string {
    return this.props.deliveryAddress;
  }

  get estimatedTime(): number | undefined {
    return this.props.estimatedTime;
  }

  get actualDeliveryTime(): Date | undefined {
    return this.props.actualDeliveryTime;
  }

  get cancellationReason(): string | undefined {
    return this.props.cancellationReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Métodos de negocio
  assignToDeliveryPerson(deliveryPersonId: string, deliveryPersonName: string): void {
    if (this.props.status !== DeliveryStatus.PENDING) {
      throw new Error('Solo se pueden asignar entregas pendientes');
    }
    
    this.props.deliveryPersonId = deliveryPersonId;
    this.props.deliveryPersonName = deliveryPersonName;
    this.props.status = DeliveryStatus.ASSIGNED;
    this.props.updatedAt = new Date();
  }

  markAsPickedUp(): void {
    if (this.props.status !== DeliveryStatus.ASSIGNED) {
      throw new Error('Solo se puede recoger una entrega asignada');
    }

    this.props.status = DeliveryStatus.PICKED_UP;
    this.props.updatedAt = new Date();
  }

  markInTransit(): void {
    if (this.props.status !== DeliveryStatus.PICKED_UP) {
      throw new Error('Solo se puede marcar en tránsito una entrega recogida');
    }

    this.props.status = DeliveryStatus.IN_TRANSIT;
    this.props.updatedAt = new Date();
  }

  markAsDelivered(): void {
    if (this.props.status !== DeliveryStatus.IN_TRANSIT) {
      throw new Error('Solo se puede entregar una orden en tránsito');
    }

    this.props.status = DeliveryStatus.DELIVERED;
    this.props.actualDeliveryTime = new Date();
    this.props.updatedAt = new Date();
  }

  cancel(reason: string): void {
    if (this.props.status === DeliveryStatus.DELIVERED) {
      throw new Error('No se puede cancelar una entrega ya completada');
    }

    this.props.status = DeliveryStatus.CANCELLED;
    this.props.cancellationReason = reason;
    this.props.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      deliveryPersonId: this.deliveryPersonId,
      deliveryPersonName: this.deliveryPersonName,
      status: this.status,
      pickupAddress: this.pickupAddress,
      deliveryAddress: this.deliveryAddress,
      estimatedTime: this.estimatedTime,
      actualDeliveryTime: this.actualDeliveryTime,
      cancellationReason: this.cancellationReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
