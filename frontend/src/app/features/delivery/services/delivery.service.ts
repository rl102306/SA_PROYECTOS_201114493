import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getMyDeliveries(): Observable<any> {
    return this.http.get(`${this.apiUrl}/deliveries/my`, { headers: this.getHeaders() });
  }

  getPendingDeliveries(): Observable<any> {
    return this.http.get(`${this.apiUrl}/deliveries/pending`, { headers: this.getHeaders() });
  }

  acceptDelivery(deliveryId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/deliveries/${deliveryId}/accept`, {}, { headers: this.getHeaders() });
  }

  updateStatus(deliveryId: string, status: string, cancellationReason?: string, deliveryPhoto?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/deliveries/${deliveryId}/status`, {
      status,
      cancellationReason: cancellationReason || '',
      deliveryPhoto: deliveryPhoto || ''
    }, { headers: this.getHeaders() });
  }
}
