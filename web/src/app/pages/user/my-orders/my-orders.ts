import { Component, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
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
export class MyOrders implements OnDestroy {
  private auth = inject(Auth);
  private sales = inject(Sales);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  
  // Signals para manejar el estado
  orders = signal<Order[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedOrder = signal<Order | null>(null);
  
  private unsubscribe?: Unsubscribe;

  constructor() {
    this.setupSEO();
    
    // Usar effect para cargar orders cuando el usuario esté disponible
    effect(() => {
      const initialized = this.auth.authInitialized();
      const user = this.auth.user();
      
      // Solo proceder cuando Firebase esté inicializado
      if (!initialized) {
        return;
      }
      
      if (user) {
        this.loadOrders(user.uid);
      } else {
        this.loading.set(false);
        this.orders.set([]);
      }
    }, { allowSignalWrites: true });
  }

  private setupSEO(): void {
    this.titleService.setTitle('Mis Pedidos | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Consulta el historial de tus pedidos en Verona.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  ngOnDestroy(): void {
    // Limpiar la suscripción cuando se destruya el componente
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private loadOrders(uid: string): void {
    // Limpiar suscripción anterior si existe
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Usar el servicio de sales para suscribirse a los pedidos
      this.unsubscribe = this.sales.subscribeToUserOrders(
        uid,
        (orders) => {
          this.orders.set(orders);
          this.loading.set(false);
          this.error.set(null);
        },
        (error) => {
          console.error('Error loading orders:', error);
          this.error.set(error.message);
          this.loading.set(false);
        }
      );
    } catch (err: any) {
      console.error('Error setting up orders subscription:', err);
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
