import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.getToken()}`
    });
  }

  createPromotion(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/promotions`, data, { headers: this.getHeaders() });
  }

  getPromotions(restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.get<any>(`${this.apiUrl}/promotions`, { params, headers: this.getHeaders() });
  }

  deletePromotion(id: string, restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.delete<any>(`${this.apiUrl}/promotions/${id}`, { params, headers: this.getHeaders() });
  }

  createCoupon(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/coupons`, data, { headers: this.getHeaders() });
  }

  getCoupons(restaurantId: string): Observable<any> {
    const params = new HttpParams().set('restaurantId', restaurantId);
    return this.http.get<any>(`${this.apiUrl}/coupons`, { params, headers: this.getHeaders() });
  }

  getNotifications(restaurantId: string, unreadOnly = false): Observable<any> {
    const params = new HttpParams()
      .set('restaurantId', restaurantId)
      .set('unreadOnly', unreadOnly ? 'true' : 'false');
    return this.http.get<any>(`${this.apiUrl}/notifications`, { params, headers: this.getHeaders() });
  }

  markNotificationsRead(restaurantId: string, notificationId?: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/notifications/read`, { restaurantId, notificationId }, { headers: this.getHeaders() });
  }
}
