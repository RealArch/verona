import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc, onSnapshot } from '@angular/fire/firestore';
import { StoreSettings } from '../../interfaces/settings';
import { DeliveryMethod } from '../../interfaces/sales';

@Injectable({
  providedIn: 'root'
})
export class SiteConfig {
  private readonly firestore = inject(Firestore);
  
  // Signal para almacenar la configuración de la tienda
  storeSettings = signal<StoreSettings | null>(null);
  loading = signal<boolean>(true);
  
  constructor() {
    this.loadStoreSettings();
  }
  
  /**
   * Carga la configuración de la tienda desde Firestore
   * y mantiene una suscripción en tiempo real
   */
  private loadStoreSettings(): void {
    const settingsDocRef = doc(this.firestore, 'store/settings');
    
    // Suscripción en tiempo real
    onSnapshot(settingsDocRef, 
      (docSnap) => {
        this.loading.set(false);
        if (docSnap.exists()) {
          const data = docSnap.data() as StoreSettings;
          this.storeSettings.set(data);
          // console.log('Store settings loaded:', data);
        } else {
          console.warn('Store settings document does not exist');
          // Configuración por defecto si no existe
          this.storeSettings.set({
            storeEnabled: true,
            deliveryMethods: {
              pickupEnabled: true,
              homeDeliveryEnabled: true,
              shippingEnabled: false,
              arrangeWithSellerEnabled: false
            },
            taxPercentage: 16 // Por defecto 18%
          });
        }
      },
      (error) => {
        console.error('Error loading store settings:', error);
        this.loading.set(false);
      }
    );
  }
  
  /**
   * Obtiene los métodos de entrega habilitados
   */
  getEnabledDeliveryMethods(): { key: DeliveryMethod; label: string; enabled: boolean }[] {
    const settings = this.storeSettings();
    if (!settings) return [];
    
    const methods = [
      { key: 'pickup' as DeliveryMethod, label: 'Recojo en tienda', enabled: settings.deliveryMethods.pickupEnabled },
      { key: 'homeDelivery' as DeliveryMethod, label: 'Entrega a domicilio', enabled: settings.deliveryMethods.homeDeliveryEnabled },
      { key: 'shipping' as DeliveryMethod, label: 'Envío', enabled: settings.deliveryMethods.shippingEnabled },
      { key: 'arrangeWithSeller' as DeliveryMethod, label: 'Acordar con vendedor', enabled: settings.deliveryMethods.arrangeWithSellerEnabled }
    ];
    
    return methods.filter(method => method.enabled);
  }
}
