import { IDeliveryRepository } from '../../domain/interfaces/IDeliveryRepository';
import { Delivery, DeliveryStatus } from '../../domain/entities/Delivery';

export interface UpdateDeliveryStatusDTO {
  deliveryId: string;
  status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  cancellationReason?: string;
  deliveryPhoto?: string;  // base64, requerido cuando status=DELIVERED
}

export class UpdateDeliveryStatusUseCase {
  constructor(
    private readonly deliveryRepository: IDeliveryRepository
  ) {}

  async execute(dto: UpdateDeliveryStatusDTO): Promise<Delivery> {
    console.log(`📦 Actualizando estado de entrega ${dto.deliveryId} a ${dto.status}`);

    // Buscar la entrega
    const delivery = await this.deliveryRepository.findById(dto.deliveryId);

    if (!delivery) {
      throw new Error(`Entrega ${dto.deliveryId} no encontrada`);
    }

    // Actualizar según el estado
    switch (dto.status) {
      case 'PICKED_UP':
        delivery.markAsPickedUp();
        console.log(`✅ Pedido recogido del restaurante`);
        break;

      case 'IN_TRANSIT':
        delivery.markInTransit();
        console.log(`🚗 Pedido en camino al cliente`);
        break;

      case 'DELIVERED':
        if (!dto.deliveryPhoto || dto.deliveryPhoto.trim() === '') {
          throw new Error('Se requiere foto de entrega (base64) para marcar como ENTREGADO');
        }
        delivery.markAsDelivered(dto.deliveryPhoto);
        console.log(`✅ Pedido entregado exitosamente con foto`);
        break;

      case 'CANCELLED':
        if (!dto.cancellationReason) {
          throw new Error('Se requiere una razón para cancelar la entrega');
        }
        delivery.cancel(dto.cancellationReason);
        console.log(`❌ Entrega cancelada: ${dto.cancellationReason}`);
        break;

      default:
        throw new Error(`Estado ${dto.status} no válido`);
    }

    // Guardar
    const updatedDelivery = await this.deliveryRepository.update(delivery);

    console.log(`✅ Estado actualizado correctamente`);

    return updatedDelivery;
  }
}
