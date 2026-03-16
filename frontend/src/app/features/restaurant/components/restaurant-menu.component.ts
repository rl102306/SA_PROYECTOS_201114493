import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { PromotionService } from '../services/promotion.service';
import { AuthService } from '../../../core/services/auth.service';
import { RatingService } from '../../client/services/rating.service';

@Component({
  selector: 'app-restaurant-menu',
  templateUrl: './restaurant-menu.component.html',
  styleUrls: ['./restaurant-menu.component.css']
})
export class RestaurantMenuComponent implements OnInit, OnDestroy {

  restaurantId = '';
  restaurantName = '';

  // ── Calificación del restaurante ─────────────────
  restaurantRating: { averageStars: number; totalRatings: number } | null = null;

  // ── Pestañas ─────────────────────────────────────
  activeTab: 'menu' | 'orders' | 'promotions' | 'coupons' | 'notifications' = 'menu';

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

  // ── Promociones ───────────────────────────────────
  promotions: any[] = [];
  isLoadingPromotions = false;
  showPromoModal = false;
  promoForm: FormGroup;
  isSavingPromo = false;

  // ── Cupones ───────────────────────────────────────
  coupons: any[] = [];
  isLoadingCoupons = false;
  showCouponModal = false;
  couponForm: FormGroup;
  isSavingCoupon = false;

  // ── Notificaciones (inbox RabbitMQ) ──────────────
  notifications: any[] = [];
  unreadCount = 0;
  isLoadingNotifications = false;

  // ── Mensajes ─────────────────────────────────────
  errorMessage = '';
  successMessage = '';

  constructor(
    private menuService: MenuService,
    private promotionService: PromotionService,
    private authService: AuthService,
    private ratingService: RatingService,
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

    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.promoForm = this.fb.group({
      title:         ['', Validators.required],
      description:   [''],
      type:          ['PERCENTAGE', Validators.required],
      discountValue: [10, [Validators.required, Validators.min(0.01)]],
      startsAt:      [now.toISOString().slice(0,16), Validators.required],
      endsAt:        [nextMonth.toISOString().slice(0,16), Validators.required]
    });

    this.couponForm = this.fb.group({
      code:           ['', [Validators.required, Validators.minLength(3)]],
      description:    [''],
      type:           ['PERCENTAGE', Validators.required],
      discountValue:  [10, [Validators.required, Validators.min(0.01)]],
      minOrderAmount: [0, Validators.min(0)],
      maxUses:        [0, Validators.min(0)],
      expiresAt:      [nextMonth.toISOString().slice(0,16), Validators.required]
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.restaurantId = user.id;
    this.restaurantName = user.email || 'Mi Restaurante';
    this.loadProducts();
    this.loadOrders();
    this.loadNotifications();
    this.loadRestaurantRating();
    // Refrescar pedidos y notificaciones cada 30 s
    this.ordersRefreshInterval = setInterval(() => {
      this.loadOrders();
      this.loadNotifications();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.ordersRefreshInterval) clearInterval(this.ordersRefreshInterval);
  }

  loadRestaurantRating(): void {
    this.ratingService.getRestaurantRating(this.restaurantId).subscribe({
      next: (res) => {
        if (res.success) {
          this.restaurantRating = { averageStars: res.averageStars, totalRatings: res.totalRatings };
        }
      },
      error: () => {}
    });
  }

  // ── Tab helpers ──────────────────────────────────
  setTab(tab: 'menu' | 'orders' | 'promotions' | 'coupons' | 'notifications'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab === 'orders') this.loadOrders();
    if (tab === 'promotions') this.loadPromotions();
    if (tab === 'coupons') this.loadCoupons();
    if (tab === 'notifications') this.loadNotifications();
  }

  // ── Notificaciones ───────────────────────────────
  loadNotifications(): void {
    if (!this.restaurantId) return;
    this.isLoadingNotifications = true;
    this.promotionService.getNotifications(this.restaurantId).subscribe({
      next: (res) => {
        this.notifications = res.notifications || [];
        this.unreadCount = res.unreadCount || 0;
        this.isLoadingNotifications = false;
      },
      error: () => { this.isLoadingNotifications = false; }
    });
  }

  markAllRead(): void {
    this.promotionService.markNotificationsRead(this.restaurantId).subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadCount = 0;
      },
      error: () => {}
    });
  }

  // ── Promociones ───────────────────────────────────
  loadPromotions(): void {
    this.isLoadingPromotions = true;
    this.promotionService.getPromotions(this.restaurantId).subscribe({
      next: (res) => {
        this.promotions = res.promotions || [];
        this.isLoadingPromotions = false;
      },
      error: () => { this.isLoadingPromotions = false; }
    });
  }

  openPromoModal(): void {
    this.showPromoModal = true;
    this.promoForm.reset({
      title: '', description: '', type: 'PERCENTAGE', discountValue: 10,
      startsAt: new Date().toISOString().slice(0,16),
      endsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,16)
    });
  }

  closePromoModal(): void { this.showPromoModal = false; }

  savePromotion(): void {
    if (this.promoForm.invalid) return;
    this.isSavingPromo = true;
    const val = this.promoForm.value;
    this.promotionService.createPromotion({
      restaurantId: this.restaurantId,
      title: val.title,
      description: val.description,
      type: val.type,
      discountValue: parseFloat(val.discountValue),
      startsAt: new Date(val.startsAt).toISOString(),
      endsAt: new Date(val.endsAt).toISOString()
    }).subscribe({
      next: (res) => {
        this.isSavingPromo = false;
        if (res.success) {
          this.showPromoModal = false;
          this.successMessage = 'Promoción creada exitosamente';
          this.loadPromotions();
        } else {
          this.errorMessage = res.message;
        }
      },
      error: (err: any) => {
        this.isSavingPromo = false;
        this.errorMessage = err.error?.message || 'Error al guardar promoción';
      }
    });
  }

  deletePromotion(id: string): void {
    if (!confirm('¿Eliminar esta promoción?')) return;
    this.promotionService.deletePromotion(id, this.restaurantId).subscribe({
      next: () => {
        this.promotions = this.promotions.filter(p => p.id !== id);
        this.successMessage = 'Promoción eliminada';
      },
      error: () => {}
    });
  }

  // ── Cupones ───────────────────────────────────────
  loadCoupons(): void {
    this.isLoadingCoupons = true;
    this.promotionService.getCoupons(this.restaurantId).subscribe({
      next: (res) => {
        this.coupons = res.coupons || [];
        this.isLoadingCoupons = false;
      },
      error: () => { this.isLoadingCoupons = false; }
    });
  }

  openCouponModal(): void {
    this.showCouponModal = true;
    this.couponForm.reset({
      code: '', description: '', type: 'PERCENTAGE', discountValue: 10,
      minOrderAmount: 0, maxUses: 0,
      expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,16)
    });
  }

  closeCouponModal(): void { this.showCouponModal = false; }

  saveCoupon(): void {
    if (this.couponForm.invalid) return;
    this.isSavingCoupon = true;
    const val = this.couponForm.value;
    this.promotionService.createCoupon({
      restaurantId: this.restaurantId,
      code: val.code,
      description: val.description,
      type: val.type,
      discountValue: parseFloat(val.discountValue),
      minOrderAmount: parseFloat(val.minOrderAmount || 0),
      maxUses: parseInt(val.maxUses || 0),
      expiresAt: new Date(val.expiresAt).toISOString()
    }).subscribe({
      next: (res) => {
        this.isSavingCoupon = false;
        if (res.success) {
          this.showCouponModal = false;
          this.successMessage = res.message;
          this.loadCoupons();
        } else {
          this.errorMessage = res.message;
        }
      },
      error: (err: any) => {
        this.isSavingCoupon = false;
        this.errorMessage = err.error?.message || 'Error al guardar cupón';
      }
    });
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
