import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Restaurant, Product, Promotion, Coupon } from '../../../shared/models/restaurant.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private apiUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient) {}

  getRestaurants(filters?: { sortBy?: string; tags?: string[]; hasPromotion?: boolean }): Observable<Restaurant[]> {
    let params = new HttpParams();
    if (filters?.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters?.tags && filters.tags.length > 0) {
      filters.tags.forEach(t => { params = params.append('tags', t); });
    }
    if (filters?.hasPromotion) params = params.set('hasPromotion', 'true');
    return this.http.get<any>(`${this.apiUrl}/restaurants`, { params }).pipe(
      map(res => res.restaurants || [])
    );
  }

  getProductsByRestaurant(restaurantId: string): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/restaurants/${restaurantId}/products`).pipe(
      map(res => res.products || [])
    );
  }

  getRestaurantPromotions(restaurantId: string): Observable<Promotion[]> {
    return this.http.get<any>(`${this.apiUrl}/restaurants/${restaurantId}/promotions`).pipe(
      map(res => res.promotions || [])
    );
  }

  validateCoupon(code: string, orderAmount: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/coupons/validate`, { code, orderAmount });
  }

  getAllProducts(): Observable<Product[]> {
    return new Observable(observer => {
      observer.next([]);
      observer.complete();
    });
  }
}
