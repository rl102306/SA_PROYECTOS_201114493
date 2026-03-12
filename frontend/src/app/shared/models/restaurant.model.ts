export interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email?: string;
  tags?: string[];
  avgRating?: number;
  totalRatings?: number;
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

export interface Promotion {
  id: string;
  restaurant_id?: string;
  title: string;
  description: string;
  type: string;
  discount_value?: number;
  discountValue?: number;
  is_active?: boolean;
  isActive?: boolean;
  starts_at?: string;
  ends_at?: string;
}

export interface Coupon {
  id: string;
  restaurant_id?: string;
  code: string;
  description: string;
  type: string;
  discount_value?: number;
  discountValue?: number;
  min_order_amount?: number;
  minOrderAmount?: number;
  max_uses?: number;
  uses_count?: number;
  is_approved?: boolean;
  isApproved?: boolean;
  is_active?: boolean;
  expires_at?: string;
}
