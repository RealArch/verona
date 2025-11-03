import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonBadge,
  IonFooter,
  IonSpinner,
  ModalController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  closeOutline,
  calendarOutline,
  documentTextOutline,
  callOutline,
  cashOutline,
  locationOutline,
  chatbubblesOutline,
  bicycleOutline,
  carOutline,
  airplaneOutline,
  helpCircle
} from 'ionicons/icons';
import { Order, OrderStatus } from 'src/app/interfaces/order';
import { Orders } from 'src/app/services/orders';
import { Popups } from 'src/app/services/popups';

@Component({
  selector: 'app-modal-view-order',
  templateUrl: './modal-view-order.page.html',
  styleUrls: ['./modal-view-order.page.scss'],
  standalone: true,
  imports: [
    IonSpinner,
    IonFooter,
    IonBadge,
    IonIcon,
    IonButton,
    IonButtons,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    CommonModule, 
    FormsModule
  ]
})
export class ModalViewOrderPage implements OnInit {
  @Input() order!: Order;

  private modalController = inject(ModalController);
  private ordersService = inject(Orders);
  private toastController = inject(ToastController);
  private popups = inject(Popups);

  isUpdatingStatus = false;

  constructor() {
    addIcons({
      closeOutline,
      calendarOutline,
      documentTextOutline,
      callOutline,
      cashOutline,
      locationOutline,
      chatbubblesOutline,
      bicycleOutline,
      carOutline,
      airplaneOutline,
      helpCircle
    });
  }

  ngOnInit() {
    console.log('Modal opened with order:', this.order);
  }

  async updateOrderStatus(targetStatus: OrderStatus): Promise<void> {
    if (!this.order || this.isUpdatingStatus) {
      return;
    }

    // Confirmar con el usuario antes de proceder
    const statusLabel = this.getStatusLabel(targetStatus);
    const orderNumber = this.order.id.slice(-10).toUpperCase();
    
    let confirmTitle = '';
    let confirmMessage = '';
    let confirmButton = '';
    
    if (targetStatus === 'cancelled') {
      confirmTitle = '¿Cancelar pedido?';
      confirmMessage = `¿Estás seguro que deseas cancelar el pedido #${orderNumber}? Esta acción no se puede deshacer.`;
      confirmButton = 'Sí, cancelar';
    } else if (targetStatus === 'completed') {
      confirmTitle = '¿Marcar como completado?';
      confirmMessage = `¿Confirmas que el pedido #${orderNumber} ha sido completado?`;
      confirmButton = 'Sí, completar';
    } else {
      confirmTitle = '¿Cambiar estado?';
      confirmMessage = `¿Deseas cambiar el estado del pedido #${orderNumber} a ${statusLabel}?`;
      confirmButton = 'Sí, cambiar';
    }

    const confirmed = await this.popups.confirm(
      confirmTitle,
      confirmMessage,
      confirmButton,
      'Cancelar'
    );

    if (!confirmed) {
      return;
    }

    this.isUpdatingStatus = true;

    try {
      await this.ordersService.updateOrderStatus(this.order.id, targetStatus);
      
      const toast = await this.toastController.create({
        message: `Estado actualizado a ${statusLabel}`,
        duration: 2500,
        position: 'top',
        color: 'success'
      });

      await toast.present();
      
      // Close modal and return the updated order
      this.modalController.dismiss({
        updated: true,
        orderId: this.order.id,
        newStatus: targetStatus
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      const toast = await this.toastController.create({
        message: 'No se pudo actualizar el estado. Inténtalo nuevamente.',
        duration: 2500,
        position: 'top',
        color: 'danger'
      });

      await toast.present();
    } finally {
      this.isUpdatingStatus = false;
    }
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'preparing': 'En preparación',
      'ready': 'Lista',
      'completed': 'Completada',
      'shipped': 'Enviada',
      'delivered': 'Entregada',
      'cancelled': 'Cancelada',
      'refunded': 'Reembolsada'
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'warning',
      'confirmed': 'primary',
      'preparing': 'secondary',
      'ready': 'tertiary',
      'shipped': 'medium',
      'completed': 'success',
      'delivered': 'success',
      'cancelled': 'danger',
      'refunded': 'dark'
    };
    return colors[status] || 'medium';
  }

  getDeliveryMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'pickup': 'Retiro en persona',
      'homeDelivery': 'Delivery',
      'shipping': 'Envío',
      'arrangeWithSeller': 'Acordar con vendedor'
    };
    return labels[method] || method;
  }

  getDeliveryMethodIcon(method: string): string {
    const icons: { [key: string]: string } = {
      'pickup': 'bicycle-outline',
      'homeDelivery': 'car-outline',
      'shipping': 'airplane-outline',
      'arrangeWithSeller': 'chatbubbles-outline'
    };
    return icons[method] || 'help-circle';
  }

  formatDate(date: any): string {
    let d: Date;

    if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return 'Fecha no disponible';
    }

    if (isNaN(d.getTime())) {
      return 'Fecha no disponible';
    }

    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  close(): void {
    this.modalController.dismiss();
  }
}
