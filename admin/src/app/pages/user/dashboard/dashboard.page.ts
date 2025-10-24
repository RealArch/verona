import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonGrid, IonRow, IonCol, IonButton, IonBadge, IonSpinner, IonCard, IonCardContent, ModalController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { layers, people, statsChart, receiptOutline, chevronForwardOutline, calendarOutline, trendingUpOutline, cubeOutline, checkmarkCircleOutline, pauseCircleOutline, cartOutline, cashOutline } from 'ionicons/icons';
import { Metadata, Counters } from 'src/app/services/metadata';
import { Orders } from 'src/app/services/orders';
import { Order } from 'src/app/interfaces/order';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ModalViewOrderPage } from '../orders/modal-view-order/modal-view-order.page';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonCardContent, IonCard, IonSpinner, IonBadge, IonButton, IonIcon, IonGrid, IonRow, IonCol, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class DashboardPage implements OnInit, OnDestroy {
  private metadata = inject(Metadata);
  private ordersService = inject(Orders);
  private router = inject(Router);
  private modalController = inject(ModalController);
  private destroy$ = new Subject<void>();

  counters = signal<Counters | null>(null);
  recentOrders = signal<Order[]>([]);
  isLoadingOrders = signal<boolean>(false);

  constructor() {
    addIcons({ 
      statsChart, 
      layers, 
      people, 
      receiptOutline, 
      chevronForwardOutline, 
      calendarOutline,
      trendingUpOutline,
      cubeOutline,
      checkmarkCircleOutline,
      pauseCircleOutline,
      cartOutline,
      cashOutline
    });
  }

  async ngOnInit() {
    this.metadata.getCounters()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.counters.set(data));
    
    await this.loadRecentOrders();
  }

  async loadRecentOrders() {
    this.isLoadingOrders.set(true);
    try {
      const result = await this.ordersService.searchOrders(0, 5);
      this.recentOrders.set(result.orders);
    } catch (error) {
      console.error('Error loading recent orders:', error);
    } finally {
      this.isLoadingOrders.set(false);
    }
  }

  getTotalRevenue(): number {
    return this.recentOrders().reduce((sum, order) => sum + (order.totals?.total || 0), 0);
  }

  getPendingOrdersCount(): number {
    return this.recentOrders().filter(order => order.status === 'pending').length;
  }

  navigateToOrders() {
    this.router.navigate(['/orders']);
  }

  async openOrderModal(order: Order) {
    const modal = await this.modalController.create({
      component: ModalViewOrderPage,
      componentProps: {
        order: order
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.updated) {
      // Reload orders if the status was updated
      await this.loadRecentOrders();
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

  formatDate(date: any): string {
    if (!date) return 'Fecha no disponible';

    let d: Date;
    if (date.seconds) {
      d = new Date(date.seconds * 1000);
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string') {
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
      year: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
