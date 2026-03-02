import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DeliveryService } from '../services/delivery.service';

@Component({
  selector: 'app-delivery-dashboard',
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
  myDeliveries: any[] = [];
  pendingDeliveries: any[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Estado para subir foto
  deliveryIdForPhoto: string | null = null;
  photoBase64: string = '';
  isUpdating = false;

  readonly statusLabels: Record<string, string> = {
    PENDING: 'Pendiente',
    ASSIGNED: 'Asignado',
    PICKED_UP: 'Recogido',
    IN_TRANSIT: 'En Tránsito',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado'
  };

  readonly nextStatus: Record<string, string> = {
    ASSIGNED: 'PICKED_UP',
    PICKED_UP: 'IN_TRANSIT',
    IN_TRANSIT: 'DELIVERED'
  };

  readonly nextStatusLabel: Record<string, string> = {
    ASSIGNED: 'Marcar como Recogido',
    PICKED_UP: 'Marcar En Tránsito',
    IN_TRANSIT: 'Marcar como Entregado'
  };

  constructor(
    private deliveryService: DeliveryService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.deliveryService.getMyDeliveries().subscribe({
      next: (res: any) => {
        this.myDeliveries = res.deliveries || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.deliveryService.getPendingDeliveries().subscribe({
      next: (res: any) => {
        this.pendingDeliveries = res.deliveries || [];
      }
    });
  }

  acceptDelivery(deliveryId: string): void {
    this.isUpdating = true;
    this.deliveryService.acceptDelivery(deliveryId).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = 'Entrega aceptada';
          this.loadData();
        } else {
          this.errorMessage = res.message;
        }
        this.isUpdating = false;
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || 'Error al aceptar entrega';
        this.isUpdating = false;
      }
    });
  }

  advanceStatus(delivery: any): void {
    const next = this.nextStatus[delivery.status];
    if (!next) return;

    if (next === 'DELIVERED') {
      // Mostrar sección de foto en lugar de avanzar directamente
      this.deliveryIdForPhoto = delivery.id;
      this.photoBase64 = '';
      return;
    }

    this.doUpdateStatus(delivery.id, next);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extraer solo la parte base64 (sin el prefijo data:image/...;base64,)
      this.photoBase64 = result.split(',')[1] || result;
    };
    reader.readAsDataURL(file);
  }

  confirmDelivered(): void {
    if (!this.deliveryIdForPhoto || !this.photoBase64) {
      this.errorMessage = 'Debes seleccionar una foto antes de confirmar la entrega';
      return;
    }
    this.doUpdateStatus(this.deliveryIdForPhoto, 'DELIVERED', undefined, this.photoBase64);
    this.deliveryIdForPhoto = null;
    this.photoBase64 = '';
  }

  cancelPhotoUpload(): void {
    this.deliveryIdForPhoto = null;
    this.photoBase64 = '';
  }

  private doUpdateStatus(deliveryId: string, status: string, reason?: string, photo?: string): void {
    this.isUpdating = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.deliveryService.updateStatus(deliveryId, status, reason, photo).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMessage = res.message || 'Estado actualizado';
          this.loadData();
        } else {
          this.errorMessage = res.message;
        }
        this.isUpdating = false;
      },
      error: (err: any) => {
        this.errorMessage = err.error?.message || 'Error al actualizar estado';
        this.isUpdating = false;
      }
    });
  }

  hasNextStatus(delivery: any): boolean {
    return !!this.nextStatus[delivery.status];
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
