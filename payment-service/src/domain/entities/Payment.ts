import { v4 as uuidv4 } from 'uuid';

export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET';
export type PaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentProps {
  id?: string;
  orderId: string;
  amount: number;
  currency: string;
  amountGtq: number;
  amountUsd: number;
  exchangeRate: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt?: Date;
}

export class Payment {
  private readonly _id: string;
  private readonly _orderId: string;
  private readonly _amount: number;
  private readonly _currency: string;
  private readonly _amountGtq: number;
  private readonly _amountUsd: number;
  private readonly _exchangeRate: number;
  private readonly _paymentMethod: PaymentMethod;
  private readonly _status: PaymentStatus;
  private readonly _createdAt: Date;

  constructor(props: PaymentProps) {
    this._id = props.id || uuidv4();
    this._orderId = props.orderId;
    this._amount = props.amount;
    this._currency = props.currency;
    this._amountGtq = props.amountGtq;
    this._amountUsd = props.amountUsd;
    this._exchangeRate = props.exchangeRate;
    this._paymentMethod = props.paymentMethod;
    this._status = props.status;
    this._createdAt = props.createdAt || new Date();
  }

  get id(): string { return this._id; }
  get orderId(): string { return this._orderId; }
  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get amountGtq(): number { return this._amountGtq; }
  get amountUsd(): number { return this._amountUsd; }
  get exchangeRate(): number { return this._exchangeRate; }
  get paymentMethod(): PaymentMethod { return this._paymentMethod; }
  get status(): PaymentStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }

  toJSON() {
    return {
      id: this._id,
      orderId: this._orderId,
      amount: this._amount,
      currency: this._currency,
      amountGtq: this._amountGtq,
      amountUsd: this._amountUsd,
      exchangeRate: this._exchangeRate,
      paymentMethod: this._paymentMethod,
      status: this._status,
      createdAt: this._createdAt
    };
  }
}
