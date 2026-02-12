export interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
}

export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  imageUrl?: string;
}
