import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RatingPayload {
  orderId: string;
  restaurantId?: string;
  deliveryPersonId?: string;
  productId?: string;
  type: 'RESTAURANT' | 'DELIVERY' | 'PRODUCT';
  stars?: number;
  comment?: string;
  recommended?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RatingService {
  private apiUrl = `${environment.apiUrl}/ratings`;

  constructor(private http: HttpClient) {}

  createRating(payload: RatingPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  getRestaurantRating(restaurantId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/restaurant/${restaurantId}`);
  }

  getProductRating(productId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/product/${productId}`);
  }
}
