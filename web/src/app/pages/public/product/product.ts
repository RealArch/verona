import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductsService } from '../../../services/products/products.service';
import { Product as ProductInterface, ProductVariant } from '../../../interfaces/products';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { CurrencyPipe } from '@angular/common';
import { CategoriesService } from '../../../services/categories/categories.service';
import { ProductItemComponent } from '../../../components/product-item/product-item.component';

@Component({
  selector: 'app-product',
  imports: [CurrencyPipe, ProductItemComponent],
  templateUrl: './product.html',
  styleUrl: './product.scss'
})
export class ProductComponent implements OnInit, OnDestroy {

  private readonly destroy$ = new Subject<void>();
  private readonly route = inject(ActivatedRoute);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  // Signals para el estado del componente
  currentProduct = signal<ProductInterface | null>(null);
  relatedProducts = signal<ProductInterface[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedVariant = signal<ProductVariant | null>(null);
  selectedQuantity = signal<number>(1);
  activeTab = signal<string>('description');
  currentImageIndex = signal<number>(0);

  // Computed signals para valores derivados
  mainImage = computed(() => {
    const product = this.currentProduct();
    const index = this.currentImageIndex();
    if (!product || !product.photos || product.photos.length === 0) {
      return null;
    }
    return product.photos[index];
  });

  currentPrice = computed(() => {
    const variant = this.selectedVariant();
    const product = this.currentProduct();
    return variant?.price || product?.price || 0;
  });

  currentStock = computed(() => {
    const variant = this.selectedVariant();
    const product = this.currentProduct();
    return variant?.stock || (product ? parseInt(product.stock) : 0);
  });

  isInStock = computed(() => this.currentStock() > 0);

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const productId = params['id'];
      if (productId) {
        this.loadProduct(productId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
 * Devuelve el path de IDs de categorías desde la raíz hasta la categoría actual
 */
  getCategoryPath(categoryId: string): string[] {
    return this.categoriesService.getTreeNames(categoryId);
  }

  /**
   * Load product data from service (one-time fetch)
   */
  async loadProduct(productId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const productObservable = await this.productsService.getProduct(productId);

      productObservable.pipe(take(1)).subscribe({
        next: (product) => {
          this.currentProduct.set(product);
          this.loading.set(false);
          console.log('Producto cargado:', product);

          //related products mock example, replace with real logic
          if (product) {
            this.relatedProducts.set([...this.relatedProducts(), product]);
          }
          // Select first variant by default
          if (product?.variants && product.variants.length > 0) {
            this.selectedVariant.set(product.variants[0]);
          }
        },
        error: (err) => {
          console.error('Error loading product:', err);
          this.error.set('Error al cargar el producto');
          this.loading.set(false);
        }
      });

    } catch (error) {
      console.error('Error in loadProduct:', error);
      this.error.set('Error al cargar el producto');
      this.loading.set(false);
    }
  }

  getCategoryName(categoryId: string): string {
    return this.categoriesService.categories()?.find(cat => cat.objectID === categoryId)?.name ?? 'Categoría desconocida';
  }

  // Métodos para manejar la funcionalidad
  selectVariant(variant: ProductVariant): void {
    this.selectedVariant.set(variant);
  }

  selectImage(index: number): void {
    this.currentImageIndex.set(index);
  }

  increaseQuantity(): void {
    const selectedVariant = this.selectedVariant();
    const currentProduct = this.currentProduct();
    const currentQuantity = this.selectedQuantity();

    if (selectedVariant && currentQuantity < selectedVariant.stock) {
      this.selectedQuantity.set(currentQuantity + 1);
    } else if (!selectedVariant && currentProduct && currentQuantity < parseInt(currentProduct.stock)) {
      this.selectedQuantity.set(currentQuantity + 1);
    }
  }

  decreaseQuantity(): void {
    const currentQuantity = this.selectedQuantity();
    if (currentQuantity > 1) {
      this.selectedQuantity.set(currentQuantity - 1);
    }
  }

  addToCart(): void {
    console.log('Agregando al carrito:', {
      product: this.currentProduct(),
      variant: this.selectedVariant(),
      quantity: this.selectedQuantity()
    });
    // Aquí iría la lógica para agregar al carrito
  }

  addToWishlist(): void {
    console.log('Agregando a favoritos:', this.currentProduct());
    // Aquí iría la lógica para agregar a favoritos
  }

  switchTab(tab: string): void {
    this.activeTab.set(tab);
  }
}