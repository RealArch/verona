import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, query, orderBy, limit, collectionData, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { Product } from '../../interfaces/products';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private injector = inject(Injector);
  private firestore = inject(Firestore);
  readonly productsRef = collection(this.firestore, 'products');
  /**
   * Get best sellers products in real-time from Firestore`
   * @param limitCount Number of products to retrieve
   * @returns Observable with real-time best sellers data
   */

  getProduct(uid: string) {
    return runInInjectionContext(this.injector, async () => {
      const productDocRef = doc(this.firestore, 'products', uid);
      return docData(productDocRef, { idField: 'id' }) as Observable<Product | null>;

    });
  }

  getBestSellers(limitCount: number): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const firestore = inject(Firestore);
      const productsRef = collection(firestore, 'products');

      const bestSellersQuery = query(
        productsRef,
        orderBy('totalSales', 'desc'),
        limit(limitCount)
      );

      return collectionData(bestSellersQuery, {
        idField: 'id'
      }) as Observable<Product[]>;
    });
  }
}



