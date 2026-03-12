import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FxService {
  private apiUrl = `${environment.apiUrl}/fx`;

  constructor(private http: HttpClient) {}

  getRate(from: string, to: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/rate?from=${from}&to=${to}`);
  }

  getCurrencies(base: string = 'GTQ'): Observable<any> {
    return this.http.get(`${this.apiUrl}/currencies?base=${base}`);
  }
}
