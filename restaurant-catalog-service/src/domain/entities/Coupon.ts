import { v4 as uuidv4 } from 'uuid';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface CouponProps {
  id?: string;
  restaurantId: string;
  code: string;
  description?: string;
  type: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxUses?: number;
  usesCount: number;
  isApproved: boolean;
  isActive: boolean;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ValidationResult {
  valid: boolean;
  discountAmount: number;
  message: string;
}

export class Coupon {
  private readonly _id: string;
  private _restaurantId: string;
  private _code: string;
  private _description?: string;
  private _type: DiscountType;
  private _discountValue: number;
  private _minOrderAmount: number;
  private _maxUses?: number;
  private _usesCount: number;
  private _isApproved: boolean;
  private _isActive: boolean;
  private _expiresAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CouponProps) {
    this._id = props.id || uuidv4();
    this._restaurantId = props.restaurantId;
    this._code = props.code.toUpperCase();
    this._description = props.description;
    this._type = props.type;
    this._discountValue = props.discountValue;
    this._minOrderAmount = props.minOrderAmount;
    this._maxUses = props.maxUses;
    this._usesCount = props.usesCount;
    this._isApproved = props.isApproved;
    this._isActive = props.isActive;
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get restaurantId(): string { return this._restaurantId; }
  get code(): string { return this._code; }
  get description(): string | undefined { return this._description; }
  get type(): DiscountType { return this._type; }
  get discountValue(): number { return this._discountValue; }
  get minOrderAmount(): number { return this._minOrderAmount; }
  get maxUses(): number | undefined { return this._maxUses; }
  get usesCount(): number { return this._usesCount; }
  get isApproved(): boolean { return this._isApproved; }
  get isActive(): boolean { return this._isActive; }
  get expiresAt(): Date { return this._expiresAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  validate(orderAmount: number): ValidationResult {
    if (!this._isApproved) {
      return { valid: false, discountAmount: 0, message: 'El cupón no ha sido aprobado por el administrador' };
    }
    if (!this._isActive) {
      return { valid: false, discountAmount: 0, message: 'El cupón está inactivo' };
    }
    if (new Date() > this._expiresAt) {
      return { valid: false, discountAmount: 0, message: 'El cupón ha expirado' };
    }
    if (this._maxUses !== undefined && this._usesCount >= this._maxUses) {
      return { valid: false, discountAmount: 0, message: 'El cupón ha alcanzado su límite de usos' };
    }
    if (orderAmount < this._minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        message: `El monto mínimo para usar este cupón es Q${this._minOrderAmount.toFixed(2)}`
      };
    }

    const discountAmount = this.calculateDiscount(orderAmount);
    return { valid: true, discountAmount, message: 'Cupón válido' };
  }

  calculateDiscount(orderAmount: number): number {
    if (this._type === 'PERCENTAGE') {
      return parseFloat((orderAmount * this._discountValue / 100).toFixed(2));
    }
    return Math.min(this._discountValue, orderAmount);
  }

  approve(): void {
    this._isApproved = true;
    this._updatedAt = new Date();
  }

  incrementUsage(): void {
    this._usesCount += 1;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      restaurantId: this._restaurantId,
      code: this._code,
      description: this._description,
      type: this._type,
      discountValue: this._discountValue,
      minOrderAmount: this._minOrderAmount,
      maxUses: this._maxUses,
      usesCount: this._usesCount,
      isApproved: this._isApproved,
      isActive: this._isActive,
      expiresAt: this._expiresAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
