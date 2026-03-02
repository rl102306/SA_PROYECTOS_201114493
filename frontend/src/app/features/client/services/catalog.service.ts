import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Restaurant, Product } from '../../../shared/models/restaurant.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private apiUrl = `${environment.apiUrl}/catalog`;

  constructor(private http: HttpClient) {}

  getRestaurants(): Observable<Restaurant[]> {
    return this.http.get<any>(`${this.apiUrl}/restaurants`).pipe(
      map(res => res.restaurants || [])
    );
  }

  getProductsByRestaurant(restaurantId: string): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/restaurants/${restaurantId}/products`).pipe(
      map(res => res.products || [])
    );
  }

  getAllProducts(): Observable<Product[]> {
    return new Observable(observer => {
      observer.next([]);
      observer.complete();
    });
  }
}
