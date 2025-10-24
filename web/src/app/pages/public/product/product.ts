import { Component, OnInit, OnDestroy, inject, signal, computed, CUSTOM_ELEMENTS_SCHEMA, PLATFORM_ID, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ProductsService } from '../../../services/products/products.service';
import { Product as ProductInterface, ProductVariant } from '../../../interfaces/products';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';
import { CurrencyPipe } from '@angular/common';
import { CategoriesService } from '../../../services/categories/categories.service';
import { ProductItemComponent } from '../../../components/product-item/product-item.component';
import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';
import { Wishlist } from '../../../services/wishlist';
import { AnalyticsService } from '../../../services/analytics/analytics.service';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-product',
  imports: [CurrencyPipe, ProductItemComponent, TitleCasePipe, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './product.html',
  styleUrl: './product.scss'
})
export class ProductComponent implements OnInit, OnDestroy, AfterViewInit {

  private readonly destroy$ = new Subject<void>();
  private readonly route = inject(ActivatedRoute);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly cartService = inject(ShoppingCartService);
  private readonly wishlistService = inject(Wishlist);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);
  
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
  addingToWishlist = signal<boolean>(false);
  swiperVisible = signal(false);
  
  private mainSwiperElement?: any;
  private thumbsSwiperElement?: any;

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

  // Computed para verificar si está en wishlist
  isInWishlist = computed(() => {
    const product = this.currentProduct();
    const variant = this.selectedVariant();
    
    if (!product) return false;
    
    const productId = product.id || product.objectID || '';
    const variantId = variant?.id;
    
    return this.wishlistService.isInWishlist(productId, variantId);
  });

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const productId = params['id'];
      if (productId) {
        this.loadProduct(productId);
      }
    });
    
    if (isPlatformBrowser(this.platformId)) {
      requestAnimationFrame(() => {
        this.swiperVisible.set(true);
      });
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupSwipers();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSwipers(): void {
    // Intentar múltiples veces si no está listo
    const attemptSetup = (attempts = 0) => {
      if (attempts > 10) {
        console.warn('No se pudieron configurar los swipers después de múltiples intentos');
        return;
      }

      const mainSwiper = this.elementRef.nativeElement.querySelector('#main-swiper');
      const thumbsSwiper = this.elementRef.nativeElement.querySelector('#thumbs-swiper');
      const prevButton = this.elementRef.nativeElement.querySelector('.swiper-thumb-prev');
      const nextButton = this.elementRef.nativeElement.querySelector('.swiper-thumb-next');
      
      // Si no están listos, intentar de nuevo
      if (!mainSwiper?.swiper || !thumbsSwiper?.swiper) {
        setTimeout(() => attemptSetup(attempts + 1), 100);
        return;
      }

      if (mainSwiper && thumbsSwiper) {
        this.mainSwiperElement = mainSwiper;
        this.thumbsSwiperElement = thumbsSwiper;
        
        // Link thumbs to main swiper
        if (mainSwiper.swiper && thumbsSwiper.swiper) {
          mainSwiper.swiper.params.thumbs = { swiper: thumbsSwiper.swiper };
          mainSwiper.swiper.thumbs.init();
          mainSwiper.swiper.thumbs.update();
          
          // Update current image index when main swiper changes
          mainSwiper.addEventListener('slidechange', () => {
            if (mainSwiper.swiper) {
              this.currentImageIndex.set(mainSwiper.swiper.activeIndex);
            }
          });
          
          // Also listen to slideChangeTransitionEnd for more reliable updates
          mainSwiper.addEventListener('slidechangetransitionend', () => {
            if (mainSwiper.swiper) {
              this.currentImageIndex.set(mainSwiper.swiper.activeIndex);
            }
          });
        }

        // Setup custom navigation for thumbs
        if (prevButton && nextButton && thumbsSwiper.swiper) {
          const updateButtonStates = () => {
            if (thumbsSwiper.swiper) {
              prevButton.disabled = thumbsSwiper.swiper.isBeginning;
              nextButton.disabled = thumbsSwiper.swiper.isEnd;
            }
          };

          prevButton.addEventListener('click', () => {
            thumbsSwiper.swiper?.slidePrev();
            setTimeout(updateButtonStates, 50);
          });

          nextButton.addEventListener('click', () => {
            thumbsSwiper.swiper?.slideNext();
            setTimeout(updateButtonStates, 50);
          });

          // Update button states on slide change
          thumbsSwiper.addEventListener('slidechange', updateButtonStates);
          
          // Update on progress change for smooth updates
          thumbsSwiper.addEventListener('progress', updateButtonStates);

          // Initial state
          updateButtonStates();
        }
        
        console.log('Swipers configurados correctamente');
      }
    };

    setTimeout(() => attemptSetup(), 100);
  }

  /**
 * Devuelve el path de IDs de categorías desde la raíz hasta la categoría actual
 */
  getCategoryPath(categoryId: string): string[] {
    return this.categoriesService.getTreeNames(categoryId);
  }

  /**
   * Devuelve el path de categorías con ID y nombre desde la raíz hasta la categoría actual
   */
  getCategoryPathWithIds(categoryId: string): Array<{ id: string; name: string }> {
    const categories = this.categoriesService.categories() ?? [];
    const path: Array<{ id: string; name: string }> = [];
    let currentId = categoryId;
    
    while (currentId) {
      const category = categories.find((cat) => cat.objectID === currentId);
      if (!category) break;
      path.unshift({ id: category.objectID!, name: category.name });
      currentId = category.parentId;
      if (!currentId || currentId === 'root') break;
    }
    
    return path;
  }

  /**
   * Load related products from Algolia based on category
   */
  async loadRelatedProducts(categoryId: string, currentProductId: string): Promise<void> {
    try {
      const results = await this.productsService.search(
        '', // Empty search query
        undefined, // No min price
        undefined, // No max price
        [categoryId], // Filter by same category
        15, // Get 15 products
        0 // First page
      );

      // Filter out the current product and set related products
      const related = results.hits.filter(p => {
        const pId = p.id || p.objectID;
        return pId !== currentProductId;
      }).slice(0, 15); // Ensure max 15 products

      this.relatedProducts.set(related);
      console.log('Related products loaded:', related.length);
    } catch (error) {
      console.error('Error loading related products:', error);
      this.relatedProducts.set([]);
    }
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
          this.currentImageIndex.set(0); // Reset al primer slide
          this.loading.set(false);
          console.log('Producto cargado:', product);

          // Update SEO metadata
          if (product) {
            this.updateMetaTags(product);
            
            // Track product view in Analytics
            this.analyticsService.logProductView(
              product.objectID || product.id || '',
              product.name,
              product.price,
              this.getCategoryName(product.categoryId)
            );
          }

          // Load related products based on category
          if (product?.categoryId) {
            this.loadRelatedProducts(product.categoryId, productId);
          }
          
          // Select first variant by default
          if (product?.variants && product.variants.length > 0) {
            this.selectedVariant.set(product.variants[0]);
          }
          
          // Reconfigurar swipers después de que el DOM se actualice
          if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
              this.setupSwipers();
            }, 200);
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

  goToSlide(index: number): void {
    // Intentar con el elemento guardado primero
    if (this.mainSwiperElement?.swiper) {
      this.mainSwiperElement.swiper.slideTo(index);
      this.currentImageIndex.set(index);
      return;
    }
    
    // Si no está disponible, buscar de nuevo en el DOM
    const mainSwiper = this.elementRef.nativeElement.querySelector('#main-swiper');
    if (mainSwiper?.swiper) {
      this.mainSwiperElement = mainSwiper;
      mainSwiper.swiper.slideTo(index);
      this.currentImageIndex.set(index);
    } else {
      console.warn('Main swiper no disponible, reintentando configuración...');
      // Intentar reconfigurar los swipers
      this.setupSwipers();
      // Y actualizar el índice de todas formas
      this.currentImageIndex.set(index);
    }
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
      
      // Track add to cart event in Analytics
      const price = variant?.price ?? product.price;
      this.analyticsService.logAddToCart(
        product.objectID || product.id || '',
        product.name,
        price,
        quantity
      );
      
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

  /**
   * Agrega o remueve el producto del wishlist
   */
  async addToWishlist(): Promise<void> {
    const product = this.currentProduct();
    const variant = this.selectedVariant();

    if (!product || this.addingToWishlist()) {
      return;
    }

    try {
      this.addingToWishlist.set(true);
      
      const productId = product.objectID || product.id || '';
      const isInWishlist = this.wishlistService.isInWishlist(productId, variant?.id);

      if (isInWishlist) {
        // Si ya está en wishlist, remover
        const result = await this.wishlistService.removeFromWishlist(productId, variant?.id);
        this.showNotification(result.message, result.success ? 'info' : 'error');
      } else {
        // Si no está, agregar
        const result = await this.wishlistService.addToWishlist(product, variant ?? undefined);
        
        // Track add to wishlist event in Analytics
        if (result.success) {
          const price = variant?.price ?? product.price;
          this.analyticsService.logAddToWishlist(
            productId,
            product.name,
            price
          );
        }
        
        this.showNotification(result.message, result.success ? 'success' : 'error');
      }
      
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      this.showNotification('Error al actualizar la lista de deseos', 'error');
    } finally {
      this.addingToWishlist.set(false);
    }
  }

  /**
   * Muestra una notificación al usuario
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed bottom-4 right-4 max-w-md shadow-lg z-50 animate-fade-in`;
    
    const icon = type === 'success' 
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />';
    
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        ${icon}
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  switchTab(tab: string): void {
    this.activeTab.set(tab);
  }
}