import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../services/order.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-create-order',
  templateUrl: './create-order.component.html',
  styleUrls: ['./create-order.component.css']
})
export class CreateOrderComponent implements OnInit {

  orderForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  currentUser: any;

  availableRestaurants = [
    { id: '99999999-9999-9999-9999-999999999999', name: 'Restaurante Central', type: 'Comida Variada' },
    { id: '88888888-8888-8888-8888-888888888888', name: 'Pizzeria Italia', type: 'Pizzas' },
    { id: '77777777-7777-7777-7777-777777777777', name: 'Burger House', type: 'Hamburguesas' }
  ];

  catalogProducts = [
    { id: '11111111-1111-1111-1111-111111111111', restaurantId: '99999999-9999-9999-9999-999999999999', name: 'Pizza Margarita', price: 12.99, available: true },
    { id: '22222222-2222-2222-2222-222222222222', restaurantId: '99999999-9999-9999-9999-999999999999', name: 'Hamburguesa Clásica', price: 8.50, available: true },
    { id: '33333333-3333-3333-3333-333333333333', restaurantId: '99999999-9999-9999-9999-999999999999', name: 'Refresco', price: 2.00, available: true },
    { id: '44444444-4444-4444-4444-444444444444', restaurantId: '99999999-9999-9999-9999-999999999999', name: 'Ensalada César', price: 7.50, available: false },
    { id: '55555555-5555-5555-5555-555555555555', restaurantId: '99999999-9999-9999-9999-999999999999', name: 'Pasta Carbonara', price: 11.50, available: true }
  ];

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router
  ) {
    this.orderForm = this.fb.group({
      restaurantId: ['', Validators.required],
      deliveryAddress: ['', Validators.required],
      items: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
  }

  // ✅ Getter limpio (NO genéricos raros)
  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  get selectedRestaurantId(): string {
    return this.orderForm.get('restaurantId')?.value;
  }

  get restaurantProducts() {
    return this.catalogProducts.filter(
      p => p.restaurantId === this.selectedRestaurantId
    );
  }

  addItemFromCatalog(): void {
    const itemGroup = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]],
      mode: ['catalog']
    });

    this.items.push(itemGroup);
  }

  addItemManual(): void {
    const itemGroup = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]],
      mode: ['manual']
    });

    this.items.push(itemGroup);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  onProductChange(index: number): void {
    const item = this.items.at(index);
    const productId = item.get('productId')?.value;

    const product = this.catalogProducts.find(
      p => p.id === productId
    );

    if (product) {
      item.patchValue({ price: product.price });
    }
  }

  getTotalAmount(): number {
    return this.items.controls.reduce((total, item) => {
      const quantity = item.get('quantity')?.value || 0;
      const price = item.get('price')?.value || 0;
      return total + (quantity * price);
    }, 0);
  }

  goToCatalog(): void {
    this.router.navigate(['/client/catalog']);
  }

  onSubmit(): void {

    if (this.orderForm.invalid || this.items.length === 0) {
      this.errorMessage =
        'Por favor completa todos los campos y agrega al menos un producto';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const orderData = {
      ...this.orderForm.value,
      userId: this.currentUser?.id
    };

    this.orderService.createOrder(orderData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage =
            `✅ ¡Orden creada exitosamente! ID: ${response.order?.id}`;

          this.orderForm.reset();
          this.items.clear();
        } else {
          this.errorMessage =
            response.message || 'Error al crear orden';
        }

        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage =
          error.error?.message || 'Error al crear orden';
        this.isLoading = false;
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}