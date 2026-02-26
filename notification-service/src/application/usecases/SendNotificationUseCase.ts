import { Notification, NotificationType } from '../../domain/entities/Notification';
import { IEmailService } from '../../domain/interfaces/IEmailService';

export interface SendNotificationDTO {
  userId: string;
  userEmail: string;
  userName: string;
  type: NotificationType;
  orderId: string;
  orderNumber: string;
  products: string;
  totalAmount?: number;
  restaurantName?: string;
  deliveryPersonName?: string;
  cancellationReason?: string;
  status: string;
}

export class SendNotificationUseCase {
  constructor(private readonly emailService: IEmailService) {}

  async execute(dto: SendNotificationDTO): Promise<Notification> {
    console.log(`📧 Enviando notificación tipo ${dto.type} a ${dto.userEmail}`);

    const notification = new Notification({
      id: Date.now().toString(),
      ...dto,
      createdAt: new Date()
    });

    // Generar contenido del email
    const emailContent = this.generateEmailContent(notification);

    // Enviar email
    await this.emailService.sendEmail({
      to: dto.userEmail,
      subject: emailContent.subject,
      html: emailContent.html
    });

    notification.markAsSent();

    console.log(`✅ Notificación enviada exitosamente a ${dto.userEmail}`);

    return notification;
  }

  private generateEmailContent(notification: Notification): { subject: string; html: string } {
    switch (notification.type) {
      case NotificationType.ORDER_CREATED:
        return {
          subject: `Orden #${notification.orderNumber} - Confirmación de Pedido`,
          html: `
            <h2>¡Gracias por tu pedido, ${notification.userName}!</h2>
            <p><strong>Número de Orden:</strong> ${notification.orderNumber}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Monto Total:</strong> $${notification.totalAmount?.toFixed(2)}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
            <p><strong>Fecha:</strong> ${notification.createdAt.toLocaleString()}</p>
            <hr>
            <p>Te notificaremos cuando tu pedido esté en camino.</p>
          `
        };

      case NotificationType.ORDER_CANCELLED_BY_CLIENT:
        return {
          subject: `Orden #${notification.orderNumber} - Cancelada`,
          html: `
            <h2>Orden Cancelada</h2>
            <p>Hola ${notification.userName},</p>
            <p>Tu orden ha sido cancelada exitosamente.</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Fecha de Cancelación:</strong> ${notification.createdAt.toLocaleString()}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
          `
        };

      case NotificationType.ORDER_IN_TRANSIT:
        return {
          subject: `Orden #${notification.orderNumber} - En Camino`,
          html: `
            <h2>¡Tu pedido está en camino! 🚗</h2>
            <p>Hola ${notification.userName},</p>
            <p><strong>Número de Orden:</strong> ${notification.orderNumber}</p>
            <p><strong>Repartidor:</strong> ${notification.deliveryPersonName}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
            <p>Tu pedido llegará pronto.</p>
          `
        };

      case NotificationType.ORDER_CANCELLED_BY_RESTAURANT:
        return {
          subject: `Orden #${notification.orderNumber} - Cancelada por Restaurante`,
          html: `
            <h2>Orden Cancelada</h2>
            <p>Hola ${notification.userName},</p>
            <p>Lamentamos informarte que ${notification.restaurantName} ha cancelado tu orden.</p>
            <p><strong>Razón:</strong> ${notification.cancellationReason}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
          `
        };

      case NotificationType.ORDER_CANCELLED_BY_DELIVERY:
        return {
          subject: `Orden #${notification.orderNumber} - Cancelada por Repartidor`,
          html: `
            <h2>Orden Cancelada</h2>
            <p>Hola ${notification.userName},</p>
            <p>Tu orden ha sido cancelada por el repartidor.</p>
            <p><strong>Repartidor:</strong> ${notification.deliveryPersonName}</p>
            <p><strong>Razón:</strong> ${notification.cancellationReason}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
          `
        };

      case NotificationType.ORDER_REJECTED:
        return {
          subject: `Orden #${notification.orderNumber} - Rechazada`,
          html: `
            <h2>Orden Rechazada</h2>
            <p>Hola ${notification.userName},</p>
            <p>${notification.restaurantName} no pudo procesar tu orden.</p>
            <p><strong>Número de Orden:</strong> ${notification.orderNumber}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p><strong>Estado:</strong> ${notification.status}</p>
          `
        };

      case NotificationType.ORDER_DELIVERED:
        return {
          subject: `Orden #${notification.orderNumber} - Entregada`,
          html: `
            <h2>¡Orden Entregada! 🎉</h2>
            <p>Hola ${notification.userName},</p>
            <p>Tu pedido ha sido entregado exitosamente.</p>
            <p><strong>Número de Orden:</strong> ${notification.orderNumber}</p>
            <p><strong>Productos:</strong> ${notification.products}</p>
            <p>¡Gracias por tu preferencia!</p>
          `
        };

      default:
        return {
          subject: `Orden #${notification.orderNumber} - Notificación`,
          html: `<p>Actualización de tu orden ${notification.orderNumber}</p>`
        };
    }
  }
}
