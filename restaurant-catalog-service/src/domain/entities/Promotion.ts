import { v4 as uuidv4 } from 'uuid';

export type PromotionType = 'PERCENTAGE' | 'FIXED' | 'FREE_DELIVERY';

export interface PromotionProps {
  id?: string;
  restaurantId: string;
  title: string;
  description?: string;
  type: PromotionType;
  discountValue: number;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Promotion {
  private readonly _id: string;
  private _restaurantId: string;
  private _title: string;
  private _description?: string;
  private _type: PromotionType;
  private _discountValue: number;
  private _isActive: boolean;
  private _startsAt: Date;
  private _endsAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: PromotionProps) {
    this._id = props.id || uuidv4();
    this._restaurantId = props.restaurantId;
    this._title = props.title;
    this._description = props.description;
    this._type = props.type;
    this._discountValue = props.discountValue;
    this._isActive = props.isActive;
    this._startsAt = props.startsAt;
    this._endsAt = props.endsAt;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get restaurantId(): string { return this._restaurantId; }
  get title(): string { return this._title; }
  get description(): string | undefined { return this._description; }
  get type(): PromotionType { return this._type; }
  get discountValue(): number { return this._discountValue; }
  get isActive(): boolean { return this._isActive; }
  get startsAt(): Date { return this._startsAt; }
  get endsAt(): Date { return this._endsAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  isCurrentlyActive(): boolean {
    const now = new Date();
    return this._isActive && now >= this._startsAt && now <= this._endsAt;
  }

  calculateDiscount(orderAmount: number): number {
    if (!this.isCurrentlyActive()) return 0;
    if (this._type === 'PERCENTAGE') {
      return parseFloat((orderAmount * this._discountValue / 100).toFixed(2));
    }
    if (this._type === 'FIXED') {
      return Math.min(this._discountValue, orderAmount);
    }
    return 0; // FREE_DELIVERY handled separately
  }

  toJSON() {
    return {
      id: this._id,
      restaurantId: this._restaurantId,
      title: this._title,
      description: this._description,
      type: this._type,
      discountValue: this._discountValue,
      isActive: this._isActive,
      startsAt: this._startsAt,
      endsAt: this._endsAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
