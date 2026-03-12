import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.css']
})
export class AdminOrdersComponent implements OnInit {
  activeTab: 'orders' | 'coupons' = 'orders';
  orders: any[] = [];
  isLoading = false;
  errorMessage = '';
  currentUserRole = '';

  // Filtros
  selectedStatus = 'DELIVERED,CANCELLED';
  dateFrom = '';
  dateTo = '';

  // Cupones pendientes
  pendingCoupons: any[] = [];
  isLoadingCoupons = false;
  approvingCouponId: string | null = null;

  // Modal foto
  selectedPhoto: string | null = null;
  successMessage = '';
  refundingOrderId: string | null = null;

  readonly statusOptions = [
    { value: 'DELIVERED,CANCELLED', label: 'Finalizados y Cancelados' },
    { value: 'DELIVERED', label: 'Solo Entregados' },
    { value: 'CANCELLED', label: 'Solo Cancelados' },
    { value: 'PAID', label: 'Pagados' },
    { value: 'DELIVERED,CANCELLED,PAID', label: 'Todos los finales' }
  ];

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserRole = user?.role || '';
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminService.getOrders({
      status: this.selectedStatus,
      from: this.dateFrom || undefined,
      to: this.dateTo || undefined
    }).subscribe({
      next: (response: any) => {
        this.orders = response.orders || [];
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Error al cargar pedidos';
        this.isLoading = false;
      }
    });
  }

  setTab(tab: 'orders' | 'coupons'): void {
    this.activeTab = tab;
    if (tab === 'coupons') this.loadPendingCoupons();
  }

  loadPendingCoupons(): void {
    this.isLoadingCoupons = true;
    this.adminService.getPendingCoupons().subscribe({
      next: (res: any) => {
        this.pendingCoupons = res.coupons || [];
        this.isLoadingCoupons = false;
      },
      error: () => { this.isLoadingCoupons = false; }
    });
  }

  approveCoupon(coupon: any): void {
    if (this.approvingCouponId) return;
    this.approvingCouponId = coupon.id;
    this.adminService.approveCoupon(coupon.id).subscribe({
      next: (res: any) => {
        if (res.success) {
          coupon.is_approved = true;
          this.successMessage = `Cupón ${coupon.code} aprobado`;
        }
        this.approvingCouponId = null;
      },
      error: () => { this.approvingCouponId = null; }
    });
  }

  parseItems(itemsJson: any): any[] {
    if (!itemsJson) return [];
    if (typeof itemsJson === 'string') {
      try { return JSON.parse(itemsJson); } catch { return []; }
    }
    return Array.isArray(itemsJson) ? itemsJson : [];
  }

  openPhoto(photo: string): void {
    this.selectedPhoto = photo;
  }

  closePhoto(): void {
    this.selectedPhoto = null;
  }

  approveRefund(order: any): void {
    if (this.refundingOrderId) return;
    this.refundingOrderId = order.id;
    this.adminService.approveRefund(order.id).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = `Reembolso aprobado para orden #${order.id?.substring(0, 8).toUpperCase()}`;
          order.refunded = true;
        } else {
          this.errorMessage = res.message || 'No se pudo aprobar el reembolso';
        }
        this.refundingOrderId = null;
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || 'Error al aprobar reembolso';
        this.refundingOrderId = null;
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
