import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.getToken()}`
    });
  }

  processPayment(data: {
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    cardHolder?: string;
    cardLastFour?: string;
    walletId?: string;
  }): Observable<any> {
    return this.http.post(this.apiUrl, data, { headers: this.getHeaders() });
  }

  getPaymentByOrder(orderId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/order/${orderId}`, { headers: this.getHeaders() });
  }
}
