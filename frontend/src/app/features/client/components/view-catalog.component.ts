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
  allProducts: Product[] = [];
  selectedRestaurantId: string = '';
  filteredProducts: Product[] = [];

  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRestaurants();
    this.loadAllProducts();
  }

  loadRestaurants(): void {
    this.catalogService.getRestaurants().subscribe(restaurants => {
      this.restaurants = restaurants;
    });
  }

  loadAllProducts(): void {
    this.catalogService.getAllProducts().subscribe(products => {
      this.allProducts = products;
      this.filteredProducts = products;
    });
  }

  onRestaurantFilter(): void {
    if (this.selectedRestaurantId) {
      this.filteredProducts = this.allProducts.filter(
        p => p.restaurantId === this.selectedRestaurantId
      );
    } else {
      this.filteredProducts = this.allProducts;
    }
  }

  getRestaurantName(restaurantId: string): string {
    const restaurant = this.restaurants.find(r => r.id === restaurantId);
    return restaurant ? restaurant.name : 'Desconocido';
  }

  goToCreateOrder(): void {
    this.router.navigate(['/client/create-order']);
  }
}
