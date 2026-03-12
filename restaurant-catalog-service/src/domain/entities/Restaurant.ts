export interface RestaurantProps {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  schedule: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Restaurant {
  private props: RestaurantProps;

  constructor(props: RestaurantProps) {
    this.props = props;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get address(): string { return this.props.address; }
  get phone(): string { return this.props.phone; }
  get email(): string { return this.props.email; }
  get schedule(): string { return this.props.schedule; }
  get description(): string | undefined { return this.props.description; }
  get imageUrl(): string | undefined { return this.props.imageUrl; }
  get isActive(): boolean { return this.props.isActive; }
  get tags(): string[] { return this.props.tags || []; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(data: Partial<RestaurantProps>): void {
    this.props = { ...this.props, ...data, updatedAt: new Date() };
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  toJSON() {
    return { ...this.props };
  }
}
