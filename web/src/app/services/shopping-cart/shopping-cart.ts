import { Injectable, inject, signal, computed, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from '@angular/fire/firestore';
import { Auth, User } from '@angular/fire/auth';
import { authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { ShoppingCart as IShoppingCart, CartItem, AddToCartRequest, CartSummary } from '../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../interfaces/products';
import { ProductsService } from '../products/products.service';

@Injectable({
  providedIn: 'root'
})
export class ShoppingCartService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector);
  private readonly productsService = inject(ProductsService);

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
      // Cargar carrito cuando cambie el usuario, pero dentro del contexto de Angular
      runInInjectionContext(this.injector, () => {
        this.loadCart();
      });
    });
  }

  /**
   * Determina si el usuario está autenticado
   */
  private isUserAuthenticated(): boolean {
    return !!this._currentUser();
  }

  /**
   * Verifica si estamos ejecutando en el navegador (no en SSR)
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
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
        // Para usuarios no autenticados, solo cargar desde localStorage
        // No intentar leer de Firestore
        this.loadLocalCart();
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      // No mostrar error si es solo un problema de permisos
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        if (firebaseError.code === 'permission-denied') {
          console.log('Permission denied - user not authenticated, loading local cart');
          this.loadLocalCart();
        } else {
          this._error.set('Error al cargar el carrito');
        }
      } else {
        this._error.set('Error al cargar el carrito');
      }
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
      const cart = cartSnap.data() as IShoppingCart;
      // Verificar disponibilidad de items
      const validatedCart = await this.validateCartItems(cart);
      this._cart.set(validatedCart);
    } else {
      // Crear carrito vacío para el usuario
      const emptyCart = this.createEmptyCart(userId);
      
      // Preparar datos para Firestore, eliminando campos undefined recursivamente
      const firestoreData = this.sanitizeForFirestore(emptyCart);
      
      await setDoc(cartRef, firestoreData);
      this._cart.set(emptyCart);
    }
  }

  /**
   * Carga el carrito local desde localStorage
   */
  private loadLocalCart(): void {
    if (!this.isBrowser()) {
      // En SSR, crear carrito vacío temporal sin persistir
      const emptyCart = this.createEmptyCart();
      this._cart.set(emptyCart);
      return;
    }

    const localCart = localStorage.getItem(this.getLocalStorageKey());
    if (localCart) {
      try {
        const cart = JSON.parse(localCart) as IShoppingCart;
        // Verificar disponibilidad de items de forma asíncrona
        this.validateCartItems(cart).then((validatedCart: IShoppingCart) => {
          this._cart.set(validatedCart);
        });
      } catch (error) {
        console.error('Error parsing local cart:', error);
        // Si hay error, crear carrito vacío
        const emptyCart = this.createEmptyCart();
        this.saveLocalCart(emptyCart);
        this._cart.set(emptyCart);
      }
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
    if (!this.isBrowser()) return; // Evita error en SSR
    
    try {
      localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  /**
   * Valida la disponibilidad de todos los items del carrito
   */
  private async validateCartItems(cart: IShoppingCart): Promise<IShoppingCart> {
    if (!cart.items || cart.items.length === 0) {
      return cart;
    }

    const validatedItems = await Promise.all(
      cart.items.map(async (item) => {
        try {
          // Obtener el producto desde Firestore
          const productObservable = await this.productsService.getProduct(item.productId);
          const product = await firstValueFrom(productObservable);

          if (!product || product.status !== 'active') {
            // Producto no existe o no está activo
            return { ...item, available: false };
          }

          // Si hay variante, verificar que exista y tenga stock
          if (item.variantId) {
            const variant = product.variants?.find(v => v.id === item.variantId);
            if (!variant || variant.stock < 1) {
              return { ...item, available: false };
            }
            return { ...item, available: true };
          }

          // Si no hay variante, verificar stock del producto
          const productStock = parseInt(product.stock);
          if (productStock < 1) {
            return { ...item, available: false };
          }

          return { ...item, available: true };
        } catch (error) {
          console.error(`Error validating item ${item.id}:`, error);
          // En caso de error, marcar como no disponible por seguridad
          return { ...item, available: false };
        }
      })
    );

    return {
      ...cart,
      items: validatedItems
    };
  }

  /**
   * Crea un carrito vacío
   */
  private createEmptyCart(userId?: string): IShoppingCart {
    const now = serverTimestamp() as any;
    const cart: IShoppingCart = {
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

    // Solo agregar los campos que tienen valor válido
    if (userId) {
      cart.userId = userId;
    } else {
      cart.sessionId = this.generateSessionId();
    }

    return cart;
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
        
        // Preparar datos para Firestore, eliminando campos undefined recursivamente
        const firestoreData = this.sanitizeForFirestore(calculatedCart);
        
        await updateDoc(cartRef, firestoreData);
      }
    } else {
      this.saveLocalCart(calculatedCart);
    }

    this._cart.set(calculatedCart);
  }

  /**
   * Sanitiza un objeto eliminando campos undefined recursivamente
   */
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          sanitized[key] = this.sanitizeForFirestore(value);
        }
      });
      return sanitized;
    }

    return obj;
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
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          productName: product.name,
          productSku: product.sku,
          productSlug: product.slug,
          productImage: product.photos[0]?.small?.url || '',
          addedAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any
        };

        // Solo agregar campos de variant si existen
        if (variant?.id) {
          newItem.variantId = variant.id;
        }
        if (variant?.name) {
          newItem.variantName = variant.name;
        }
        if (variant?.sku) {
          newItem.variantSku = variant.sku;
        }
        if (variant?.colorHex) {
          newItem.variantColorHex = variant.colorHex;
        }

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
