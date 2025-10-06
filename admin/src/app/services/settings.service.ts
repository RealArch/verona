import { Injectable, signal, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { StoreSettings } from '../interfaces/settings';

type SettingKey = 'storeEnabled' | 'pickupEnabled' | 'deliveryEnabled' | 'shippingEnabled' | 'arrangeWithSellerEnabled';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private firestore = inject(Firestore);
  private readonly settingsDocRef = doc(this.firestore, 'store/settings');
  
  private _storeEnabled = signal<boolean>(true);
  private _pickupEnabled = signal<boolean>(true);
  private _deliveryEnabled = signal<boolean>(true);
  private _shippingEnabled = signal<boolean>(true);
  private _arrangeWithSellerEnabled = signal<boolean>(true);
  private _taxPercentage = signal<number>(0);

  readonly storeEnabled = this._storeEnabled.asReadonly();
  readonly pickupEnabled = this._pickupEnabled.asReadonly();
  readonly deliveryEnabled = this._deliveryEnabled.asReadonly();
  readonly shippingEnabled = this._shippingEnabled.asReadonly();
  readonly arrangeWithSellerEnabled = this._arrangeWithSellerEnabled.asReadonly();
  readonly taxPercentage = this._taxPercentage.asReadonly();

  private readonly defaultSettings: StoreSettings = {
    storeEnabled: true,
    deliveryMethods: {
      pickupEnabled: true,
      homeDeliveryEnabled: true,
      shippingEnabled: true,
      arrangeWithSellerEnabled: true
    },
    taxPercentage: 0
  };

  constructor() {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const settingsDoc = await getDoc(this.settingsDocRef);
      const data = settingsDoc.exists() ? settingsDoc.data() as StoreSettings : this.defaultSettings;
      
      this.updateSignals(data);
      
      if (!settingsDoc.exists()) {
        await this.saveSettings(this.defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.updateSignals(this.defaultSettings);
    }
  }

  private updateSignals(settings: StoreSettings): void {
    this._storeEnabled.set(settings.storeEnabled ?? true);
    this._pickupEnabled.set(settings.deliveryMethods?.pickupEnabled ?? true);
    this._deliveryEnabled.set(settings.deliveryMethods?.homeDeliveryEnabled ?? true);
    this._shippingEnabled.set(settings.deliveryMethods?.shippingEnabled ?? true);
    this._arrangeWithSellerEnabled.set(settings.deliveryMethods?.arrangeWithSellerEnabled ?? true);
    this._taxPercentage.set(settings.taxPercentage ?? 0);
  }

  private getCurrentSettings(): StoreSettings {
    return {
      storeEnabled: this._storeEnabled(),
      deliveryMethods: {
        pickupEnabled: this._pickupEnabled(),
        homeDeliveryEnabled: this._deliveryEnabled(),
        shippingEnabled: this._shippingEnabled(),
        arrangeWithSellerEnabled: this._arrangeWithSellerEnabled()
      },
      taxPercentage: this._taxPercentage()
    };
  }

  private async saveSettings(settings: StoreSettings): Promise<void> {
    await setDoc(this.settingsDocRef, settings);
  }

  async updateSetting(key: SettingKey, enabled: boolean): Promise<void> {
    try {
      const settings = this.getCurrentSettings();
      
      if (key === 'storeEnabled') {
        settings.storeEnabled = enabled;
        this._storeEnabled.set(enabled);
      } else {
        const deliveryKey = key === 'deliveryEnabled' ? 'homeDeliveryEnabled' : key;
        settings.deliveryMethods[deliveryKey as keyof typeof settings.deliveryMethods] = enabled;
        
        const signalMap = {
          pickupEnabled: this._pickupEnabled,
          deliveryEnabled: this._deliveryEnabled,
          shippingEnabled: this._shippingEnabled,
          arrangeWithSellerEnabled: this._arrangeWithSellerEnabled
        };
        signalMap[key]?.set(enabled);
      }
      
      await this.saveSettings(settings);
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      throw error;
    }
  }

  // Métodos de conveniencia para mantener la API existente
  async setStoreEnabled(enabled: boolean): Promise<void> {
    return this.updateSetting('storeEnabled', enabled);
  }

  async setPickupEnabled(enabled: boolean): Promise<void> {
    return this.updateSetting('pickupEnabled', enabled);
  }

  async setDeliveryEnabled(enabled: boolean): Promise<void> {
    return this.updateSetting('deliveryEnabled', enabled);
  }

  async setShippingEnabled(enabled: boolean): Promise<void> {
    return this.updateSetting('shippingEnabled', enabled);
  }

  async setArrangeWithSellerEnabled(enabled: boolean): Promise<void> {
    return this.updateSetting('arrangeWithSellerEnabled', enabled);
  }

  async setTaxPercentage(percentage: number): Promise<void> {
    try {
      const settings = this.getCurrentSettings();
      settings.taxPercentage = percentage;
      await this.saveSettings(settings);
      this._taxPercentage.set(percentage);
    } catch (error) {
      console.error('Error updating tax percentage:', error);
      throw error;
    }
  }
}