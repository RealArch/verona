import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';
import { ProductsService } from '../../../services/products/products.service';
import { SiteConfig } from '../../../services/site-config/site-config';
import { CartItem } from '../../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../../interfaces/products';

type EnrichedCartItem = CartItem & { 
  product?: Product; 
  variant?: ProductVariant; 
  availableStock: number;
  isStockLoaded?: boolean;
};

type QuantityInput = { visible: boolean; value: number; saving: boolean };

@Component({
  selector: 'app-shopping-cart',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './shopping-cart.html',
  styleUrl: './shopping-cart.scss'
})
export class ShoppingCart implements OnInit {
  private readonly cartService = inject(ShoppingCartService);
  private readonly productsService = inject(ProductsService);
  private readonly siteConfig = inject(SiteConfig);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // State
  readonly selectedItems = signal<Set<string>>(new Set());
  readonly enrichedItems = signal<EnrichedCartItem[]>([]);
  readonly updating = signal<boolean>(false);
  readonly itemUpdating = signal<Set<string>>(new Set());
  readonly initializing = signal<boolean>(true);

  // Service signals
  readonly cart = this.cartService.cart;
  readonly loading = this.cartService.loading;
  readonly taxRate = computed(() => (this.siteConfig.storeSettings()?.taxPercentage ?? 18) / 100);
  
  // Computed
  readonly selectedCartItems = computed(() => 
    this.enrichedItems().filter(item => this.selectedItems().has(item.id))
  );

  readonly totals = computed(() => {
    const items = this.selectedCartItems();
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * this.taxRate();
    const total = subtotal + taxAmount;
    
    return { itemCount, subtotal, taxAmount, total };
  });

  readonly allSelected = computed(() => {
    const items = this.enrichedItems();
    const availableItems = items.filter(item => item.available !== false);
    return availableItems.length > 0 && availableItems.every(item => this.selectedItems().has(item.id));
  });

  constructor() {
    this.setupSEO();

    effect(() => {
      const currentCart = this.cart();
      const isLoading = this.cartService.loading();
      
      // Mark as initialized once we have cart data or loading is complete
      if (currentCart !== null || !isLoading) {
        this.initializing.set(false);
      }
      
      if (currentCart) {
        this.initializeCart(currentCart.items);
      } else {
        this.enrichedItems.set([]);
        this.selectedItems.set(new Set());
      }
    });
  }

  ngOnInit(): void {}

  private setupSEO(): void {
    this.titleService.setTitle('Carrito de Compras | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Revisa tu carrito de compras en Verona.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  private initializeCart(cartItems: CartItem[]): void {
    if (!cartItems.length) {
      this.enrichedItems.set([]);
      this.selectedItems.set(new Set());
      return;
    }

    // Show basic items immediately with generous stock limit until real data loads
    // Allow up to 50 units initially until real stock is known
    const basicItems: EnrichedCartItem[] = cartItems.map(item => ({
      ...item,
      availableStock: Math.max(item.quantity, 50), // Allow at least 50 until real stock is known
      isStockLoaded: false
    }));
    
    this.enrichedItems.set(basicItems);
    this.selectedItems.set(new Set()); // Start with nothing selected, but will select all after enrichment

    // Enrich in background
    this.enrichCartItems(cartItems).catch(console.error);
  }

  private async enrichCartItems(cartItems: CartItem[]): Promise<void> {
    const enriched: EnrichedCartItem[] = [];
    const updates: Array<{ itemId: string; quantity: number }> = [];

    for (const item of cartItems) {
      try {
        const product = await this.fetchProduct(item.productId);
        
        if (!product || product.status !== 'active') {
          enriched.push({ ...item, product: product ?? undefined, availableStock: 0, isStockLoaded: true });
          continue;
        }

        const { variant, stock, price } = this.getProductDetails(product, item.variantId);
        const adjustedQty = Math.min(item.quantity, stock);

        if (adjustedQty !== item.quantity || Math.abs(price - item.unitPrice) > 0.01) {
          updates.push({ itemId: item.id, quantity: adjustedQty });
        }

        enriched.push({
          ...item,
          product,
          variant,
          availableStock: stock,
          quantity: adjustedQty,
          unitPrice: price,
          totalPrice: price * adjustedQty,
          isStockLoaded: true
        });
      } catch (error) {
        console.error(`Error enriching item ${item.id}:`, error);
        enriched.push({ ...item, availableStock: item.quantity, isStockLoaded: true });
      }
    }

    // Apply updates if needed
    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ itemId, quantity }) => 
          this.cartService.updateQuantity(itemId, quantity)
        )
      );
    }

    this.enrichedItems.set(enriched);
    this.selectAll();
  }

  private async fetchProduct(productId: string): Promise<Product | null> {
    try {
      const product$ = await this.productsService.getProduct(productId);
      return await firstValueFrom(product$, { defaultValue: null });
    } catch {
      return null;
    }
  }

  private getProductDetails(product: Product, variantId?: string) {
    if (variantId) {
      const variant = product.variants?.find(v => v.id === variantId);
      return {
        variant,
        stock: variant?.stock ?? 0,
        price: variant?.price ?? product.price
      };
    }
    
    return {
      variant: undefined,
      stock: parseInt(product.stock) || 0,
      price: product.price
    };
  }

  // Quantity input management
  async increaseQuantity(itemId: string): Promise<void> {
    const item = this.enrichedItems().find(i => i.id === itemId);
    if (!item || item.quantity >= item.availableStock) return;
    
    await this.updateQuantity(itemId, item.quantity + 1);
  }

  async decreaseQuantity(itemId: string): Promise<void> {
    const item = this.enrichedItems().find(i => i.id === itemId);
    if (!item || item.quantity <= 1) return;
    
    await this.updateQuantity(itemId, item.quantity - 1);
  }

  async onQuantityInputChange(itemId: string, value: string): Promise<void> {
    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity < 1) return;
    
    await this.updateQuantity(itemId, quantity);
  }

  // Selection
  selectAll(): void {
    const availableItems = this.enrichedItems().filter(item => item.available !== false);
    this.selectedItems.set(new Set(availableItems.map(item => item.id)));
  }

  toggleSelectAll(): void {
    const availableItems = this.enrichedItems().filter(item => item.available !== false);
    const availableItemIds = availableItems.map(item => item.id);
    const selectedAvailableCount = availableItemIds.filter(id => this.selectedItems().has(id)).length;
    
    this.selectedItems.update(currentSelected => {
      if (selectedAvailableCount === availableItemIds.length) {
        // Deseleccionar todos los disponibles, pero mantener los no disponibles fuera
        const newSelected = new Set(currentSelected);
        availableItemIds.forEach(id => newSelected.delete(id));
        return newSelected;
      } else {
        // Seleccionar todos los disponibles
        return new Set(availableItemIds);
      }
    });
  }

  toggleItem(itemId: string): void {
    const item = this.enrichedItems().find(i => i.id === itemId);
    // No permitir seleccionar items no disponibles
    if (item?.available === false) return;
    
    this.selectedItems.update(selected => {
      const newSelected = new Set(selected);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  }



  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;

    const item = this.enrichedItems().find(i => i.id === itemId);
    if (!item) return;

    const finalQty = Math.min(quantity, item.availableStock);
    
    const updating = new Set(this.itemUpdating());
    updating.add(itemId);
    this.itemUpdating.set(updating);

    try {
      // Optimistic update
      this.updateItemLocally(itemId, finalQty);
      
      await this.cartService.updateQuantity(itemId, finalQty);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const currentCart = this.cart();
      if (currentCart) {
        await this.enrichCartItems(currentCart.items);
      }

    } catch (error) {
      console.error('Update failed:', error);
      const currentCart = this.cart();
      if (currentCart) {
        await this.enrichCartItems(currentCart.items);
      }
    } finally {
      updating.delete(itemId);
      this.itemUpdating.set(new Set(updating));
    }
  }

  private updateItemLocally(itemId: string, quantity: number): void {
    const items = this.enrichedItems().map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity,
          totalPrice: item.unitPrice * quantity
        };
      }
      return item;
    });
    
    this.enrichedItems.set(items);
  }

  isItemUpdating(itemId: string): boolean {
    return this.itemUpdating().has(itemId);
  }

  // Remove items
  async removeItem(itemId: string): Promise<void> {
    this.updating.set(true);
    try {
      await this.cartService.removeFromCart(itemId);
      
      const selected = new Set(this.selectedItems());
      selected.delete(itemId);
      this.selectedItems.set(selected);
    } catch (error) {
      console.error('Remove failed:', error);
    } finally {
      this.updating.set(false);
    }
  }

  async clearSelected(): Promise<void> {
    const ids = Array.from(this.selectedItems());
    if (!ids.length) return;

    this.updating.set(true);
    try {
      // Eliminar todos los items seleccionados en una sola operación
      await this.cartService.removeMultipleFromCart(ids);
      this.selectedItems.set(new Set());
    } catch (error) {
      console.error('Clear failed:', error);
    } finally {
      this.updating.set(false);
    }
  }

  // Navigation
  navigateToProduct(item: CartItem): void {
    this.router.navigate(['/product', item.productSlug, item.productId]);
  }

  proceedToCheckout(): void {
    const selected = this.selectedCartItems();
    if (!selected.length) return;
    
    this.router.navigate(['/checkout'], { 
      state: { 
        selectedItems: selected.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          productImage: item.productImage,
          variantId: item.variantId,
          variantName: item.variantName,
          variantColorHex: item.variantColorHex,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          currentProduct: item.product,
          currentVariant: item.variant
        }))
      } 
    });
  }
}
