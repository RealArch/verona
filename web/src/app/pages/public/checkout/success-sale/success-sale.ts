import { Component, inject, signal, computed, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DeliveryMethod } from '../../../../interfaces/sales';

@Component({
  selector: 'app-success-sale',
  imports: [],
  templateUrl: './success-sale.html',
  styleUrl: './success-sale.scss'
})
export class SuccessSale implements OnInit {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly platformId = inject(PLATFORM_ID);
  
  orderId = signal<string>('');
  deliveryMethod = signal<DeliveryMethod | null>(null);
  total = signal<number>(0);
    shortOrderId = computed(() => {
      const id = this.orderId();
      return id ? id.slice(-10) : '';
    });
  
  ngOnInit(): void {
    this.setupSEO();
    // Obtener datos del estado de navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || (isPlatformBrowser(this.platformId) ? history.state : undefined);
    
    if (state) {
      this.orderId.set(state['orderId'] || '');
      this.deliveryMethod.set(state['deliveryMethod'] || null);
      this.total.set(state['total'] || 0);
    }
  }
  
  private setupSEO(): void {
    this.titleService.setTitle('Compra Exitosa | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Tu compra ha sido procesada exitosamente.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
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
