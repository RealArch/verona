import { Component, OnInit, ViewChild, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonButton, 
  IonSelect, 
  IonSelectOption, 
  IonRow, 
  IonCol, 
  IonDatetime,
  IonPopover, IonGrid, IonFooter } from '@ionic/angular/standalone';
import { Orders } from 'src/app/services/orders';
import { Order, OrderSearchFilters, OrderStatus } from 'src/app/interfaces/order';
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
  chevronForwardOutline, documentTextOutline, callOutline, locationOutline, chevronDownOutline, refreshOutline } from 'ionicons/icons';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: true,
  imports: [IonFooter, IonGrid, 
    IonPopover,
    IonCol, 
    IonRow, 
    IonSelect, 
    IonSelectOption, 
    IonDatetime,
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
export class OrdersPage implements OnInit, OnDestroy {
  private ordersService = inject(Orders);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastController = inject(ToastController);
  private destroy$ = new Subject<void>();

  @ViewChild(IonModal) modal!: IonModal;
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  orders: Order[] = [];
  isLoading = false;
  isUpdatingStatus = false;
  hasMore = true;
  searchQuery = '';
  selectedOrder: Order | null = null;
  currentPage = 0;
  pageSize = 20;

  // Filter properties
  selectedStatus: OrderStatus | '' = '';
  statusOptions: { value: OrderStatus | '', label: string }[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'confirmed', label: 'Confirmado' },
    { value: 'preparing', label: 'Preparando' },
    { value: 'ready', label: 'Listo para recoger' },
    { value: 'completed', label: 'Completado' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  selectedDeliveryMethod: string = '';
  deliveryMethodOptions = [
    { value: '', label: 'Todos los métodos' },
    { value: 'pickup', label: 'Retiro en persona' },
    { value: 'homeDelivery', label: 'Delivery' },
    { value: 'shipping', label: 'Envío' },
    { value: 'arrangeWithSeller', label: 'Acordar con vendedor' }
  ];

  dateFrom: string | undefined = undefined;
  dateTo: string | undefined = undefined;

  constructor() {
    addIcons({chevronDownOutline,refreshOutline,calendarOutline,receiptOutline,chevronForwardOutline,closeOutline,documentTextOutline,callOutline,cashOutline,locationOutline,chatbubblesOutline,personOutline,checkmarkCircle,timeOutline,bicycleOutline,carOutline,airplaneOutline});
  }

  async ngOnInit() {
    // Initialize query params subscription
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.searchQuery = params['q'] || '';
        this.selectedStatus = params['status'] || '';
        this.selectedDeliveryMethod = params['deliveryMethod'] || '';
        
        // Convertir fechas de URL a formato ISO si existen
        const dateFromParam = params['dateFrom'];
        const dateToParam = params['dateTo'];
        
        this.dateFrom = dateFromParam ? this.convertToISODate(dateFromParam) : undefined;
        this.dateTo = dateToParam ? this.convertToISODate(dateToParam) : undefined;
        
        console.log('URL params dates:', { dateFromParam, dateToParam });
        console.log('Converted dates:', { dateFrom: this.dateFrom, dateTo: this.dateTo });
        
        this.currentPage = 0;
        this.orders = [];
        this.hasMore = true;
        this.loadOrders();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadOrders(reset: boolean = false) {
    if (reset) {
      this.currentPage = 0;
      this.orders = [];
      this.hasMore = true;
      this.isLoading = true;
    }

    if (!this.hasMore && !reset) return;

    try {
      const filters: OrderSearchFilters = {
        query: this.searchQuery,
        status: this.selectedStatus ? [this.selectedStatus as OrderStatus] : undefined,
        deliveryMethod: this.selectedDeliveryMethod ? [this.selectedDeliveryMethod as any] : undefined,
        dateFrom: this.dateFrom ? new Date(this.dateFrom) : undefined,
        dateTo: this.dateTo ? new Date(this.dateTo) : undefined
      };

      console.log('Applied filters:', filters);
      console.log('dateFrom string:', this.dateFrom, 'converted to:', filters.dateFrom);
      console.log('dateTo string:', this.dateTo, 'converted to:', filters.dateTo);

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

      this.hasMore = result.hasMore;
      this.currentPage++;
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async onSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    this.updateQueryParams();
  }

  onStatusChange(event: any) {
    this.selectedStatus = event.detail.value;
    this.updateQueryParams();
  }

  onDeliveryMethodChange(event: any) {
    this.selectedDeliveryMethod = event.detail.value;
    this.updateQueryParams();
  }

  onDateFromChange(event: any) {
    const value = event.detail.value;
    console.log('Date from change:', value, typeof value);
    this.dateFrom = value || undefined;
    this.updateQueryParams();
  }

  onDateToChange(event: any) {
    const value = event.detail.value;
    console.log('Date to change:', value, typeof value);
    this.dateTo = value || undefined;
    this.updateQueryParams();
  }

  getSelectedStatusLabel(): string {
    const option = this.statusOptions.find(opt => opt.value === this.selectedStatus);
    return option ? option.label : 'Todos los estados';
  }

  getSelectedDeliveryMethodLabel(): string {
    const option = this.deliveryMethodOptions.find(opt => opt.value === this.selectedDeliveryMethod);
    return option ? option.label : 'Todos los métodos';
  }

  private updateQueryParams() {
    const queryParams: any = {};
    if (this.searchQuery) {
      queryParams.q = this.searchQuery;
    } else {
      queryParams.q = null;
    }
    if (this.selectedStatus) {
      queryParams.status = this.selectedStatus;
    } else {
      queryParams.status = null;
    }
    if (this.selectedDeliveryMethod) {
      queryParams.deliveryMethod = this.selectedDeliveryMethod;
    } else {
      queryParams.deliveryMethod = null;
    }
    if (this.dateFrom) {
      queryParams.dateFrom = this.dateFrom;
    } else {
      queryParams.dateFrom = null;
    }
    if (this.dateTo) {
      queryParams.dateTo = this.dateTo;
    } else {
      queryParams.dateTo = null;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedDeliveryMethod = '';
    this.dateFrom = undefined;
    this.dateTo = undefined;
    this.updateQueryParams();
  }

  refreshSearch() {
    // Forzar una búsqueda fresca agregando un timestamp único para evitar cache
    this.currentPage = 0;
    this.orders = [];
    this.hasMore = true;
    this.loadOrders(true);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedStatus || this.selectedDeliveryMethod || this.dateFrom || this.dateTo);
  }

  getDateFromMillis(dateValue: string | number | undefined): Date {
    if (!dateValue) return new Date();
    
    // Si es un string de ISO date
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    
    // Si es un número (milliseconds)
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    return new Date();
  }

  private convertToISODate(dateValue: string): string | undefined {
    if (!dateValue) return undefined;
    
    try {
      // Si ya es formato ISO (YYYY-MM-DD), devolverlo tal cual
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      
      // Si es un timestamp en milliseconds, convertirlo
      if (!isNaN(Number(dateValue))) {
        const date = new Date(Number(dateValue));
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      
      // Para otros formatos, intentar parsear y convertir
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      
      return undefined;
    } catch (error) {
      console.error('Error converting date:', dateValue, error);
      return undefined;
    }
  }

  async loadMore(event: any) {
    await this.loadOrders(false);
    event.target.complete();

    if (!this.hasMore) {
      event.target.disabled = true;
    }
  }

  async updateSelectedOrderStatus(targetStatus: OrderStatus): Promise<void> {
    if (!this.selectedOrder || this.isUpdatingStatus) {
      return;
    }

    this.isUpdatingStatus = true;

    try {
      await this.ordersService.updateOrderStatus(this.selectedOrder.id, targetStatus);
      this.selectedOrder = {
        ...this.selectedOrder,
        status: targetStatus
      };
      
      this.orders = this.orders.map(order =>
        order.id === this.selectedOrder!.id ? { ...order, status: targetStatus } : order
      );

      const toast = await this.toastController.create({
        message: `Estado actualizado a ${this.getStatusLabel(targetStatus)}`,
        duration: 2500,
        position: 'top',
        color: 'success'
      });

      await toast.present();
      this.closeOrderDetail();
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
    return icons[method] || 'receipt-outline';
  }

  formatDate(date: any): string {
    // Debug: log del tipo de dato que llega
    console.log('formatDate input:', date, typeof date);

    let d: Date;

    if (date && typeof date.toDate === 'function') {
      // Es un timestamp de Firestore
      d = date.toDate();
      console.log('Firestore timestamp converted to:', d);
    } else if (typeof date === 'string') {
      d = new Date(date);
      console.log('String converted to date:', d);
    } else if (date instanceof Date) {
      d = date;
      console.log('Already a Date object:', d);
    } else if (typeof date === 'number') {
      // Si es un timestamp en milliseconds
      d = new Date(date);
      console.log('Number timestamp converted to:', d);
    } else {
      // Fallback para fechas inválidas o null/undefined
      console.log('Invalid date format, returning fallback');
      return 'Fecha no disponible';
    }

    // Verificar si la fecha es válida
    if (isNaN(d.getTime())) {
      console.log('Invalid date object, returning fallback');
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
