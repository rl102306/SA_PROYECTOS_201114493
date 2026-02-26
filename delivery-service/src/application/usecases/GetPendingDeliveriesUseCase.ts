import { IDeliveryRepository } from '../../domain/interfaces/IDeliveryRepository';
import { Delivery } from '../../domain/entities/Delivery';

export class GetPendingDeliveriesUseCase {
  constructor(
    private readonly deliveryRepository: IDeliveryRepository
  ) {}

  async execute(): Promise<Delivery[]> {
    console.log(`📋 Obteniendo entregas pendientes`);

    const deliveries = await this.deliveryRepository.findPendingDeliveries();

    console.log(`✅ ${deliveries.length} entregas pendientes encontradas`);

    return deliveries;
  }
}
