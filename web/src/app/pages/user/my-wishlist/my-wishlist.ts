import { Component, inject, signal, computed, effect } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Wishlist, WishlistItem } from '../../../services/wishlist';
import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';
import { Auth } from '../../../services/auth/auth.services';

@Component({
  selector: 'app-my-wishlist',
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './my-wishlist.html',
  styleUrl: './my-wishlist.scss'
})
export class MyWishlist {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly wishlistService = inject(Wishlist);
  private readonly cartService = inject(ShoppingCartService);
  private readonly router = inject(Router);
  private readonly authService = inject(Auth);

  // Signals
  wishlistItems = this.wishlistService.wishlistItems;
  loading = this.wishlistService.loading;
  removingItem = signal<string | null>(null);
  movingToCart = signal<string | null>(null);
  showClearConfirmModal = signal<boolean>(false);

  // Computed
  totalItems = computed(() => this.wishlistItems().length);
  totalValue = computed(() => {
    return this.wishlistItems().reduce((sum, item) => {
      const price = item.variantPrice || item.productPrice;
      return sum + price;
    }, 0);
  });

  constructor() {
    this.setupSEO();
    
    // Verificar autenticación solo después de que esté inicializada
    effect(() => {
      const initialized = this.authService.authInitialized();
      const user = this.authService.user();
      
      // Solo verificar cuando Firebase esté inicializado
      if (initialized && !user) {
        // Si no hay usuario, redirigir al login
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: '/user/wishlist' }
        });
      }
    });
  }

  private setupSEO(): void {
    this.titleService.setTitle('Mi Lista de Deseos | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Consulta tus productos favoritos en Verona.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  /**
   * Navega a la página del producto
   */
  navigateToProduct(item: WishlistItem): void {
    this.router.navigate(['/product', item.productSlug, item.productId]);
  }

  /**
   * Remueve un item del wishlist
   */
  async removeItem(item: WishlistItem): Promise<void> {
    if (this.removingItem()) return;

    this.removingItem.set(item.productId);

    try {
      const result = await this.wishlistService.removeFromWishlist(item.productId, item.variantId);
      this.showToast(result.message, result.success ? 'info' : 'error');
    } catch (error) {
      console.error('Error removiendo item:', error);
      this.showToast('Error al remover el producto', 'error');
    } finally {
      this.removingItem.set(null);
    }
  }

  /**
   * Mueve un item del wishlist al carrito
   */
  async moveToCart(item: WishlistItem): Promise<void> {
    if (this.movingToCart()) return;

    this.movingToCart.set(item.productId);

    try {
      // Necesitamos crear un objeto Product mínimo para agregar al carrito
      const product = {
        id: item.productId,
        objectID: item.productId,
        name: item.productName,
        slug: item.productSlug,
        price: item.productPrice,
        photos: [
          {
            small: { url: item.productImage },
            medium: { url: item.productImage },
            large: { url: item.productImage },
            thumbnail: { url: item.productImage }
          }
        ],
        variants: [],
        stock: '99'
      } as any;

      // Si tiene variante, crear el objeto de variante
      const variant = item.variantId ? {
        id: item.variantId,
        name: item.variantName || '',
        price: item.variantPrice || item.productPrice,
        stock: 99
      } as any : undefined;

      // Agregar al carrito
      await this.cartService.addToCart(product, variant, 1);
      
      // Remover del wishlist
      await this.wishlistService.removeFromWishlist(item.productId, item.variantId);
      
      this.showToast('Producto movido al carrito', 'success');
    } catch (error) {
      console.error('Error moviendo al carrito:', error);
      this.showToast('Error al mover el producto al carrito', 'error');
    } finally {
      this.movingToCart.set(null);
    }
  }

  /**
   * Abre el modal de confirmación para vaciar la lista
   */
  openClearConfirmModal(): void {
    this.showClearConfirmModal.set(true);
  }

  /**
   * Cierra el modal de confirmación
   */
  closeClearConfirmModal(): void {
    this.showClearConfirmModal.set(false);
  }

  /**
   * Limpia toda la wishlist
   */
  async confirmClearWishlist(): Promise<void> {
    this.closeClearConfirmModal();

    try {
      const result = await this.wishlistService.clearAllWishlist();
      this.showToast(result.message, result.success ? 'info' : 'error');
    } catch (error) {
      console.error('Error limpiando wishlist:', error);
      this.showToast('Error al limpiar la lista de deseos', 'error');
    }
  }

  /**
   * Muestra un toast
   */
  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed bottom-4 right-4 max-w-md shadow-lg z-50 animate-fade-in`;
    
    const icon = type === 'success' 
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
      : type === 'error'
      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'
      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
    
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
}
