import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../services/catalog.service';
import { OrderService } from '../services/order.service';
import { PaymentService } from '../services/payment.service';
import { FxService } from '../services/fx.service';
import { RatingService } from '../services/rating.service';
import { AuthService } from '../../../core/services/auth.service';
import { Restaurant, Product, Promotion } from '../../../shared/models/restaurant.model';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-view-catalog',
  templateUrl: './view-catalog.component.html',
  styleUrls: ['./view-catalog.component.css']
})
export class ViewCatalogComponent implements OnInit {

  step: 'restaurants' | 'products' = 'restaurants';

  restaurants: Restaurant[] = [];
  products: Product[] = [];
  selectedRestaurant: Restaurant | null = null;

  cart: CartItem[] = [];
  deliveryAddress = '';

  isLoadingRestaurants = false;
  isLoadingProducts = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  // ── Panel de mis pedidos ────────────────────────
  showOrdersPanel = false;
  myOrders: any[] = [];
  isLoadingOrders = false;
  cancellingOrderId = '';

  // ── Modal de pago ──────────────────────────────
  showPaymentModal = false;
  pendingOrderId = '';
  pendingOrderTotal = 0;
  pendingOrderItems: CartItem[] = [];

  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET' = 'CREDIT_CARD';
  cardHolder = '';
  cardLastFour = '';
  walletId = '';

  fxRate: number | null = null;
  fxLoading = false;

  // ── Selector de divisa en el carrito ─────────────
  selectedCurrency = 'GTQ';
  availableCurrencies: string[] = ['GTQ'];
  cartFxRate: number | null = null;
  cartFxLoading = false;

  isPaymentProcessing = false;
  paymentSuccess = false;
  paymentError = '';

  // ── Filtros de restaurantes ─────────────────────
  filterSortBy = '';
  filterTags: string[] = [];
  filterTagInput = '';
  filterHasPromotion = false;

  // ── Promociones del restaurante seleccionado ────
  restaurantPromotions: Promotion[] = [];

  // ── Cupón en checkout ────────────────────────────
  couponCode = '';
  couponValidating = false;
  couponResult: { valid: boolean; discountAmount: number; message: string } | null = null;

  // ── Modal de calificación ────────────────────────
  showRatingModal = false;
  ratingOrderId = '';
  ratingRestaurantId = '';
  ratingDeliveryPersonId = '';
  ratingRestaurantStars = 0;
  ratingRestaurantComment = '';
  ratingDeliveryStars = 0;
  ratingDeliveryComment = '';
  ratingSubmitting = false;
  ratingSuccess = false;
  // ────────────────────────────────────────────────

  private placeholderColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];

  constructor(
    private catalogService: CatalogService,
    private orderService: OrderService,
    private paymentService: PaymentService,
    private fxService: FxService,
    private ratingService: RatingService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRestaurants();
    this.loadAvailableCurrencies();
  }

  loadAvailableCurrencies(): void {
    this.fxService.getCurrencies('GTQ').subscribe({
      next: (res) => {
        if (res.success && res.currencies?.length > 0) {
          // GTQ primero, luego el resto ordenado
          const others = res.currencies.filter((c: string) => c !== 'GTQ');
          this.availableCurrencies = ['GTQ', ...others];
        }
      },
      error: () => {} // si falla, queda ['GTQ'] y el selector sigue funcionando
    });
  }

  loadRestaurants(): void {
    this.isLoadingRestaurants = true;
    this.errorMessage = '';
    const filters = {
      sortBy: this.filterSortBy || undefined,
      tags: this.filterTags.length > 0 ? this.filterTags : undefined,
      hasPromotion: this.filterHasPromotion || undefined
    };
    this.catalogService.getRestaurants(filters).subscribe({
      next: (restaurants) => {
        this.restaurants = restaurants;
        this.isLoadingRestaurants = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar los restaurantes. Intenta de nuevo.';
        this.isLoadingRestaurants = false;
      }
    });
  }

  applyFilters(): void {
    this.loadRestaurants();
  }

  get suggestedTags(): string[] {
    const all = this.restaurants.flatMap(r => r.tags || []);
    return [...new Set(all)].sort();
  }

  toggleSuggestedTag(tag: string): void {
    if (this.filterTags.includes(tag)) {
      this.filterTags = this.filterTags.filter(t => t !== tag);
    } else {
      this.filterTags.push(tag);
    }
    this.loadRestaurants();
  }

  addFilterTag(): void {
    const tag = this.filterTagInput.trim();
    if (tag && !this.filterTags.includes(tag)) {
      this.filterTags.push(tag);
      this.filterTagInput = '';
      this.loadRestaurants();
    }
  }

  removeFilterTag(tag: string): void {
    this.filterTags = this.filterTags.filter(t => t !== tag);
    this.loadRestaurants();
  }

  getStarsArray(avg: number): string[] {
    return [1,2,3,4,5].map(i => i <= Math.round(avg) ? 'full' : 'empty');
  }

  selectRestaurant(restaurant: Restaurant): void {
    if (this.cart.length > 0 && this.selectedRestaurant?.id !== restaurant.id) {
      this.cart = [];
    }
    this.selectedRestaurant = restaurant;
    this.step = 'products';
    this.isLoadingProducts = true;
    this.restaurantPromotions = [];
    // Load promotions for this restaurant
    this.catalogService.getRestaurantPromotions(restaurant.id).subscribe({
      next: (promotions) => { this.restaurantPromotions = promotions; },
      error: () => {}
    });
    this.errorMessage = '';
    this.catalogService.getProductsByRestaurant(restaurant.id).subscribe({
      next: (products) => {
        this.products = products;
        this.isLoadingProducts = false;
      },
      error: () => {
        this.errorMessage = 'Error al cargar los productos.';
        this.isLoadingProducts = false;
      }
    });
  }

  backToRestaurants(): void {
    this.step = 'restaurants';
    this.selectedRestaurant = null;
    this.products = [];
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ── Carrito ─────────────────────────────────────

  addToCart(product: Product): void {
    if (!product.isAvailable) return;
    const existing = this.cart.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
    }
  }

  increaseCartItem(productId: string): void {
    const item = this.cart.find(i => i.productId === productId);
    if (item) item.quantity++;
  }

  removeFromCart(productId: string): void {
    const item = this.cart.find(i => i.productId === productId);
    if (!item) return;
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      this.cart = this.cart.filter(i => i.productId !== productId);
    }
  }

  getQuantityInCart(productId: string): number {
    return this.cart.find(i => i.productId === productId)?.quantity || 0;
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  onCurrencyChange(): void {
    if (this.selectedCurrency === 'GTQ') {
      this.cartFxRate = null;
      return;
    }
    this.cartFxLoading = true;
    this.cartFxRate = null;
    this.fxService.getRate('GTQ', this.selectedCurrency).subscribe({
      next: (res) => { this.cartFxRate = res.rate || null; this.cartFxLoading = false; },
      error: () => { this.cartFxRate = null; this.cartFxLoading = false; }
    });
  }

  get cartTotalConverted(): string {
    if (!this.cartFxRate) return '';
    return (this.cartTotalAfterCoupon * this.cartFxRate).toFixed(2);
  }

  get cartTotalAfterCoupon(): number {
    const discount = this.couponResult?.valid ? this.couponResult.discountAmount : 0;
    return Math.max(0, this.cartTotal - discount);
  }

  get cartItemCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  // ── Mis pedidos ─────────────────────────────────

  openOrdersPanel(): void {
    this.showOrdersPanel = true;
    this.isLoadingOrders = true;
    this.myOrders = [];
    this.orderService.getMyOrders().subscribe({
      next: (res) => {
        this.myOrders = res.orders || [];
        this.isLoadingOrders = false;
      },
      error: () => { this.isLoadingOrders = false; }
    });
  }

  closeOrdersPanel(): void {
    this.showOrdersPanel = false;
  }

  canPay(order: any): boolean {
    return order.status !== 'PAID' && order.status !== 'CANCELLED' && order.status !== 'DELIVERED';
  }

  canCancel(order: any): boolean {
    return order.status === 'PENDING' || order.status === 'CONFIRMED';
  }

  cancelOrder(order: any): void {
    if (!confirm('¿Seguro que quieres cancelar este pedido?')) return;
    this.cancellingOrderId = order.id;
    this.orderService.cancelOrder(order.id).subscribe({
      next: (res: any) => {
        if (res.success) {
          order.status = 'CANCELLED';
          this.successMessage = 'Pedido cancelado correctamente';
        } else {
          this.errorMessage = res.message || 'Error al cancelar';
        }
        this.cancellingOrderId = '';
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || 'Error al cancelar el pedido';
        this.cancellingOrderId = '';
      }
    });
  }

  payExistingOrder(order: any): void {
    this.showOrdersPanel = false;
    const items: CartItem[] = (order.items || []).map((it: any) => ({
      productId: it.product_id || it.productId || '',
      name: 'Producto',
      price: it.price || 0,
      quantity: it.quantity || 1
    }));
    this.pendingOrderId = order.id;
    this.pendingOrderTotal = order.total_amount || order.totalAmount || 0;
    this.pendingOrderItems = items;
    this.openPaymentModal();
  }

  orderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'Preparando',
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

  // ── Cupón ────────────────────────────────────────
  validateCoupon(): void {
    if (!this.couponCode.trim()) return;
    this.couponValidating = true;
    this.couponResult = null;
    this.catalogService.validateCoupon(this.couponCode.trim(), this.cartTotal).subscribe({
      next: (res) => {
        this.couponResult = { valid: res.valid, discountAmount: res.discountAmount || 0, message: res.message };
        this.couponValidating = false;
      },
      error: () => {
        this.couponResult = { valid: false, discountAmount: 0, message: 'Error al validar el cupón' };
        this.couponValidating = false;
      }
    });
  }

  clearCoupon(): void {
    this.couponCode = '';
    this.couponResult = null;
  }

  // ── Calificación ──────────────────────────────────
  openRatingModal(orderId: string, restaurantId: string, deliveryPersonId = ''): void {
    this.ratingOrderId = orderId;
    this.ratingRestaurantId = restaurantId;
    this.ratingDeliveryPersonId = deliveryPersonId;
    this.ratingRestaurantStars = 0;
    this.ratingRestaurantComment = '';
    this.ratingDeliveryStars = 0;
    this.ratingDeliveryComment = '';
    this.ratingSuccess = false;
    this.showRatingModal = true;
  }

  closeRatingModal(): void {
    this.showRatingModal = false;
  }

  setRestaurantStar(n: number): void { this.ratingRestaurantStars = n; }
  setDeliveryStar(n: number): void { this.ratingDeliveryStars = n; }

  submitRating(): void {
    if (this.ratingRestaurantStars === 0) return;
    this.ratingSubmitting = true;
    const reqs = [
      this.ratingService.createRating({
        orderId: this.ratingOrderId,
        restaurantId: this.ratingRestaurantId,
        type: 'RESTAURANT',
        stars: this.ratingRestaurantStars,
        comment: this.ratingRestaurantComment
      })
    ];
    if (this.ratingDeliveryPersonId && this.ratingDeliveryStars > 0) {
      reqs.push(this.ratingService.createRating({
        orderId: this.ratingOrderId,
        deliveryPersonId: this.ratingDeliveryPersonId,
        type: 'DELIVERY',
        stars: this.ratingDeliveryStars,
        comment: this.ratingDeliveryComment
      }));
    }
    let completed = 0;
    reqs.forEach(req => req.subscribe({
      next: () => {
        completed++;
        if (completed === reqs.length) {
          this.ratingSubmitting = false;
          this.ratingSuccess = true;
          setTimeout(() => this.closeRatingModal(), 1500);
        }
      },
      error: () => {
        completed++;
        if (completed === reqs.length) { this.ratingSubmitting = false; }
      }
    }));
  }

  canRate(order: any): boolean {
    return order.status === 'DELIVERED';
  }

  // ── Crear pedido ────────────────────────────────

  submitOrder(): void {
    if (this.cart.length === 0 || !this.deliveryAddress.trim() || !this.selectedRestaurant) return;

    const user = this.authService.getCurrentUser();
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const itemsSnapshot = [...this.cart];
    const totalSnapshot = this.cartTotalAfterCoupon;

    this.orderService.createOrder({
      userId: user?.id,
      restaurantId: this.selectedRestaurant.id,
      deliveryAddress: this.deliveryAddress.trim(),
      items: this.cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
    }).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          // Guardar datos del pedido y abrir modal de pago
          this.pendingOrderId = response.order?.id || '';
          this.pendingOrderTotal = totalSnapshot;
          this.pendingOrderItems = itemsSnapshot;
          this.cart = [];
          this.deliveryAddress = '';
          this.openPaymentModal();
        } else {
          this.errorMessage = response.message || 'Error al crear el pedido';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Error al crear el pedido';
      }
    });
  }

  // ── Modal de pago ────────────────────────────────

  openPaymentModal(): void {
    this.showPaymentModal = true;
    this.paymentSuccess = false;
    this.paymentError = '';
    this.cardHolder = '';
    this.cardLastFour = '';
    this.walletId = '';
    this.paymentMethod = 'CREDIT_CARD';
    this.fxRate = null;
    this.loadFxRate();
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    if (this.paymentSuccess) {
      this.successMessage = `Pago completado. Pedido #${this.pendingOrderId.substring(0, 8)}... confirmado.`;
    }
  }

  loadFxRate(): void {
    this.fxLoading = true;
    this.fxService.getRate('GTQ', 'USD').subscribe({
      next: (res) => {
        this.fxRate = res.rate || null;
        this.fxLoading = false;
      },
      error: () => {
        this.fxRate = null;
        this.fxLoading = false;
      }
    });
  }

  get totalInUsd(): string {
    if (!this.fxRate || this.fxRate === 0) return '—';
    return (this.pendingOrderTotal * this.fxRate).toFixed(2);
  }

  get cardLastFourValid(): boolean {
    return /^\d{4}$/.test(this.cardLastFour);
  }

  get paymentFormValid(): boolean {
    if (this.paymentMethod === 'DIGITAL_WALLET') {
      return this.walletId.trim().length >= 3;
    }
    return this.cardHolder.trim().length >= 3 && this.cardLastFourValid;
  }

  processPayment(): void {
    if (!this.paymentFormValid || this.isPaymentProcessing) return;

    this.isPaymentProcessing = true;
    this.paymentError = '';

    this.paymentService.processPayment({
      orderId: this.pendingOrderId,
      amount: this.pendingOrderTotal,
      currency: 'GTQ',
      paymentMethod: this.paymentMethod,
      cardHolder: this.cardHolder,
      cardLastFour: this.cardLastFour,
      walletId: this.walletId
    }).subscribe({
      next: (res) => {
        this.isPaymentProcessing = false;
        if (res.success) {
          this.paymentSuccess = true;
        } else {
          this.paymentError = res.message || 'Error al procesar el pago';
        }
      },
      error: (err) => {
        this.isPaymentProcessing = false;
        this.paymentError = err.error?.message || 'Error al procesar el pago';
      }
    });
  }

  // ── Helpers ─────────────────────────────────────

  getPlaceholderColor(index: number): string {
    return this.placeholderColors[index % this.placeholderColors.length];
  }

  getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
