import { Component, inject, Input, signal, computed } from '@angular/core';
import { Product, ProductVariant } from '../../interfaces/products';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from "@angular/forms";
import { Wishlist } from '../../services/wishlist';
import { ShoppingCartService } from '../../services/shopping-cart/shopping-cart';

@Component({
  selector: 'app-product-item',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './product-item.component.html',
  styleUrl: './product-item.component.scss'
})
export class ProductItemComponent {
  //input
  @Input() product!: Product;
  
  //Injections
  router = inject(Router);
  wishlistService = inject(Wishlist);
  cartService = inject(ShoppingCartService);
  
  // Signals para UI
  isAddingToWishlist = signal<boolean>(false);
  isAddingToCart = signal<boolean>(false);
  
  // Computed para verificar si está en wishlist
  isInWishlist = computed(() => {
    if (!this.product) return false;
    const productId = this.product.id || this.product.objectID || '';
    return this.wishlistService.isInWishlist(productId);
  });

  ngOnInit(): void {
    // console.log(this.product);
  }
  
  navigateToProduct(product: Product): void {
    this.router.navigate(['/product', product.slug, product.objectID ?? product.id]);
  }

  /**
   * Agrega o remueve el producto del wishlist
   */
  async toggleFavorite(event: Event): Promise<void> {
    event.stopPropagation(); // Prevenir navegación al producto
    
    if (this.isAddingToWishlist()) return; // Prevenir clicks múltiples

    this.isAddingToWishlist.set(true);

    try {
      const productId = this.product.id || this.product.objectID || '';
      const isInWishlist = this.wishlistService.isInWishlist(productId);

      if (isInWishlist) {
        // Si ya está en wishlist, remover
        const result = await this.wishlistService.removeFromWishlist(productId);
        this.showToast(result.message, result.success ? 'info' : 'error');
      } else {
        // Si no está, agregar (sin variante desde product-item)
        const result = await this.wishlistService.addToWishlist(this.product);
        this.showToast(result.message, result.success ? 'success' : 'error');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      this.showToast('Error al actualizar la lista de deseos', 'error');
    } finally {
      this.isAddingToWishlist.set(false);
    }
  }

  /**
   * Agrega el producto al carrito (solo si no tiene variantes)
   */
  async addToCart(event: Event): Promise<void> {
    event.stopPropagation(); // Prevenir navegación al producto
    
    if (this.isAddingToCart()) return; // Prevenir clicks múltiples
    
    // Si el producto tiene variantes, navegar a la página del producto
    if (this.product.variants && this.product.variants.length > 0) {
      this.navigateToProduct(this.product);
      return;
    }

    this.isAddingToCart.set(true);

    try {
      await this.cartService.addToCart(this.product, undefined, 1);
      this.showToast('Producto agregado al carrito', 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showToast('Error al agregar al carrito', 'error');
    } finally {
      this.isAddingToCart.set(false);
    }
  }

  /**
   * Muestra un toast/notificación (puedes personalizarlo con una librería de toast)
   */
  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    // Por ahora usar alert, luego puedes integrar una librería de toast
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Opcional: Crear un toast visual temporal
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed bottom-4 right-4 max-w-md shadow-lg z-50 animate-fade-in`;
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  getMinPrice(variants: ProductVariant[]): number {
    if (!variants || variants.length === 0) return 0;
    // Analiza todas las variantes y devuelve el precio mayor
    return Math.min(...variants.map(v => v.price ?? 0));
  }
}
