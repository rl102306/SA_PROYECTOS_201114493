import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../services/catalog.service';
import { Restaurant, Product } from '../../../shared/models/restaurant.model';

@Component({
  selector: 'app-view-catalog',
  templateUrl: './view-catalog.component.html',
  styleUrls: ['./view-catalog.component.css']
})
export class ViewCatalogComponent implements OnInit {
  restaurants: Restaurant[] = [];
  products: Product[] = [];
  selectedRestaurantId: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRestaurants();
  }

  loadRestaurants(): void {
    this.isLoading = true;
    this.catalogService.getRestaurants().subscribe({
      next: (restaurants) => {
        this.restaurants = restaurants;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar restaurantes';
        this.isLoading = false;
      }
    });
  }

  onRestaurantFilter(): void {
    if (!this.selectedRestaurantId) {
      this.products = [];
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.catalogService.getProductsByRestaurant(this.selectedRestaurantId).subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar productos';
        this.isLoading = false;
      }
    });
  }

  getRestaurantName(restaurantId: string): string {
    const restaurant = this.restaurants.find(r => r.id === restaurantId);
    return restaurant ? restaurant.name : '';
  }

  goToCreateOrder(): void {
    this.router.navigate(['/client/create-order']);
  }
}
