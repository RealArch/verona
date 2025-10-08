import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Unsubscribe } from '@angular/fire/firestore';
import { Auth } from '../../../services/auth/auth.services';
import { Sales } from '../../../services/sales/sales';
import { Order } from '../../../interfaces/sales';

@Component({
  selector: 'app-my-orders',
  imports: [CommonModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.scss'
})
export class MyOrders implements OnInit, OnDestroy {
  private auth = inject(Auth);
  private sales = inject(Sales);
  
  // Signals para manejar el estado
  orders = signal<Order[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedOrder = signal<Order | null>(null);
  
  private unsubscribe?: Unsubscribe;

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    // Limpiar la suscripción cuando se destruya el componente
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private loadOrders(): void {
    const user = this.auth.user();
    
    if (!user) {
      this.loading.set(false);
      return;
    }

    try {
      // Usar el servicio de sales para suscribirse a los pedidos
      this.unsubscribe = this.sales.subscribeToUserOrders(
        user.uid,
        (orders) => {
          this.orders.set(orders);
          this.loading.set(false);
          this.error.set(null);
        },
        (error) => {
          this.error.set(error.message);
          this.loading.set(false);
        }
      );
    } catch (err: any) {
      console.error('Error loading orders:', err);
      this.error.set(err.message || 'Error al cargar los pedidos');
      this.loading.set(false);
    }
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'shipped': 'Enviado',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusLabels[status] || status;
  }

  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'pending': 'badge-warning',
      'processing': 'badge-info',
      'shipped': 'badge-primary',
      'delivered': 'badge-success',
      'cancelled': 'badge-error'
    };
    return statusColors[status] || 'badge-ghost';
  }

  getDeliveryMethodLabel(method: string): string {
    const methodLabels: { [key: string]: string } = {
      'pickup': 'Recoger en tienda',
      'homeDelivery': 'Entrega a domicilio',
      'shipping': 'Envío',
      'arrangeWithSeller': 'Coordinar con vendedor'
    };
    return methodLabels[method] || method;
  }

  // Métodos para el modal de detalle
  openOrderDetail(order: Order): void {
    this.selectedOrder.set(order);
  }

  closeOrderDetail(): void {
    this.selectedOrder.set(null);
  }
}
