export interface OrderItemDTO {
  productId: string;
  quantity: number;
  price: number;
}

export class CreateOrderDTO {
  userId: string;
  restaurantId: string;
  items: OrderItemDTO[];
  deliveryAddress?: string;

  constructor(data: any) {
    this.userId = data.userId;
    this.restaurantId = data.restaurantId;
    this.items = data.items || [];
    this.deliveryAddress = data.deliveryAddress;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.userId || this.userId.trim().length === 0) {
      errors.push('userId es requerido');
    }

    if (!this.restaurantId || this.restaurantId.trim().length === 0) {
      errors.push('restaurantId es requerido');
    }

    if (!this.items || this.items.length === 0) {
      errors.push('La orden debe tener al menos un producto');
    }

    this.items.forEach((item, index) => {
      if (!item.productId) {
        errors.push(`Item ${index}: productId es requerido`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index}: cantidad debe ser mayor a 0`);
      }
      if (!item.price || item.price < 0) {
        errors.push(`Item ${index}: precio no puede ser negativo`);
      }
    });

    return errors;
  }
}
