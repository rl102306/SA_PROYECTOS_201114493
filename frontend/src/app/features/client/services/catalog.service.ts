import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Restaurant, Product } from '../../shared/models/restaurant.model';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  
  // Datos hardcodeados para la demo (deberían venir del backend)
  private restaurants: Restaurant[] = [
    {
      id: '99999999-9999-9999-9999-999999999999',
      name: 'La Pizzería Italiana',
      description: 'Auténtica comida italiana',
      address: 'Calle Principal 123',
      phone: '5555-1234'
    },
    {
      id: '88888888-8888-8888-8888-888888888888',
      name: 'Burger House',
      description: 'Las mejores hamburguesas',
      address: 'Avenida Central 456',
      phone: '5555-5678'
    },
    {
      id: '77777777-7777-7777-7777-777777777777',
      name: 'Sushi Tokyo',
      description: 'Sushi fresco y delicioso',
      address: 'Plaza Comercial 789',
      phone: '5555-9012'
    }
  ];

  private products: Product[] = [
    // Productos de La Pizzería Italiana
    {
      id: '11111111-1111-1111-1111-111111111111',
      restaurantId: '99999999-9999-9999-9999-999999999999',
      name: 'Pizza Margarita',
      description: 'Pizza clásica con tomate y mozzarella',
      price: 12.99,
      category: 'Pizzas',
      isAvailable: true
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      restaurantId: '99999999-9999-9999-9999-999999999999',
      name: 'Pasta Carbonara',
      description: 'Pasta con salsa carbonara',
      price: 11.50,
      category: 'Pastas',
      isAvailable: true
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      restaurantId: '99999999-9999-9999-9999-999999999999',
      name: 'Ensalada César',
      description: 'Ensalada fresca con pollo',
      price: 7.50,
      category: 'Ensaladas',
      isAvailable: false // NO DISPONIBLE
    },
    
    // Productos de Burger House
    {
      id: '44444444-4444-4444-4444-444444444444',
      restaurantId: '88888888-8888-8888-8888-888888888888',
      name: 'Hamburguesa Clásica',
      description: 'Hamburguesa con queso y vegetales',
      price: 8.50,
      category: 'Hamburguesas',
      isAvailable: true
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      restaurantId: '88888888-8888-8888-8888-888888888888',
      name: 'Papas Fritas',
      description: 'Papas fritas crujientes',
      price: 3.50,
      category: 'Acompañamientos',
      isAvailable: true
    },
    
    // Productos de Sushi Tokyo
    {
      id: '66666666-6666-6666-6666-666666666666',
      restaurantId: '77777777-7777-7777-7777-777777777777',
      name: 'Sushi Roll California',
      description: 'Roll de aguacate y cangrejo',
      price: 15.99,
      category: 'Sushi',
      isAvailable: true
    }
  ];

  constructor() {}

  getRestaurants(): Observable<Restaurant[]> {
    return of(this.restaurants);
  }

  getRestaurantById(id: string): Observable<Restaurant | undefined> {
    return of(this.restaurants.find(r => r.id === id));
  }

  getProductsByRestaurant(restaurantId: string): Observable<Product[]> {
    return of(this.products.filter(p => p.restaurantId === restaurantId));
  }

  getAllProducts(): Observable<Product[]> {
    return of(this.products);
  }
}
