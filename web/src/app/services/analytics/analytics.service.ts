import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Analytics, logEvent, setUserId, setUserProperties } from '@angular/fire/analytics';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly analytics = inject(Analytics);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Registra un evento personalizado en Analytics
   */
  logEvent(eventName: string, eventParams?: { [key: string]: any }) {
    if (this.isBrowser && this.analytics) {
      logEvent(this.analytics, eventName, eventParams);
    }
  }

  /**
   * Trackea vista de producto
   */
  logProductView(productId: string, productName: string, price: number, category?: string) {
    this.logEvent('view_item', {
      currency: 'USD',
      value: price,
      items: [{
        item_id: productId,
        item_name: productName,
        item_category: category,
        price: price
      }]
    });
  }

  /**
   * Trackea búsqueda
   */
  logSearch(searchTerm: string) {
    this.logEvent('search', {
      search_term: searchTerm
    });
  }

  /**
   * Trackea añadir al carrito
   */
  logAddToCart(productId: string, productName: string, price: number, quantity: number = 1) {
    this.logEvent('add_to_cart', {
      currency: 'USD',
      value: price * quantity,
      items: [{
        item_id: productId,
        item_name: productName,
        price: price,
        quantity: quantity
      }]
    });
  }

  /**
   * Trackea inicio de checkout
   */
  logBeginCheckout(value: number, items: any[]) {
    this.logEvent('begin_checkout', {
      currency: 'USD',
      value: value,
      items: items
    });
  }

  /**
   * Trackea compra completada
   */
  logPurchase(transactionId: string, value: number, items: any[], tax?: number, shipping?: number) {
    this.logEvent('purchase', {
      transaction_id: transactionId,
      currency: 'USD',
      value: value,
      tax: tax,
      shipping: shipping,
      items: items
    });
  }

  /**
   * Trackea añadir a wishlist
   */
  logAddToWishlist(productId: string, productName: string, price: number) {
    this.logEvent('add_to_wishlist', {
      currency: 'USD',
      value: price,
      items: [{
        item_id: productId,
        item_name: productName,
        price: price
      }]
    });
  }

  /**
   * Establece el ID del usuario
   */
  setUserId(userId: string) {
    if (this.isBrowser && this.analytics) {
      setUserId(this.analytics, userId);
    }
  }

  /**
   * Establece propiedades del usuario
   */
  setUserProperties(properties: { [key: string]: any }) {
    if (this.isBrowser && this.analytics) {
      setUserProperties(this.analytics, properties);
    }
  }
}
