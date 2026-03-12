import { v4 as uuidv4 } from 'uuid';

export type RatingType = 'RESTAURANT' | 'DELIVERY' | 'PRODUCT';

export interface RatingProps {
  id?: string;
  orderId: string;
  userId: string;
  restaurantId?: string;
  deliveryPersonId?: string;
  productId?: string;
  type: RatingType;
  stars?: number;
  comment?: string;
  recommended?: boolean;
  createdAt?: Date;
}

export class Rating {
  private readonly _id: string;
  private _orderId: string;
  private _userId: string;
  private _restaurantId?: string;
  private _deliveryPersonId?: string;
  private _productId?: string;
  private _type: RatingType;
  private _stars?: number;
  private _comment?: string;
  private _recommended?: boolean;
  private readonly _createdAt: Date;

  constructor(props: RatingProps) {
    if (props.stars !== undefined && (props.stars < 1 || props.stars > 5)) {
      throw new Error('La calificación debe ser entre 1 y 5 estrellas');
    }
    this._id = props.id || uuidv4();
    this._orderId = props.orderId;
    this._userId = props.userId;
    this._restaurantId = props.restaurantId;
    this._deliveryPersonId = props.deliveryPersonId;
    this._productId = props.productId;
    this._type = props.type;
    this._stars = props.stars;
    this._comment = props.comment;
    this._recommended = props.recommended;
    this._createdAt = props.createdAt || new Date();
  }

  get id(): string { return this._id; }
  get orderId(): string { return this._orderId; }
  get userId(): string { return this._userId; }
  get restaurantId(): string | undefined { return this._restaurantId; }
  get deliveryPersonId(): string | undefined { return this._deliveryPersonId; }
  get productId(): string | undefined { return this._productId; }
  get type(): RatingType { return this._type; }
  get stars(): number | undefined { return this._stars; }
  get comment(): string | undefined { return this._comment; }
  get recommended(): boolean | undefined { return this._recommended; }
  get createdAt(): Date { return this._createdAt; }

  toJSON() {
    return {
      id: this._id,
      orderId: this._orderId,
      userId: this._userId,
      restaurantId: this._restaurantId,
      deliveryPersonId: this._deliveryPersonId,
      productId: this._productId,
      type: this._type,
      stars: this._stars,
      comment: this._comment,
      recommended: this._recommended,
      createdAt: this._createdAt
    };
  }
}
