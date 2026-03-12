import { Payment, PaymentMethod } from '../../domain/entities/Payment';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository';
import { ProcessPaymentDTO } from '../dtos/ProcessPaymentDTO';
import { FxServiceClient } from '../../infrastructure/grpc/clients/FxServiceClient';
import { OrderServiceClient } from '../../infrastructure/grpc/clients/OrderServiceClient';
import { NotificationServiceClient } from '../../infrastructure/grpc/clients/NotificationServiceClient';

export class ProcessPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly fxClient: FxServiceClient,
    private readonly orderClient: OrderServiceClient,
    private readonly notificationClient?: NotificationServiceClient
  ) {}

  async execute(dto: ProcessPaymentDTO): Promise<Payment> {
    // 1. Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    // 2. Verificar que no existe un pago previo para esta orden
    const existing = await this.paymentRepository.findByOrderId(dto.orderId);
    if (existing) {
      throw new Error(`Ya existe un pago registrado para la orden ${dto.orderId}`);
    }

    // 3. Obtener tipo de cambio USD→GTQ
    console.log('💱 Obteniendo tipo de cambio USD→GTQ...');
    const fxResult = await this.fxClient.getExchangeRate('USD', 'GTQ');
    if (!fxResult.success || !fxResult.rate) {
      throw new Error('No se pudo obtener el tipo de cambio. Intente más tarde.');
    }
    const exchangeRate = fxResult.rate;

    // 4. Calcular montos en ambas monedas
    let amountGtq: number;
    let amountUsd: number;

    if (dto.currency === 'GTQ') {
      amountGtq = dto.amount;
      amountUsd = parseFloat((dto.amount / exchangeRate).toFixed(2));
    } else {
      amountUsd = dto.amount;
      amountGtq = parseFloat((dto.amount * exchangeRate).toFixed(2));
    }

    // 5. Simular procesamiento del pago (siempre aprobado si los datos son válidos)
    console.log(`💳 Procesando pago ${dto.paymentMethod} por ${dto.currency} ${dto.amount}...`);

    // 6. Crear y guardar el pago
    const payment = new Payment({
      orderId: dto.orderId,
      amount: dto.amount,
      currency: dto.currency,
      amountGtq,
      amountUsd,
      exchangeRate,
      paymentMethod: dto.paymentMethod as PaymentMethod,
      status: 'COMPLETED'
    });

    const savedPayment = await this.paymentRepository.save(payment);
    console.log(`✅ Pago ${savedPayment.id} registrado`);

    // 7. Actualizar estado del pedido a PAID
    try {
      await this.orderClient.updateOrderStatus(dto.orderId, 'PAID');
      console.log(`✅ Orden ${dto.orderId} marcada como PAID`);
    } catch (error) {
      console.error('⚠️ No se pudo actualizar el estado de la orden:', error);
      // No fallamos el pago por este error — el pago ya fue registrado
    }

    // 8. Enviar notificación de pago confirmado (no crítico)
    if (this.notificationClient && dto.userEmail) {
      try {
        await this.notificationClient.sendPaymentConfirmed({
          userId: dto.userId || '',
          userEmail: dto.userEmail,
          userName: dto.userName || dto.userEmail,
          orderId: savedPayment.orderId,
          orderNumber: savedPayment.orderId.substring(0, 8).toUpperCase(),
          amount: savedPayment.amount,
          currency: savedPayment.currency,
          amountGtq: savedPayment.amountGtq,
          amountUsd: savedPayment.amountUsd,
          exchangeRate: savedPayment.exchangeRate,
          paymentMethod: savedPayment.paymentMethod,
          status: 'COMPLETADO'
        });
      } catch (error) {
        console.error('⚠️ Error al enviar notificación de pago:', error);
      }
    }

    return savedPayment;
  }
}
