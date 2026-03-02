import { PaymentMethod } from '../../domain/entities/Payment';

export class ProcessPaymentDTO {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  cardHolder?: string;
  cardLastFour?: string;
  walletId?: string;
  userEmail?: string;
  userName?: string;
  userId?: string;

  constructor(data: any) {
    this.orderId = data.order_id || data.orderId;
    this.amount = parseFloat(data.amount);
    this.currency = (data.currency || 'GTQ').toUpperCase();
    this.paymentMethod = data.payment_method || data.paymentMethod;
    this.cardHolder = data.card_holder || data.cardHolder;
    this.cardLastFour = data.card_last_four || data.cardLastFour;
    this.walletId = data.wallet_id || data.walletId;
    this.userEmail = data.user_email || data.userEmail;
    this.userName = data.user_name || data.userName;
    this.userId = data.user_id || data.userId;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.orderId) errors.push('El ID de la orden es requerido');
    if (!this.amount || this.amount <= 0) errors.push('El monto debe ser mayor a 0');
    if (!['GTQ', 'USD'].includes(this.currency)) errors.push('Moneda no válida. Use GTQ o USD');

    const validMethods: PaymentMethod[] = ['CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET'];
    if (!validMethods.includes(this.paymentMethod)) {
      errors.push('Método de pago no válido. Use CREDIT_CARD, DEBIT_CARD o DIGITAL_WALLET');
    }

    if (this.paymentMethod === 'CREDIT_CARD' || this.paymentMethod === 'DEBIT_CARD') {
      if (!this.cardHolder) errors.push('El nombre del titular es requerido para pago con tarjeta');
      if (!this.cardLastFour || !/^\d{4}$/.test(this.cardLastFour)) {
        errors.push('Se requieren los últimos 4 dígitos de la tarjeta');
      }
    }

    if (this.paymentMethod === 'DIGITAL_WALLET') {
      if (!this.walletId) errors.push('El ID de cartera digital es requerido');
    }

    return errors;
  }
}
