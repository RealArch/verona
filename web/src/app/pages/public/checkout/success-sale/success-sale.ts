import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryMethod } from '../../../../interfaces/sales';

@Component({
  selector: 'app-success-sale',
  imports: [],
  templateUrl: './success-sale.html',
  styleUrl: './success-sale.scss'
})
export class SuccessSale implements OnInit {
  private readonly router = inject(Router);
  
  orderId = signal<string>('');
  deliveryMethod = signal<DeliveryMethod | null>(null);
  total = signal<number>(0);
    shortOrderId = computed(() => {
      const id = this.orderId();
      return id ? id.slice(-10) : '';
    });
  
  ngOnInit(): void {
    // Obtener datos del estado de navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state) {
      this.orderId.set(state['orderId'] || '');
      this.deliveryMethod.set(state['deliveryMethod'] || null);
      this.total.set(state['total'] || 0);
    }
  }
  
  goToHome(): void {
    this.router.navigate(['/']);
  }
  
  goToMyOrders(): void {
    this.router.navigate(['/user/orders']);
  }
  
  isArrangeWithSeller(): boolean {
    return this.deliveryMethod() === 'arrangeWithSeller';
  }
}
