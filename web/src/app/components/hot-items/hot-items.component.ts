import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../../services/products/products.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Product, ProductVariant } from '../../interfaces/products';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-hot-items',
  templateUrl: './hot-items.component.html',
  styleUrl: './hot-items.component.scss',
  imports: [CurrencyPipe],
})
export class HotItemsComponent implements OnInit, OnDestroy {
  //INJECTIONS
  private cdr = inject(ChangeDetectorRef)
  //
  products: Product[] = [];
  loading = false;
  private readonly destroy$ = new Subject<void>();

  constructor(private router: Router, private productsService: ProductsService) { }

  ngOnInit(): void {
    this.loadHotItems(10); // Puedes cambiar el número si lo necesitas
  }

  /**
   * Carga los productos más vendidos usando ProductService
   * Implementa desuscripción automática con takeUntil
   */
  loadHotItems(limitCount: number): void {
    this.loading = true;
    this.productsService.getBestSellers(limitCount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
          this.cdr.detectChanges()
        }, 
        error: (err) => {
          console.error('Error loading hot items:', err);
          this.products = [];
          this.loading = false;
          this.cdr.detectChanges()
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
