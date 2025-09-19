import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from '@angular/fire/firestore';
import { Auth, User } from '@angular/fire/auth';
import { authState } from '@angular/fire/auth';
import { ShoppingCart as IShoppingCart, CartItem, AddToCartRequest, CartSummary } from '../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../interfaces/products';

@Injectable({
  providedIn: 'root'
})
export class ShoppingCartService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  // Signals para el estado del carrito
  private readonly _cart = signal<IShoppingCart | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Signal para el usuario actual
  private readonly authState$ = authState(this.auth);
  private readonly _currentUser = signal<User | null>(null);

  // Computed signals
  readonly cart = this._cart.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();

  // Computed para el resumen del carrito
  readonly cartSummary = computed<CartSummary>(() => {
    const currentCart = this._cart();
    if (!currentCart || !currentCart.items.length) {
      return {
        itemCount: 0,
        uniqueItemCount: 0,
        subtotal: 0,
        total: 0
      };
    }

    return {
      itemCount: currentCart.items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItemCount: currentCart.items.length,
      subtotal: currentCart.subtotal,
      total: currentCart.total
    };
  });

  constructor() {
    // Escuchar cambios en el estado de autenticación
    this.authState$.subscribe(user => {
      this._currentUser.set(user);
      this.loadCart(); // Cargar carrito cuando cambie el usuario
    });

    // Cargar carrito inicial
    this.loadCart();
  }

  /**
   * Determina si el usuario está autenticado
   */
  private isUserAuthenticated(): boolean {
    return !!this._currentUser();
  }

  /**
   * Obtiene la clave para el localStorage (usuarios no autenticados)
   */
  private getLocalStorageKey(): string {
    return 'verona_shopping_cart';
  }

  /**
   * Genera un ID único para items del carrito
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Carga el carrito desde Firestore (usuario autenticado) o localStorage (invitado)
   */
  private async loadCart(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      if (this.isUserAuthenticated()) {
        await this.loadUserCart();
      } else {
        this.loadLocalCart();
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      this._error.set('Error al cargar el carrito');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Carga el carrito del usuario desde Firestore
   */
  private async loadUserCart(): Promise<void> {
    const userId = this._currentUser()?.uid;
    if (!userId) return;

    const cartRef = doc(this.firestore, 'shopping_carts', userId);
    const cartSnap = await getDoc(cartRef);

    if (cartSnap.exists()) {
      this._cart.set(cartSnap.data() as IShoppingCart);
    } else {
      // Crear carrito vacío para el usuario
      const emptyCart = this.createEmptyCart(userId);
      await setDoc(cartRef, emptyCart);
      this._cart.set(emptyCart);
    }
  }

  /**
   * Carga el carrito local desde localStorage
   */
  private loadLocalCart(): void {
    const localCart = localStorage.getItem(this.getLocalStorageKey());
    if (localCart) {
      this._cart.set(JSON.parse(localCart));
    } else {
      // Crear carrito vacío local
      const emptyCart = this.createEmptyCart();
      this.saveLocalCart(emptyCart);
      this._cart.set(emptyCart);
    }
  }

  /**
   * Guarda el carrito en localStorage
   */
  private saveLocalCart(cart: IShoppingCart): void {
    localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(cart));
  }

  /**
   * Crea un carrito vacío
   */
  private createEmptyCart(userId?: string): IShoppingCart {
    const now = serverTimestamp() as any;
    return {
      userId: userId || undefined,
      sessionId: userId ? undefined : this.generateSessionId(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      shippingCost: 0,
      discountAmount: 0,
      total: 0,
      appliedCoupons: [],
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };
  }

  /**
   * Genera un ID de sesión para usuarios invitados
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calcula los totales del carrito
   */
  private calculateTotals(cart: IShoppingCart): IShoppingCart {
    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.18; // IGV 18% para Perú
    const shippingCost = subtotal > 300 ? 0 : 25; // Envío gratis sobre S/300
    const discountAmount = cart.appliedCoupons.reduce((sum, coupon) => sum + coupon.appliedAmount, 0);
    const total = subtotal + taxAmount + shippingCost - discountAmount;

    return {
      ...cart,
      subtotal,
      taxAmount,
      shippingCost,
      discountAmount,
      total
    };
  }

  /**
   * Guarda el carrito (Firestore para usuarios autenticados, localStorage para invitados)
   */
  private async saveCart(cart: IShoppingCart): Promise<void> {
    const calculatedCart = this.calculateTotals(cart);
    calculatedCart.updatedAt = serverTimestamp() as any;

    if (this.isUserAuthenticated()) {
      const userId = this._currentUser()?.uid;
      if (userId) {
        const cartRef = doc(this.firestore, 'shopping_carts', userId);
        await updateDoc(cartRef, calculatedCart as any);
      }
    } else {
      this.saveLocalCart(calculatedCart);
    }

    this._cart.set(calculatedCart);
  }

  /**
   * Añade un producto al carrito
   */
  async addToCart(product: Product, variant?: ProductVariant, quantity: number = 1): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const currentCart = this._cart();
      if (!currentCart) throw new Error('Carrito no disponible');

      // Determinar precio y stock
      const unitPrice = variant?.price || product.price;
      const availableStock = variant?.stock || parseInt(product.stock);

      // Validar stock disponible
      if (availableStock < quantity) {
        throw new Error(`Stock insuficiente. Disponible: ${availableStock}`);
      }

      // Verificar si el item ya existe en el carrito
      const existingItemIndex = currentCart.items.findIndex(item => 
        item.productId === (product.id || product.objectID) && 
        item.variantId === variant?.id
      );

      let updatedCart: IShoppingCart;

      if (existingItemIndex >= 0) {
        // Actualizar cantidad del item existente
        const existingItem = currentCart.items[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;

        // Validar stock total
        if (availableStock < newQuantity) {
          throw new Error(`Stock insuficiente. Disponible: ${availableStock}, en carrito: ${existingItem.quantity}`);
        }

        const updatedItem: CartItem = {
          ...existingItem,
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity,
          updatedAt: serverTimestamp() as any
        };

        updatedCart = {
          ...currentCart,
          items: currentCart.items.map((item, index) => 
            index === existingItemIndex ? updatedItem : item
          )
        };
      } else {
        // Crear nuevo item
        const newItem: CartItem = {
          id: this.generateItemId(),
          productId: product.id || product.objectID || '',
          variantId: variant?.id,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          productName: product.name,
          productSku: product.sku,
          productSlug: product.slug,
          productImage: product.photos[0]?.small?.url || '',
          variantName: variant?.name,
          variantSku: variant?.sku,
          variantColorHex: variant?.colorHex,
          addedAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any
        };

        updatedCart = {
          ...currentCart,
          items: [...currentCart.items, newItem]
        };
      }

      await this.saveCart(updatedCart);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      this._error.set(error instanceof Error ? error.message : 'Error al agregar al carrito');
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Remueve un item del carrito
   */
  async removeFromCart(itemId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const currentCart = this._cart();
      if (!currentCart) throw new Error('Carrito no disponible');

      const updatedCart: IShoppingCart = {
        ...currentCart,
        items: currentCart.items.filter(item => item.id !== itemId)
      };

      await this.saveCart(updatedCart);
      
    } catch (error) {
      console.error('Error removing from cart:', error);
      this._error.set('Error al remover del carrito');
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Actualiza la cantidad de un item
   */
  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) {
      await this.removeFromCart(itemId);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const currentCart = this._cart();
      if (!currentCart) throw new Error('Carrito no disponible');

      const itemIndex = currentCart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) throw new Error('Item no encontrado');

      const item = currentCart.items[itemIndex];
      const updatedItem: CartItem = {
        ...item,
        quantity,
        totalPrice: item.unitPrice * quantity,
        updatedAt: serverTimestamp() as any
      };

      const updatedCart: IShoppingCart = {
        ...currentCart,
        items: currentCart.items.map((cartItem, index) => 
          index === itemIndex ? updatedItem : cartItem
        )
      };

      await this.saveCart(updatedCart);
      
    } catch (error) {
      console.error('Error updating quantity:', error);
      this._error.set('Error al actualizar cantidad');
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Limpia el carrito
   */
  async clearCart(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const currentCart = this._cart();
      if (!currentCart) throw new Error('Carrito no disponible');

      const emptyCart: IShoppingCart = {
        ...currentCart,
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: currentCart.shippingCost
      };

      await this.saveCart(emptyCart);
      
    } catch (error) {
      console.error('Error clearing cart:', error);
      this._error.set('Error al limpiar carrito');
      throw error;
    } finally {
      this._loading.set(false);
    }
  }
}
