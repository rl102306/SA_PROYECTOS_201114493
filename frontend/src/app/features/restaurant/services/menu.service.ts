import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private apiUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.getToken()}`
    });
  }

  getMyProducts(restaurantId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/restaurants/${restaurantId}/products`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/menu`, data, { headers: this.getHeaders() });
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/menu/${id}`, data, { headers: this.getHeaders() });
  }

  deleteProduct(id: string, restaurantId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/menu/${id}?restaurantId=${restaurantId}`,
      { headers: this.getHeaders() }
    );
  }

  getRestaurantOrders(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/admin/restaurant-orders`, { headers: this.getHeaders() });
  }

  updateOrderStatus(orderId: string, status: string, reason?: string): Observable<any> {
    return this.http.patch(
      `${environment.apiUrl}/admin/orders/${orderId}/status`,
      { status, reason },
      { headers: this.getHeaders() }
    );
  }
}
