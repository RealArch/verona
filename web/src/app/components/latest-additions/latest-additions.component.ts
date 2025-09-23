import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Product, ProductVariant } from '../../interfaces/products';
import { Subject, takeUntil } from 'rxjs';
import { ProductsService } from '../../services/products/products.service';
import { Router } from '@angular/router';
import { ProductItemComponent } from '../product-item/product-item.component';

@Component({
  selector: 'app-latest-additions',
  imports: [ProductItemComponent],
  templateUrl: './latest-additions.component.html',
  styleUrl: './latest-additions.component.scss'
})
export class LatestAdditionsComponent implements OnInit, OnDestroy {
  // INJECTIONS
  private router = inject(Router);
  private productsService = inject(ProductsService);
  
  // SIGNALS
  products = signal<Product[]>([]);
  loading = signal<boolean>(false);
  
  private readonly destroy$ = new Subject<void>();
  ngOnInit(): void {
    this.loadLatestAdditions(10);
  }

  /**
   * Carga los productos más recientes usando ProductService
   * Implementa desuscripción automática con takeUntil
   */
  loadLatestAdditions(limitCount: number): void {
    this.loading.set(true);
    this.productsService.getLatestAdditions(limitCount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
          console.log(this.products());
        }, 
        error: (err) => {
          console.error('Error loading latest additions:', err);
          this.products.set([]);
          this.loading.set(false);
        }
      });
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
