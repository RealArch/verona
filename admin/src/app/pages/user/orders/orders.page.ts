import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonSearchbar, 
  IonButtons,
  IonMenuButton,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonModal,
  IonButton
} from '@ionic/angular/standalone';
import { Orders } from 'src/app/services/orders';
import { Order, OrderSearchFilters } from 'src/app/interfaces/order';
import { addIcons } from 'ionicons';
import { 
  receiptOutline, 
  personOutline, 
  calendarOutline, 
  cashOutline,
  checkmarkCircle,
  timeOutline,
  bicycleOutline,
  carOutline,
  airplaneOutline,
  chatbubblesOutline,
  closeOutline,
  chevronForwardOutline, documentTextOutline, callOutline, locationOutline } from 'ionicons/icons';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: true,
  imports: [
    IonModal,
    IonButton,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonSpinner,
    IonIcon,
    IonBadge,
    IonMenuButton,
    IonButtons,
    IonSearchbar,
    IonContent, 
    IonHeader, 
    IonTitle, 
    IonToolbar, 
    CommonModule, 
    FormsModule
  ]
})
export class OrdersPage implements OnInit {
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  @ViewChild(IonModal) modal!: IonModal;

  private ordersService = inject(Orders);

  orders: Order[] = [];
  loading = true;
  searchQuery = '';
  currentPage = 0;
  pageSize = 20;
  hasMore = true;
  totalOrders = 0;
  selectedOrder: Order | null = null;

  constructor() {
    addIcons({calendarOutline,receiptOutline,chevronForwardOutline,closeOutline,documentTextOutline,callOutline,cashOutline,locationOutline,chatbubblesOutline,personOutline,checkmarkCircle,timeOutline,bicycleOutline,carOutline,airplaneOutline});
  }

  async ngOnInit() {
    await this.loadOrders(true);
  }

  async loadOrders(reset: boolean = false) {
    if (reset) {
      this.currentPage = 0;
      this.orders = [];
      this.hasMore = true;
      this.loading = true;
    }

    if (!this.hasMore && !reset) return;

    try {
      const filters: OrderSearchFilters = {
        query: this.searchQuery
      };

      const result = await this.ordersService.searchOrders(
        this.currentPage,
        this.pageSize,
        filters
      );

      if (reset) {
        this.orders = result.orders;
      } else {
        this.orders = [...this.orders, ...result.orders];
      }

      this.totalOrders = result.total;
      this.hasMore = result.hasMore;
      this.currentPage++;
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      this.loading = false;
    }
  }

  async onSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    await this.loadOrders(true);
  }

  async loadMore(event: any) {
    await this.loadOrders(false);
    event.target.complete();

    if (!this.hasMore) {
      event.target.disabled = true;
    }
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'preparing': 'En preparación',
      'ready': 'Lista',
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
    return icons[method] || 'receipt-outline';
  }

  formatDate(date: any): string {
    let d: Date;
    
    if (date && typeof date.toDate === 'function') {
      // Es un timestamp de Firestore
      d = date.toDate();
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      // Fallback para fechas inválidas
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

  openOrderDetail(order: Order): void {
    this.selectedOrder = order;
    this.modal.present();
  }

  closeOrderDetail(): void {
    this.modal.dismiss();
    this.selectedOrder = null;
  }
}
