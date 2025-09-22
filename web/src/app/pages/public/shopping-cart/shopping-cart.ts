import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';
import { ProductsService } from '../../../services/products/products.service';
import { CartItem } from '../../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../../interfaces/products';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';

type EnrichedCartItem = CartItem & { 
  currentProduct?: Product; 
  currentVariant?: ProductVariant; 
  maxQuantity: number 
};

type CustomQuantityState = { visible: boolean; value: number; saving: boolean };

@Component({
  selector: 'app-shopping-cart',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './shopping-cart.html',
  styleUrl: './shopping-cart.scss'
})
export class ShoppingCart implements OnInit {
  private readonly cartService = inject(ShoppingCartService);
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);

  // Core state
  selectedItems = signal<Set<string>>(new Set());
  enrichedCartItems = signal<EnrichedCartItem[]>([]);
  customQuantityInputs = signal<Map<string, CustomQuantityState>>(new Map());
  
  // Loading states
  updating = signal<boolean>(false);
  itemUpdating = signal<Set<string>>(new Set());
  
  // UI model for quantity selects
  selectModel: Record<string, string> = {};

  // Computed signals
  cart = this.cartService.cart;
  loading = this.cartService.loading;
  
  selectedCartItems = computed(() => 
    this.enrichedCartItems().filter(item => this.selectedItems().has(item.id))
  );

  selectedTotals = computed(() => {
    const items = this.selectedCartItems();
    if (!items.length) return { subtotal: 0, total: 0, itemCount: 0, taxAmount: 0, shippingCost: 0 };
    
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * 0.18;
    const shippingCost = subtotal > 300 ? 0 : 25;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return { subtotal, taxAmount, shippingCost, total: subtotal + taxAmount + shippingCost, itemCount };
  });

  allItemsSelected = computed(() => {
    const items = this.enrichedCartItems();
    return items.length > 0 && items.every(item => this.selectedItems().has(item.id));
  });

  async ngOnInit(): Promise<void> {
    await this.waitForCartToLoad();
    await this.syncCartWithDatabase();
  }

  private async waitForCartToLoad(): Promise<void> {
    let attempts = 0;
    while (attempts < 20 && this.cartService.loading()) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

    async syncCartWithDatabase(): Promise<void> {
    const cart = this.cart();
    if (!cart?.items.length) {
      this.enrichedCartItems.set([]);
      return;
    }

    try {
      const enrichedItems: EnrichedCartItem[] = [];
      const itemsToRemove: string[] = [];
      const itemsToUpdate: Array<{ itemId: string; newQuantity: number; newPrice: number }> = [];
      
      for (const item of cart.items) {
        try {
          const product = await this.getProduct(item.productId);
          if (!product || product.status !== 'active') {
            itemsToRemove.push(item.id);
            continue;
          }

          const { variant, maxQuantity, price } = this.getItemDetails(product, item.variantId);
          
          if (maxQuantity === 0) {
            itemsToRemove.push(item.id);
            continue;
          }

          let finalQuantity = Math.min(item.quantity, maxQuantity);
          
          if (finalQuantity !== item.quantity || Math.abs(item.unitPrice - price) > 0.01) {
            itemsToUpdate.push({ itemId: item.id, newQuantity: finalQuantity, newPrice: price });
          }

          enrichedItems.push({
            ...item,
            currentProduct: product,
            currentVariant: variant,
            maxQuantity,
            quantity: finalQuantity,
            unitPrice: price,
            totalPrice: price * finalQuantity
          });

        } catch (error) {
          console.error(`Error syncing item ${item.id}:`, error);
          enrichedItems.push({ ...item, maxQuantity: item.quantity });
        }
      }

      // Apply changes
      await Promise.all([
        ...itemsToRemove.map(id => this.cartService.removeFromCart(id)),
        ...itemsToUpdate.map(update => this.cartService.updateQuantity(update.itemId, update.newQuantity))
      ]);

      this.enrichedCartItems.set(enrichedItems);
      this.updateSelectModel(enrichedItems);
      this.selectAllItems();

    } catch (error) {
      console.error('Error syncing cart:', error);
    }
  }

  private async getProduct(productId: string): Promise<Product | null> {
    const productObservable = await this.productsService.getProduct(productId);
    return new Promise((resolve, reject) => {
      const subscription = productObservable.subscribe({
        next: product => {
          subscription.unsubscribe();
          resolve(product);
        },
        error: error => {
          subscription.unsubscribe();
          reject(error);
        }
      });
    });
  }

  private getItemDetails(product: Product, variantId?: string) {
    if (variantId) {
      const variant = product.variants?.find(v => v.id === variantId);
      return {
        variant,
        maxQuantity: variant?.stock || 0,
        price: variant?.price || product.price
      };
    }
    return {
      variant: undefined,
      maxQuantity: parseInt(product.stock) || 0,
      price: product.price
    };
  }

  private updateSelectModel(items: EnrichedCartItem[]): void {
    this.selectModel = items.reduce((model, item) => {
      model[item.id] = item.quantity <= 10 ? String(item.quantity) : '10+';
      return model;
    }, {} as Record<string, string>);
  }

  selectAllItems(): void {
    this.selectedItems.set(new Set(this.enrichedCartItems().map(item => item.id)));
  }

  toggleSelectAll(): void {
    const items = this.enrichedCartItems();
    if (!items.length) return;
    
    this.selectedItems.set(this.allItemsSelected() ? new Set() : new Set(items.map(item => item.id)));
  }

  toggleItemSelection(itemId: string): void {
    const selected = new Set(this.selectedItems());
    selected.has(itemId) ? selected.delete(itemId) : selected.add(itemId);
    this.selectedItems.set(selected);
  }

  async onQuantitySelectChange(itemId: string, value: string): Promise<void> {
    if (value === '10+') {
      this.showCustomQuantityInput(itemId);
    } else {
      await this.updateQuantity(itemId, parseInt(value, 10));
    }
  }

  showCustomQuantityInput(itemId: string): void {
    const inputs = new Map(this.customQuantityInputs());
    const currentItem = this.enrichedCartItems().find(item => item.id === itemId);
    const currentQuantity = currentItem?.quantity || 1;
    
    inputs.set(itemId, {
      visible: true,
      value: currentQuantity > 10 ? currentQuantity : 11,
      saving: false
    });
    
    this.customQuantityInputs.set(inputs);
  }

  hideCustomQuantityInput(itemId: string): void {
    const inputs = new Map(this.customQuantityInputs());
    inputs.delete(itemId);
    this.customQuantityInputs.set(inputs);
  }

  updateCustomQuantityValue(itemId: string, value: number): void {
    const inputs = new Map(this.customQuantityInputs());
    const inputState = inputs.get(itemId);
    
    if (inputState) {
      inputState.value = value;
      inputs.set(itemId, inputState);
      this.customQuantityInputs.set(inputs);
    }
  }

  async saveCustomQuantity(itemId: string): Promise<void> {
    const inputs = new Map(this.customQuantityInputs());
    const inputState = inputs.get(itemId);
    
    if (!inputState) return;
    
    try {
      inputState.saving = true;
      this.customQuantityInputs.set(inputs);
      
      await this.updateQuantity(itemId, inputState.value);
      this.hideCustomQuantityInput(itemId);
      
    } catch (error) {
      console.error('Error saving custom quantity:', error);
      inputState.saving = false;
      this.customQuantityInputs.set(inputs);
    }
  }

  getQuantityOptions(itemId: string): Array<{ value: string; label: string }> {
    const item = this.enrichedCartItems().find(item => item.id === itemId);
    const maxQuantity = item?.maxQuantity || 10;
    const limit = Math.min(10, maxQuantity);
    
    const options = Array.from({ length: limit }, (_, i) => ({
      value: (i + 1).toString(),
      label: (i + 1).toString()
    }));
    
    if (maxQuantity > 10) {
      options.push({ value: '10+', label: '10+' });
    }
    
    return options;
  }

  async updateQuantity(itemId: string, newQuantity: number): Promise<void> {
    if (newQuantity < 1) return;
    
    const item = this.enrichedCartItems().find(item => item.id === itemId);
    if (item && newQuantity > item.maxQuantity) {
      newQuantity = item.maxQuantity;
    }
    
    try {
      const updating = new Set(this.itemUpdating());
      updating.add(itemId);
      this.itemUpdating.set(updating);
      
      // Update locally for immediate feedback
      this.updateLocalItem(itemId, newQuantity);
      
      await this.cartService.updateQuantity(itemId, newQuantity);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.syncCartWithDatabase();
      
    } catch (error) {
      console.error('Error updating quantity:', error);
      await this.syncCartWithDatabase();
    } finally {
      const updating = new Set(this.itemUpdating());
      updating.delete(itemId);
      this.itemUpdating.set(updating);
    }
  }

  private updateLocalItem(itemId: string, newQuantity: number): void {
    const items = this.enrichedCartItems().map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: item.unitPrice * newQuantity
        };
      }
      return item;
    });
    
    this.enrichedCartItems.set(items);
    this.selectModel[itemId] = newQuantity <= 10 ? String(newQuantity) : '10+';
  }

  isItemUpdating = (itemId: string): boolean => this.itemUpdating().has(itemId);

  async removeItem(itemId: string): Promise<void> {
    try {
      this.updating.set(true);
      await this.cartService.removeFromCart(itemId);
      
      const selected = new Set(this.selectedItems());
      selected.delete(itemId);
      this.selectedItems.set(selected);
      
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      this.updating.set(false);
    }
  }

  navigateToProduct = (item: CartItem): void => {
    this.router.navigate(['/product', item.productSlug, item.productId]);
  };

  proceedToCheckout(): void {
    const selectedItems = this.selectedCartItems();
    if (!selectedItems.length) return;
    
    console.log('Proceeding to checkout with:', selectedItems);
    // this.router.navigate(['/checkout'], { state: { selectedItems } });
  }

  async clearSelectedItems(): Promise<void> {
    const selectedIds = Array.from(this.selectedItems());
    if (!selectedIds.length) return;

    try {
      this.updating.set(true);
      
      await Promise.all(selectedIds.map(id => this.cartService.removeFromCart(id)));
      this.selectedItems.set(new Set());
      
    } catch (error) {
      console.error('Error clearing selected items:', error);
    } finally {
      this.updating.set(false);
    }
  }
}
