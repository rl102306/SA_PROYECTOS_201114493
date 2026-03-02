import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  approveRefund(orderId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/orders/${orderId}/refund`, {}, { headers: this.getHeaders() });
  }

  getOrders(filters: { status?: string; from?: string; to?: string; userId?: string } = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.userId) params = params.set('userId', filters.userId);

    return this.http.get(`${this.apiUrl}/admin/orders`, {
      headers: this.getHeaders(),
      params
    });
  }
}
