import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from '@angular/fire/firestore';
import { Auth } from './auth/auth.services';
import { Product, ProductVariant } from '../interfaces/products';
import { Router } from '@angular/router';

export interface WishlistItem {
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  productImage: string;
  variantId?: string;
  variantName?: string;
  variantPrice?: number;
  addedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class Wishlist {
  private firestore = inject(Firestore);
  private authService = inject(Auth);
  private router = inject(Router);

  // Signal que mantiene los items del wishlist
  private wishlistItemsSignal = signal<WishlistItem[]>([]);
  
  // Signal para estado de carga
  private loadingSignal = signal<boolean>(false);

  // Listener de Firestore para el wishlist
  private unsubscribeWishlist?: () => void;

  // Getters públicos
  public wishlistItems = this.wishlistItemsSignal.asReadonly();
  public loading = this.loadingSignal.asReadonly();

  // Computed signal para el conteo de items
  public wishlistCount = computed(() => this.wishlistItemsSignal().length);

  constructor() {
    // Escuchar cambios en el usuario autenticado usando effect
    const currentUser = this.authService.user();
    if (currentUser) {
      this.listenToWishlist(currentUser.uid);
    }
  }

  /**
   * Escucha cambios en tiempo real del wishlist del usuario
   */
  private listenToWishlist(uid: string): void {
    // Detener listener anterior si existe
    if (this.unsubscribeWishlist) {
      this.unsubscribeWishlist();
    }

    const wishlistDocRef = doc(this.firestore, 'wishlists', uid);

    this.unsubscribeWishlist = onSnapshot(wishlistDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const items = data['items'] || [];
        
        // Convertir Timestamps de Firestore a Date
        const normalizedItems = items.map((item: any) => ({
          ...item,
          addedAt: item.addedAt?.toDate ? item.addedAt.toDate() : item.addedAt
        }));
        
        this.wishlistItemsSignal.set(normalizedItems);
      } else {
        this.wishlistItemsSignal.set([]);
      }
    }, (error) => {
      console.error('Error listening to wishlist:', error);
      this.wishlistItemsSignal.set([]);
    });
  }

  /**
   * Limpia el wishlist local
   */
  private clearWishlist(): void {
    this.wishlistItemsSignal.set([]);
    if (this.unsubscribeWishlist) {
      this.unsubscribeWishlist();
      this.unsubscribeWishlist = undefined;
    }
  }

  /**
   * Agrega un producto al wishlist
   */
  async addToWishlist(product: Product, variant?: ProductVariant): Promise<{ success: boolean; message: string }> {
    const user = this.authService.user();
    
    // Verificar si el usuario está autenticado
    if (!user) {
      // Guardar la URL actual para redirigir después del login
      this.authService.setReturnUrl(this.router.url);
      this.router.navigate(['/auth/login']);
      return { success: false, message: 'Debes iniciar sesión para agregar productos a tu lista de deseos' };
    }

    try {
      this.loadingSignal.set(true);

      const productId = product.id || product.objectID || '';
      const variantId = variant?.id;

      // Verificar si ya existe en el wishlist
      const existingItem = this.wishlistItemsSignal().find(item => 
        item.productId === productId && 
        (variantId ? item.variantId === variantId : !item.variantId)
      );

      if (existingItem) {
        return { success: false, message: 'Este producto ya está en tu lista de deseos' };
      }

      // Verificar si existe el producto sin variante pero ahora se está agregando con variante
      const existingProductWithoutVariant = this.wishlistItemsSignal().find(item => 
        item.productId === productId && !item.variantId
      );

      const existingProductWithDifferentVariant = this.wishlistItemsSignal().find(item => 
        item.productId === productId && item.variantId && item.variantId !== variantId
      );

      // Crear el nuevo item
      const newItem: WishlistItem = {
        productId,
        productName: product.name,
        productSlug: product.slug,
        productPrice: product.price,
        productImage: product.photos && product.photos.length > 0 ? product.photos[0].small.url : '',
        addedAt: new Date()
      };

      // Agregar información de variante si existe
      if (variant) {
        newItem.variantId = variant.id;
        newItem.variantName = variant.name;
        newItem.variantPrice = variant.price;
      }

      const wishlistDocRef = doc(this.firestore, 'wishlists', user.uid);

      // Si existe el producto sin variante y ahora se está agregando con variante, actualizar
      if (existingProductWithoutVariant && variantId) {
        // Remover el item sin variante
        await updateDoc(wishlistDocRef, {
          items: arrayRemove(existingProductWithoutVariant)
        });
        
        // Agregar el nuevo item con variante
        await updateDoc(wishlistDocRef, {
          items: arrayUnion(newItem),
          updatedAt: new Date()
        });

        return { success: true, message: 'Lista de deseos actualizada con la variante seleccionada' };
      }

      // Si existe con otra variante, informar al usuario
      if (existingProductWithDifferentVariant) {
        // Agregar el nuevo item con la nueva variante
        await updateDoc(wishlistDocRef, {
          items: arrayUnion(newItem),
          updatedAt: new Date()
        });

        return { success: true, message: 'Variante agregada a tu lista de deseos' };
      }

      // El documento debe existir (creado por el backend al registrar el usuario)
      // Si no existe, intentar agregarlo igual (updateDoc fallará y se capturará en el catch)
      await updateDoc(wishlistDocRef, {
        items: arrayUnion(newItem),
        updatedAt: new Date()
      });

      return { success: true, message: 'Producto agregado a tu lista de deseos' };

    } catch (error) {
      console.error('Error agregando a wishlist:', error);
      
      // Si el error es porque el documento no existe (race condition), informar al usuario
      if (error instanceof Error && error.message.includes('No document to update')) {
        return { success: false, message: 'Tu lista de deseos aún no está disponible. Intenta de nuevo en unos segundos.' };
      }
      
      return { success: false, message: 'Error al agregar el producto a tu lista de deseos' };
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Remueve un producto del wishlist
   */
  async removeFromWishlist(productId: string, variantId?: string): Promise<{ success: boolean; message: string }> {
    const user = this.authService.user();
    
    if (!user) {
      return { success: false, message: 'Debes iniciar sesión' };
    }

    try {
      this.loadingSignal.set(true);

      const itemToRemove = this.wishlistItemsSignal().find(item => 
        item.productId === productId && 
        (variantId ? item.variantId === variantId : !item.variantId)
      );

      if (!itemToRemove) {
        return { success: false, message: 'Producto no encontrado en tu lista de deseos' };
      }

      const wishlistDocRef = doc(this.firestore, 'wishlists', user.uid);
      
      await updateDoc(wishlistDocRef, {
        items: arrayRemove(itemToRemove),
        updatedAt: new Date()
      });

      return { success: true, message: 'Producto removido de tu lista de deseos' };

    } catch (error) {
      console.error('Error removiendo de wishlist:', error);
      return { success: false, message: 'Error al remover el producto' };
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Verifica si un producto está en el wishlist
   */
  isInWishlist(productId: string, variantId?: string): boolean {
    return this.wishlistItemsSignal().some(item => 
      item.productId === productId && 
      (variantId ? item.variantId === variantId : !item.variantId)
    );
  }

  /**
   * Limpia todo el wishlist del usuario
   */
  async clearAllWishlist(): Promise<{ success: boolean; message: string }> {
    const user = this.authService.user();
    
    if (!user) {
      return { success: false, message: 'Debes iniciar sesión' };
    }

    try {
      this.loadingSignal.set(true);

      const wishlistDocRef = doc(this.firestore, 'wishlists', user.uid);
      
      await updateDoc(wishlistDocRef, {
        items: [],
        updatedAt: new Date()
      });

      return { success: true, message: 'Lista de deseos limpiada' };

    } catch (error) {
      console.error('Error limpiando wishlist:', error);
      return { success: false, message: 'Error al limpiar la lista de deseos' };
    } finally {
      this.loadingSignal.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.unsubscribeWishlist) {
      this.unsubscribeWishlist();
    }
  }
}
