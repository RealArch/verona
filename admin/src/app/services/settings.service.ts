import { Injectable, signal, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { StoreSettings, HeaderImage } from '../interfaces/settings';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

type SettingKey = 'storeEnabled' | 'pickupEnabled' | 'deliveryEnabled' | 'shippingEnabled' | 'arrangeWithSellerEnabled';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly injector = inject(EnvironmentInjector);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private authService = inject(AuthService);
  private readonly settingsDocRef = this.runInContext(() => doc(this.firestore, 'store/settings'));
  
  private _storeEnabled = signal<boolean>(true);
  private _pickupEnabled = signal<boolean>(true);
  private _deliveryEnabled = signal<boolean>(true);
  private _shippingEnabled = signal<boolean>(true);
  private _arrangeWithSellerEnabled = signal<boolean>(true);
  private _taxPercentage = signal<number>(0);
  private _largeScreenImage = signal<HeaderImage | null>(null);
  private _smallScreenImage = signal<HeaderImage | null>(null);

  readonly storeEnabled = this._storeEnabled.asReadonly();
  readonly pickupEnabled = this._pickupEnabled.asReadonly();
  readonly deliveryEnabled = this._deliveryEnabled.asReadonly();
  readonly shippingEnabled = this._shippingEnabled.asReadonly();
  readonly arrangeWithSellerEnabled = this._arrangeWithSellerEnabled.asReadonly();
  readonly taxPercentage = this._taxPercentage.asReadonly();
  readonly largeScreenImage = this._largeScreenImage.asReadonly();
  readonly smallScreenImage = this._smallScreenImage.asReadonly();

  private readonly defaultSettings: StoreSettings = {
    storeEnabled: true,
    deliveryMethods: {
      pickupEnabled: false,
      homeDeliveryEnabled: false,
      shippingEnabled: false,
      arrangeWithSellerEnabled: true
    },
    taxPercentage: 0,
    headerImages: {
      largeScreen: null,
      smallScreen: null
    }
  };

  constructor() {
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const settingsDoc = await this.runInContext(() => getDoc(this.settingsDocRef));
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
    this._largeScreenImage.set(settings.headerImages?.largeScreen ?? null);
    this._smallScreenImage.set(settings.headerImages?.smallScreen ?? null);
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
      taxPercentage: this._taxPercentage(),
      headerImages: {
        largeScreen: this._largeScreenImage(),
        smallScreen: this._smallScreenImage()
      }
    };
  }

  private async saveSettings(settings: StoreSettings): Promise<void> {
    await this.runInContext(() => setDoc(this.settingsDocRef, settings));
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

  async updateHeaderImage(file: File, screenType: 'large' | 'small', onProgress?: (progress: number) => void): Promise<{ url: string; path: string }> {
    try {
      const user = this.authService.user$;
      const userId = (await firstValueFrom(user))?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Subir a temp primero
      const tempPath = `temp/${userId}/${Date.now()}_${file.name}`;
      const storageRef = this.runInContext(() => ref(this.storage, tempPath));

      return new Promise<{ path: string, url: string }>((resolve, reject) => {
        const uploadTask = this.runInContext(() => uploadBytesResumable(storageRef, file));

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(progress);
            }
          },
          (error) => {
            console.error("Upload failed", error);
            reject(error);
          },
          async () => {
            try {
              const downloadUrl = await this.runInContext(() => getDownloadURL(uploadTask.snapshot.ref));
              resolve({ path: tempPath, url: downloadUrl });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error updating header image:', error);
      throw error;
    }
  }

  async saveHeaderImages(largeScreenData?: { path: string, url: string, type: string, name: string }, smallScreenData?: { path: string, url: string, type: string, name: string }): Promise<void> {
    try {
      // Mover imágenes de temp a img/settings
      if (largeScreenData) {
        const finalPath = `img/settings/header-large.${this.getExtensionFromType(largeScreenData.type)}`;
        const finalUrl = await this.moveImage(largeScreenData.path, finalPath);
        
        const headerImage: HeaderImage = {
          path: finalPath,
          url: finalUrl,
          type: largeScreenData.type,
          processing: false,
          name: largeScreenData.name
        };
        
        this._largeScreenImage.set(headerImage);
      }
      
      if (smallScreenData) {
        const finalPath = `img/settings/header-small.${this.getExtensionFromType(smallScreenData.type)}`;
        const finalUrl = await this.moveImage(smallScreenData.path, finalPath);
        
        const headerImage: HeaderImage = {
          path: finalPath,
          url: finalUrl,
          type: smallScreenData.type,
          processing: false,
          name: smallScreenData.name
        };
        
        this._smallScreenImage.set(headerImage);
      }

      // Guardar en Firestore
      const settings = this.getCurrentSettings();
      await this.saveSettings(settings);

    } catch (error) {
      console.error('Error saving header images:', error);
      throw error;
    }
  }

  private async moveImage(tempPath: string, finalPath: string): Promise<string> {
    try {
      // Obtener referencia a la imagen temporal
      const tempRef = this.runInContext(() => ref(this.storage, tempPath));
      
      // Descargar la imagen temporal
      const tempUrl = await this.runInContext(() => getDownloadURL(tempRef));
      const response = await fetch(tempUrl);
      const blob = await response.blob();
      
      // Subir a la ubicación final
      const finalRef = this.runInContext(() => ref(this.storage, finalPath));
      await this.runInContext(() => uploadBytesResumable(finalRef, blob));
      
      // Obtener URL final
      const finalUrl = await this.runInContext(() => getDownloadURL(finalRef));
      
      // Eliminar imagen temporal
      await this.runInContext(() => deleteObject(tempRef));
      
      return finalUrl;
    } catch (error) {
      console.error('Error moving image:', error);
      throw error;
    }
  }

  private runInContext<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private getExtensionFromType(type: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    return extensions[type] || 'jpg';
  }
}