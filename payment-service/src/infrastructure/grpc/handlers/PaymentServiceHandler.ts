import { ProcessPaymentUseCase } from '../../../application/usecases/ProcessPaymentUseCase';
import { IPaymentRepository } from '../../../domain/interfaces/IPaymentRepository';
import { ProcessPaymentDTO } from '../../../application/dtos/ProcessPaymentDTO';
import { Payment } from '../../../domain/entities/Payment';

export class PaymentServiceHandler {
  constructor(
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly paymentRepository: IPaymentRepository
  ) {}

  async ProcessPayment(call: any, callback: any): Promise<void> {
    try {
      const dto = new ProcessPaymentDTO(call.request);
      const payment = await this.processPaymentUseCase.execute(dto);

      callback(null, {
        success: true,
        message: `Pago procesado exitosamente. Total GTQ: ${payment.amountGtq.toFixed(2)}, USD: ${payment.amountUsd.toFixed(2)}`,
        payment: this.mapToGrpc(payment)
      });
    } catch (error: any) {
      console.error('❌ Error en ProcessPayment:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al procesar el pago',
        payment: null
      });
    }
  }

  async GetPaymentByOrder(call: any, callback: any): Promise<void> {
    try {
      const payment = await this.paymentRepository.findByOrderId(call.request.order_id);
      if (!payment) {
        callback(null, { success: false, message: 'Pago no encontrado para esta orden', payment: null });
        return;
      }
      callback(null, { success: true, message: 'Pago encontrado', payment: this.mapToGrpc(payment) });
    } catch (error: any) {
      console.error('❌ Error en GetPaymentByOrder:', error);
      callback(null, { success: false, message: error.message, payment: null });
    }
  }

  async RefundPayment(call: any, callback: any): Promise<void> {
    try {
      const { order_id } = call.request;
      const payment = await this.paymentRepository.refundByOrderId(order_id);

      if (!payment) {
        callback(null, {
          success: false,
          message: 'No se encontró un pago COMPLETADO para esta orden',
          payment: null
        });
        return;
      }

      callback(null, {
        success: true,
        message: 'Reembolso aprobado correctamente',
        payment: this.mapToGrpc(payment)
      });
    } catch (error: any) {
      console.error('❌ Error en RefundPayment:', error);
      callback(null, { success: false, message: error.message || 'Error al procesar reembolso', payment: null });
    }
  }

  private mapToGrpc(payment: Payment): any {
    return {
      id: payment.id,
      order_id: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      amount_gtq: payment.amountGtq,
      amount_usd: payment.amountUsd,
      exchange_rate: payment.exchangeRate,
      payment_method: payment.paymentMethod,
      status: payment.status,
      created_at: payment.createdAt.toISOString()
    };
  }
}
