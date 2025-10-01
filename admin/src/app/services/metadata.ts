import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Counters {
  adminUsers: number;
  categories: number;
  products: number;
  products_active: number;
  products_paused: number;
}

@Injectable({
  providedIn: 'root'
})
export class Metadata {
  private firestore: Firestore = inject(Firestore);
  private injector: Injector = inject(Injector);

  getCounters(): Observable<Counters> {
    return runInInjectionContext(this.injector, () => {
      const ref = doc(this.firestore, 'metadata/counters');
      return docData(ref) as Observable<Counters>;
    });
  }
}
