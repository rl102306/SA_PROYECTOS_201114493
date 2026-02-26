import { IDeliveryRepository } from '../../domain/interfaces/IDeliveryRepository';
import { Delivery } from '../../domain/entities/Delivery';

export interface AcceptDeliveryDTO {
  deliveryId: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
}

export class AcceptDeliveryUseCase {
  constructor(
    private readonly deliveryRepository: IDeliveryRepository
  ) {}

  async execute(dto: AcceptDeliveryDTO): Promise<Delivery> {
    console.log(`🚴 Repartidor ${dto.deliveryPersonName} aceptando entrega ${dto.deliveryId}`);

    // Buscar la entrega
    const delivery = await this.deliveryRepository.findById(dto.deliveryId);

    if (!delivery) {
      throw new Error(`Entrega ${dto.deliveryId} no encontrada`);
    }

    // Asignar al repartidor
    delivery.assignToDeliveryPerson(dto.deliveryPersonId, dto.deliveryPersonName);

    // Guardar
    const updatedDelivery = await this.deliveryRepository.update(delivery);

    console.log(`✅ Entrega ${dto.deliveryId} asignada a ${dto.deliveryPersonName}`);

    return updatedDelivery;
  }
}
