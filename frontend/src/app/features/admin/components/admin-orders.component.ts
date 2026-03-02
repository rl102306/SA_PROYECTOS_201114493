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
  orders: any[] = [];
  isLoading = false;
  errorMessage = '';
  currentUserRole = '';

  // Filtros
  selectedStatus = 'DELIVERED,CANCELLED';
  dateFrom = '';
  dateTo = '';

  // Modal foto
  selectedPhoto: string | null = null;

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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
