import { AcceptDeliveryUseCase } from '../../../application/usecases/AcceptDeliveryUseCase';
import { UpdateDeliveryStatusUseCase } from '../../../application/usecases/UpdateDeliveryStatusUseCase';
import { GetPendingDeliveriesUseCase } from '../../../application/usecases/GetPendingDeliveriesUseCase';
import { IDeliveryRepository } from '../../../domain/interfaces/IDeliveryRepository';
import { Delivery, DeliveryStatus } from '../../../domain/entities/Delivery';
import { v4 as uuidv4 } from 'uuid';

export class DeliveryServiceHandler {
  private acceptDeliveryUseCase: AcceptDeliveryUseCase;
  private updateDeliveryStatusUseCase: UpdateDeliveryStatusUseCase;
  private getPendingDeliveriesUseCase: GetPendingDeliveriesUseCase;

  constructor(private readonly deliveryRepository: IDeliveryRepository) {
    this.acceptDeliveryUseCase = new AcceptDeliveryUseCase(deliveryRepository);
    this.updateDeliveryStatusUseCase = new UpdateDeliveryStatusUseCase(deliveryRepository);
    this.getPendingDeliveriesUseCase = new GetPendingDeliveriesUseCase(deliveryRepository);
  }

  async AcceptDelivery(call: any, callback: any) {
    try {
      const { delivery_id, delivery_person_id, delivery_person_name } = call.request;

      const delivery = await this.acceptDeliveryUseCase.execute({
        deliveryId: delivery_id,
        deliveryPersonId: delivery_person_id,
        deliveryPersonName: delivery_person_name
      });

      callback(null, {
        success: true,
        message: 'Entrega aceptada exitosamente',
        delivery: this.mapToGrpcDelivery(delivery)
      });
    } catch (error: any) {
      console.error('❌ Error en AcceptDelivery:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al aceptar entrega',
        delivery: null
      });
    }
  }

  async UpdateDeliveryStatus(call: any, callback: any) {
    try {
      const { delivery_id, status, cancellation_reason } = call.request;

      const delivery = await this.updateDeliveryStatusUseCase.execute({
        deliveryId: delivery_id,
        status,
        cancellationReason: cancellation_reason
      });

      callback(null, {
        success: true,
        message: `Estado actualizado a ${status}`,
        delivery: this.mapToGrpcDelivery(delivery)
      });
    } catch (error: any) {
      console.error('❌ Error en UpdateDeliveryStatus:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al actualizar estado',
        delivery: null
      });
    }
  }

  async GetPendingDeliveries(call: any, callback: any) {
    try {
      const deliveries = await this.getPendingDeliveriesUseCase.execute();

      callback(null, {
        success: true,
        message: `${deliveries.length} entregas pendientes`,
        deliveries: deliveries.map(d => this.mapToGrpcDelivery(d))
      });
    } catch (error: any) {
      console.error('❌ Error en GetPendingDeliveries:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al obtener entregas',
        deliveries: []
      });
    }
  }

  async GetDeliveryPersonDeliveries(call: any, callback: any) {
    try {
      const { delivery_person_id } = call.request;
      
      const deliveries = await this.deliveryRepository.findByDeliveryPersonId(delivery_person_id);

      callback(null, {
        success: true,
        message: `${deliveries.length} entregas encontradas`,
        deliveries: deliveries.map(d => this.mapToGrpcDelivery(d))
      });
    } catch (error: any) {
      console.error('❌ Error en GetDeliveryPersonDeliveries:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al obtener entregas',
        deliveries: []
      });
    }
  }

  async CreateDelivery(call: any, callback: any) {
    try {
      const { order_id, pickup_address, delivery_address, estimated_time } = call.request;

      console.log(`📦 Creando entrega para orden ${order_id}`);

      const delivery = new Delivery({
        id: uuidv4(),
        orderId: order_id,
        status: DeliveryStatus.PENDING,
        pickupAddress: pickup_address,
        deliveryAddress: delivery_address,
        estimatedTime: estimated_time,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedDelivery = await this.deliveryRepository.save(delivery);

      console.log(`✅ Entrega ${savedDelivery.id} creada`);

      callback(null, {
        success: true,
        message: 'Entrega creada exitosamente',
        delivery: this.mapToGrpcDelivery(savedDelivery)
      });
    } catch (error: any) {
      console.error('❌ Error en CreateDelivery:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al crear entrega',
        delivery: null
      });
    }
  }

  private mapToGrpcDelivery(delivery: Delivery): any {
    return {
      id: delivery.id,
      order_id: delivery.orderId,
      delivery_person_id: delivery.deliveryPersonId || '',
      delivery_person_name: delivery.deliveryPersonName || '',
      status: delivery.status,
      pickup_address: delivery.pickupAddress,
      delivery_address: delivery.deliveryAddress,
      estimated_time: delivery.estimatedTime || 0,
      actual_delivery_time: delivery.actualDeliveryTime?.toISOString() || '',
      cancellation_reason: delivery.cancellationReason || '',
      created_at: delivery.createdAt.toISOString(),
      updated_at: delivery.updatedAt.toISOString()
    };
  }
}
