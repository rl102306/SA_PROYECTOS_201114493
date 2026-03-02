import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-restaurant-menu',
  templateUrl: './restaurant-menu.component.html',
  styleUrls: ['./restaurant-menu.component.css']
})
export class RestaurantMenuComponent implements OnInit, OnDestroy {

  restaurantId = '';
  restaurantName = '';

  // ── Pestañas ─────────────────────────────────────
  activeTab: 'menu' | 'orders' = 'menu';

  // ── Menú ─────────────────────────────────────────
  products: any[] = [];
  isLoadingProducts = false;

  showModal = false;
  editingProduct: any = null;
  productForm: FormGroup;
  isSaving = false;

  // ── Pedidos ──────────────────────────────────────
  orders: any[] = [];
  isLoadingOrders = false;
  private ordersRefreshInterval: any = null;

  // Rechazo
  showRejectModal = false;
  rejectingOrder: any = null;
  rejectReason = '';

  // ── Mensajes ─────────────────────────────────────
  errorMessage = '';
  successMessage = '';

  constructor(
    private menuService: MenuService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.productForm = this.fb.group({
      name:        ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      price:       [0, [Validators.required, Validators.min(0.01)]],
      category:    [''],
      isAvailable: [true]
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.restaurantId = user.id;
    this.restaurantName = user.email || 'Mi Restaurante';
    this.loadProducts();
    this.loadOrders();
    // Refrescar pedidos cada 30 s
    this.ordersRefreshInterval = setInterval(() => this.loadOrders(), 30000);
  }

  ngOnDestroy(): void {
    if (this.ordersRefreshInterval) clearInterval(this.ordersRefreshInterval);
  }

  // ── Tab helpers ──────────────────────────────────
  setTab(tab: 'menu' | 'orders'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab === 'orders') this.loadOrders();
  }

  // ── Menú ─────────────────────────────────────────
  loadProducts(): void {
    this.isLoadingProducts = true;
    this.menuService.getMyProducts(this.restaurantId).subscribe({
      next: (res: any) => {
        this.products = res.products || [];
        this.isLoadingProducts = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar los productos';
        this.isLoadingProducts = false;
      }
    });
  }

  openCreateModal(): void {
    this.editingProduct = null;
    this.productForm.reset({ isAvailable: true, price: 0 });
    this.clearMessages();
    this.showModal = true;
  }

  openEditModal(product: any): void {
    this.editingProduct = product;
    this.productForm.patchValue(product);
    this.clearMessages();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingProduct = null;
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;
    this.isSaving = true;
    this.clearMessages();
    const data = { ...this.productForm.value, restaurantId: this.restaurantId };
    const obs = this.editingProduct
      ? this.menuService.updateProduct(this.editingProduct.id, data)
      : this.menuService.createProduct(data);

    obs.subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = this.editingProduct ? 'Producto actualizado' : 'Producto creado';
          this.closeModal();
          this.loadProducts();
        } else {
          this.errorMessage = res.message || 'Error al guardar';
        }
        this.isSaving = false;
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || 'Error al guardar';
        this.isSaving = false;
      }
    });
  }

  deleteProduct(product: any): void {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    this.menuService.deleteProduct(product.id, this.restaurantId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = 'Producto eliminado';
          this.products = this.products.filter(p => p.id !== product.id);
        } else {
          this.errorMessage = res.message || 'Error al eliminar';
        }
      },
      error: () => { this.errorMessage = 'Error al eliminar el producto'; }
    });
  }

  toggleAvailability(product: any): void {
    this.menuService.updateProduct(product.id, {
      restaurantId: this.restaurantId,
      isAvailable: !product.isAvailable
    }).subscribe({
      next: (res: any) => {
        if (res.success) product.isAvailable = !product.isAvailable;
      }
    });
  }

  // ── Pedidos ──────────────────────────────────────
  loadOrders(): void {
    this.isLoadingOrders = true;
    this.menuService.getRestaurantOrders().subscribe({
      next: (res: any) => {
        this.orders = res.orders || [];
        this.isLoadingOrders = false;
      },
      error: () => { this.isLoadingOrders = false; }
    });
  }

  acceptOrder(order: any): void {
    this.menuService.updateOrderStatus(order.id, 'CONFIRMED').subscribe({
      next: (res: any) => {
        if (res.success) {
          order.status = 'CONFIRMED';
          this.successMessage = 'Pedido aceptado';
        } else {
          this.errorMessage = res.message || 'Error';
        }
      },
      error: () => { this.errorMessage = 'Error al aceptar el pedido'; }
    });
  }

  startPreparing(order: any): void {
    this.menuService.updateOrderStatus(order.id, 'PREPARING').subscribe({
      next: (res: any) => {
        if (res.success) {
          order.status = 'PREPARING';
          this.successMessage = 'Pedido en preparación';
        } else {
          this.errorMessage = res.message || 'Error';
        }
      },
      error: () => { this.errorMessage = 'Error al actualizar pedido'; }
    });
  }

  finishOrder(order: any): void {
    this.menuService.updateOrderStatus(order.id, 'IN_DELIVERY').subscribe({
      next: (res: any) => {
        if (res.success) {
          order.status = 'IN_DELIVERY';
          this.successMessage = 'Pedido listo — esperando repartidor';
        } else {
          this.errorMessage = res.message || 'Error';
        }
      },
      error: () => { this.errorMessage = 'Error al actualizar el pedido'; }
    });
  }

  openRejectModal(order: any): void {
    this.rejectingOrder = order;
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectingOrder = null;
  }

  confirmReject(): void {
    if (!this.rejectingOrder) return;
    this.menuService.updateOrderStatus(this.rejectingOrder.id, 'CANCELLED', this.rejectReason).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.orders = this.orders.filter(o => o.id !== this.rejectingOrder.id);
          this.successMessage = 'Pedido rechazado';
          this.closeRejectModal();
        } else {
          this.errorMessage = res.message || 'Error';
        }
      },
      error: () => { this.errorMessage = 'Error al rechazar el pedido'; }
    });
  }

  orderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación',
      IN_DELIVERY: 'En camino', DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado', PAID: 'Pagado'
    };
    return map[status] || status;
  }

  orderStatusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'status-pending', CONFIRMED: 'status-confirmed', PREPARING: 'status-preparing',
      IN_DELIVERY: 'status-delivery', DELIVERED: 'status-delivered',
      CANCELLED: 'status-cancelled', PAID: 'status-paid'
    };
    return map[status] || '';
  }

  // ── Misc ─────────────────────────────────────────
  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
