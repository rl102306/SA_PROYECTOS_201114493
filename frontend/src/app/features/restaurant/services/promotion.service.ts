import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient) {}

  createPromotion(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/promotions`, data);
  }

  getPromotions(restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.get<any>(`${this.apiUrl}/promotions`, { params });
  }

  deletePromotion(id: string, restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.delete<any>(`${this.apiUrl}/promotions/${id}`, { params });
  }

  createCoupon(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/coupons`, data);
  }

  getCoupons(restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.get<any>(`${this.apiUrl}/coupons`, { params });
  }

  getNotifications(restaurantId: string, unreadOnly = false): Observable<any> {
    const params = new HttpParams()
      .set('restaurantId', restaurantId)
      .set('unreadOnly', unreadOnly ? 'true' : 'false');
    return this.http.get<any>(`${this.apiUrl}/notifications`, { params });
  }

  markNotificationsRead(restaurantId: string, notificationId?: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/notifications/read`, { restaurantId, notificationId });
  }
}
