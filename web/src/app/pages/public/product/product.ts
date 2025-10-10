import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { ProductsService } from '../../../services/products/products.service';
import { Product as ProductInterface, ProductVariant } from '../../../interfaces/products';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { CurrencyPipe } from '@angular/common';
import { CategoriesService } from '../../../services/categories/categories.service';
import { ProductItemComponent } from '../../../components/product-item/product-item.component';
import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';

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
  private readonly cartService = inject(ShoppingCartService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  
  // Signals para el estado del componente
  currentProduct = signal<ProductInterface | null>(null);
  relatedProducts = signal<ProductInterface[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  selectedVariant = signal<ProductVariant | null>(null);
  selectedQuantity = signal<number>(1);
  activeTab = signal<string>('description');
  currentImageIndex = signal<number>(0);
  addingToCart = signal<boolean>(false);

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

  // Computed para verificar si el producto actual está en el carrito
  isInCart = computed(() => {
    const cart = this.cartService.cart();
    const product = this.currentProduct();
    const variant = this.selectedVariant();
    
    if (!cart || !product) return false;
    
    const productId = product.id || product.objectID;
    const variantId = variant?.id;
    
    return cart.items.some(item => 
      item.productId === productId && 
      (variantId ? item.variantId === variantId : !item.variantId)
    );
  });

  // Computed para el texto del botón de agregar al carrito
  addToCartButtonText = computed(() => {
    if (this.addingToCart()) return 'Agregando...';
    if (this.isInCart()) return 'En el Carrito';
    if (!this.isInStock()) return 'Agotado';
    return 'Agregar al Carrito';
  });

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

          // Update SEO metadata
          this.updateMetaTags(product);

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

  /**
   * Update all SEO meta tags for the product page
   */
  private updateMetaTags(product: ProductInterface): void {
    const productId = product.id || product.objectID;
    const productUrl = `https://verona-ffbcd.web.app/product/${product.slug}/${productId}`;
    const imageUrl = product.photos && product.photos.length > 0 
      ? product.photos[0].large.url 
      : 'https://verona-ffbcd.web.app/logos/logo.png';
    
    const price = product.price;
    const currency = 'USD';
    const availability = parseInt(product.stock) > 0 ? 'in stock' : 'out of stock';
    const categoryName = this.getCategoryName(product.categoryId);
    
    // Title
    const title = `${product.name} | Verona`;
    this.titleService.setTitle(title);
    
    // Standard Meta Tags
    this.metaService.updateTag({ name: 'description', content: product.description || `Compra ${product.name} en Verona. ${categoryName}.` });
    this.metaService.updateTag({ name: 'keywords', content: `${product.name}, ${categoryName}, comprar online, Verona, Venezuela` });
    this.metaService.updateTag({ name: 'author', content: 'Verona' });
    
    // Open Graph (Facebook, LinkedIn, etc.)
    this.metaService.updateTag({ property: 'og:type', content: 'product' });
    this.metaService.updateTag({ property: 'og:title', content: product.name });
    this.metaService.updateTag({ property: 'og:description', content: product.description || `Compra ${product.name} en Verona.` });
    this.metaService.updateTag({ property: 'og:image', content: imageUrl });
    this.metaService.updateTag({ property: 'og:image:alt', content: product.name });
    this.metaService.updateTag({ property: 'og:image:width', content: '1200' });
    this.metaService.updateTag({ property: 'og:image:height', content: '630' });
    this.metaService.updateTag({ property: 'og:url', content: productUrl });
    this.metaService.updateTag({ property: 'og:site_name', content: 'Verona' });
    this.metaService.updateTag({ property: 'og:locale', content: 'es_VE' });
    
    // Open Graph Product-specific
    this.metaService.updateTag({ property: 'product:price:amount', content: price.toString() });
    this.metaService.updateTag({ property: 'product:price:currency', content: currency });
    this.metaService.updateTag({ property: 'product:availability', content: availability });
    this.metaService.updateTag({ property: 'product:category', content: categoryName });
    
    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: product.name });
    this.metaService.updateTag({ name: 'twitter:description', content: product.description || `Compra ${product.name} en Verona.` });
    this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });
    this.metaService.updateTag({ name: 'twitter:image:alt', content: product.name });
    
    // Additional SEO tags
    this.metaService.updateTag({ name: 'robots', content: 'index, follow' });
    this.metaService.updateTag({ name: 'googlebot', content: 'index, follow' });
    this.metaService.updateTag({ httpEquiv: 'Content-Type', content: 'text/html; charset=utf-8' });
    
    // Canonical URL
    this.metaService.updateTag({ rel: 'canonical', href: productUrl });
    
    // Mobile optimization
    this.metaService.updateTag({ name: 'viewport', content: 'width=device-width, initial-scale=1' });
    this.metaService.updateTag({ name: 'theme-color', content: '#000000' });
    
    // Additional product structured data hints (JSON-LD would be ideal but requires script injection)
    this.metaService.updateTag({ itemprop: 'name', content: product.name });
    this.metaService.updateTag({ itemprop: 'description', content: product.description || '' });
    this.metaService.updateTag({ itemprop: 'image', content: imageUrl });
    this.metaService.updateTag({ itemprop: 'price', content: price.toString() });
    this.metaService.updateTag({ itemprop: 'priceCurrency', content: currency });
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

  async addToCart(): Promise<void> {
    const product = this.currentProduct();
    const variant = this.selectedVariant();
    const quantity = this.selectedQuantity();

    if (!product || this.addingToCart() || !this.isInStock()) {
      return;
    }

    // Si ya está en el carrito, no hacer nada (o podrías mostrar un mensaje)
    if (this.isInCart()) {
      console.log('Producto ya está en el carrito');
      return;
    }

    try {
      this.addingToCart.set(true);
      
      await this.cartService.addToCart(product, variant ?? undefined, quantity);
      
      console.log('Producto agregado al carrito exitosamente:', {
        product: product.name,
        variant: variant?.name,
        quantity
      });

    } catch (error) {
      console.error('Error agregando al carrito:', error);
      this.error.set('Error al agregar al carrito. Inténtalo de nuevo.');
      
      // Limpiar el error después de 3 segundos
      setTimeout(() => {
        this.error.set(null);
      }, 3000);
      
    } finally {
      this.addingToCart.set(false);
    }
  }

  addToWishlist(): void {
    console.log('Agregando a favoritos:', this.currentProduct());
    // Aquí iría la lógica para agregar a favoritos
  }

  switchTab(tab: string): void {
    this.activeTab.set(tab);
  }
}