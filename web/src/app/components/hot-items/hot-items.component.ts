import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ElementRef, effect } from '@angular/core';
import { Product, ProductVariant } from '../../interfaces/products';
import { Subject, takeUntil } from 'rxjs';
import { ProductsService } from '../../services/products/products.service';
import { Router } from '@angular/router';
import { ProductItemComponent } from '../product-item/product-item.component';
import { register } from 'swiper/element/bundle';

// Register Swiper web components
register();

@Component({
  selector: 'app-hot-items',
  templateUrl: './hot-items.component.html',
  styleUrl: './hot-items.component.scss',
  imports: [ ProductItemComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HotItemsComponent implements OnInit, OnDestroy {
// INJECTIONS
  private router = inject(Router);
  private productsService = inject(ProductsService);
  private readonly elementRef = inject(ElementRef);
  
  // SIGNALS
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);
  swiperVisible = signal(false);
  
  private readonly destroy$ = new Subject<void>();
  private swiperElement?: any;

  constructor() {
    // Effect to setup swiper when products are loaded
    effect(() => {
      if (this.products().length > 0 && !this.loading() && !this.swiperElement) {
        this.setupCustomNavigation();
      }
    });
  }

  ngOnInit(): void {
    this.loadLatestAdditions(10);
  }

  /**
   * Carga los productos más recientes usando ProductService
   * Implementa desuscripción automática con takeUntil
   */
  loadLatestAdditions(limitCount: number): void {
    this.loading.set(true);
    this.productsService.getBestSellers(limitCount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
          setTimeout(() => this.swiperVisible.set(true), 100);
        }, 
        error: (err) => {
          console.error('Error loading latest additions:', err);
          this.products.set([]);
          this.loading.set(false);
          setTimeout(() => this.swiperVisible.set(true), 100);
        }
      });
  }

  /**
   * Setup custom navigation buttons for Swiper
   */
  private setupCustomNavigation(): void {
    setTimeout(() => {
      const swiperEl = this.elementRef.nativeElement.querySelector('swiper-container');
      const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
      const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

      if (swiperEl && prevButton && nextButton) {
        this.swiperElement = swiperEl;
        prevButton.addEventListener('click', () => swiperEl.swiper.slidePrev());
        nextButton.addEventListener('click', () => swiperEl.swiper.slideNext());
        swiperEl.addEventListener('slidechange', () => this.updateNavigationButtons());
        this.updateNavigationButtons();
      }
    }, 0);
  }

  /**
   * Update navigation button states based on swiper position
   */
  private updateNavigationButtons(): void {
    if (!this.swiperElement) return;
    const swiper = this.swiperElement.swiper;
    const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
    const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

    if (prevButton && nextButton) {
      prevButton.disabled = swiper.isBeginning;
      nextButton.disabled = swiper.isEnd;
    }
  }

  /**
   * Devuelve el número de slides visibles según el ancho de pantalla
   */
  getVisibleSlides(): number {
    if (typeof window === 'undefined') return 2;
    const width = window.innerWidth;
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    if (width >= 640) return 3;
    return 2;
  }

  /**
   * Determina si hay overflow y se deben mostrar los navegadores
   */
  shouldShowNav(): boolean {
    return this.products().length > this.getVisibleSlides();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToProduct(product: Product): void {
    this.router.navigate(['/product', product.slug, product.id]);
  }

  toggleFavorite(productId: number): void {
    console.log('Toggle favorite for product:', productId);
  }

  addToCart(productId: number): void {
    console.log('Add to cart product:', productId);
  }

  viewAllProducts(): void {
    this.router.navigate(['/products']);
  }
  getMinPrice(variants: ProductVariant[]): number {
    if (!variants || variants.length === 0) return 0;
    // Analiza todas las variantes y devuelve el precio mayor
    return Math.min(...variants.map(v => v.price ?? 0));
  }
}
