import { v4 as uuidv4 } from 'uuid';

export interface ProductProps {
  id?: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Product {
  private readonly _id: string;
  private _restaurantId: string;
  private _name: string;
  private _description: string;
  private _price: number;
  private _category: string;
  private _isAvailable: boolean;
  private _imageUrl?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ProductProps) {
    this._id = props.id || uuidv4();
    this._restaurantId = props.restaurantId;
    this._name = props.name;
    this._description = props.description;
    this._price = props.price;
    this._category = props.category;
    this._isAvailable = props.isAvailable;
    this._imageUrl = props.imageUrl;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  // Getters
  get id(): string { return this._id; }
  get restaurantId(): string { return this._restaurantId; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get price(): number { return this._price; }
  get category(): string { return this._category; }
  get isAvailable(): boolean { return this._isAvailable; }
  get imageUrl(): string | undefined { return this._imageUrl; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Métodos de dominio
  updatePrice(newPrice: number): void {
    if (newPrice < 0) {
      throw new Error('El precio no puede ser negativo');
    }
    this._price = newPrice;
    this._updatedAt = new Date();
  }

  setAvailability(isAvailable: boolean): void {
    this._isAvailable = isAvailable;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      restaurantId: this._restaurantId,
      name: this._name,
      description: this._description,
      price: this._price,
      category: this._category,
      isAvailable: this._isAvailable,
      imageUrl: this._imageUrl,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}
