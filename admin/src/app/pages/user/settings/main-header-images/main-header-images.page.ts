import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons, IonIcon, IonSpinner, IonFooter, ModalController } from '@ionic/angular/standalone';
import { SettingsService } from 'src/app/services/settings.service';
import { Popups } from 'src/app/services/popups';
import { addIcons } from 'ionicons';
import { close, imageOutline, trashOutline } from 'ionicons/icons';

interface ImageUpload {
  file: File | null;
  previewUrl: string;
  safePreviewUrl?: SafeUrl;
  uploading: boolean;
  progress: number;
  tempPath?: string;
  uploadedUrl?: string;
  type?: string;
  name?: string;
  source: 'existing' | 'local';
  localObjectUrl?: string;
}

@Component({
  selector: 'app-main-header-images',
  templateUrl: './main-header-images.page.html',
  styleUrls: ['./main-header-images.page.scss'],
  standalone: true,
  imports: [IonFooter, IonSpinner, IonIcon, IonButtons, IonButton, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class MainHeaderImagesPage implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);
  private popups = inject(Popups);
  private modalController = inject(ModalController);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  private readonly allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);
  private readonly maxFileSizeMb = 6; // evita cargas muy pesadas

  // Header images
  largeScreenImage: ImageUpload | null = null;
  smallScreenImage: ImageUpload | null = null;
  isSaving = false;
  isDraggingLarge = false;
  isDraggingSmall = false;

  constructor() {
    addIcons({ close, imageOutline, trashOutline });
  }

  ngOnDestroy(): void {
    this.releaseLocalPreview(this.largeScreenImage);
    this.releaseLocalPreview(this.smallScreenImage);
  }

  ngOnInit() {
    // Cargar imágenes existentes si las hay
    const largeScreen = this.settingsService.largeScreenImage();
    const smallScreen = this.settingsService.smallScreenImage();

    if (largeScreen) {
      this.largeScreenImage = this.createExistingImageState(largeScreen.url, largeScreen.path, largeScreen.type, largeScreen.name);
    }

    if (smallScreen) {
      this.smallScreenImage = this.createExistingImageState(smallScreen.url, smallScreen.path, smallScreen.type, smallScreen.name);
    }
  }

  async onLargeScreenFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    await this.handleIncomingFile('large', file);
  }

  async onSmallScreenFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    await this.handleIncomingFile('small', file);
  }

  removeLargeScreenImage(event: Event) {
    event.stopPropagation();
    this.releaseLocalPreview(this.largeScreenImage);
    this.largeScreenImage = null;
    this.cdr.detectChanges();
  }

  removeSmallScreenImage(event: Event) {
    event.stopPropagation();
    this.releaseLocalPreview(this.smallScreenImage);
    this.smallScreenImage = null;
    this.cdr.detectChanges();
  }

  // Drag & Drop handlers
  onDragEnter(event: DragEvent, type: 'large' | 'small') {
    event.preventDefault();
    event.stopPropagation();
    
    if (type === 'large') {
      this.isDraggingLarge = true;
    } else {
      this.isDraggingSmall = true;
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDragLeave(event: DragEvent, type: 'large' | 'small') {
    event.preventDefault();
    event.stopPropagation();
    
    if (type === 'large') {
      this.isDraggingLarge = false;
    } else {
      this.isDraggingSmall = false;
    }
  }

  async onDrop(event: DragEvent, type: 'large' | 'small') {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('onDrop iniciado, tipo:', type);
    
    if (type === 'large') {
      this.isDraggingLarge = false;
    } else {
      this.isDraggingSmall = false;
    }

    const file = this.extractFileFromDragEvent(event);
    if (!file) {
      console.error('No se pudo extraer archivo del drop event');
      await this.popups.presentToast('bottom', 'warning', 'No se encontró un archivo válido.');
      return;
    }

    console.log('Archivo extraído:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    await this.handleIncomingFile(type, file);

    // Limpiar el dataTransfer
    if (event.dataTransfer?.items) {
      event.dataTransfer.items.clear();
    } else if (event.dataTransfer) {
      event.dataTransfer.clearData();
    }
  }

  private async handleIncomingFile(type: 'large' | 'small', file: File) {
    const validationError = this.validateSelectedFile(file);
    if (validationError) {
      await this.popups.presentToast('bottom', 'warning', validationError);
      return;
    }

    const previousState = this.cloneImageState(this.getImageState(type));

    try {
      const { previewUrl, safePreviewUrl, localObjectUrl } = await this.createPreview(file);

      const newState: ImageUpload = {
        file,
        previewUrl,
        safePreviewUrl,
        uploading: true,
        progress: 0,
        type: file.type,
        name: file.name,
        source: 'local',
        localObjectUrl
      };

      this.setImageState(type, newState);

      await this.uploadImage(type, file, previousState);
    } catch (error) {
      console.error('Error preparando la imagen:', error);
      this.setImageState(type, previousState);
      await this.popups.presentToast('bottom', 'danger', 'No se pudo procesar la imagen seleccionada.');
    }
  }

  private async uploadImage(type: 'large' | 'small', file: File, fallbackState: ImageUpload | null) {
    try {
      const result = await this.settingsService.updateHeaderImage(
        file,
        type,
        (progress) => {
          const current = this.getImageState(type);
          if (!current) {
            return;
          }

          current.progress = progress;
          this.setImageState(type, { ...current });
        }
      );

      const current = this.getImageState(type);
      if (!current) {
        return;
      }

      const previousObjectUrl = current.localObjectUrl;

      current.uploading = false;
      current.progress = 100;
      current.tempPath = result.path;
      current.uploadedUrl = result.url;
      current.previewUrl = result.url;
      current.safePreviewUrl = this.sanitizer.bypassSecurityTrustUrl(result.url);
      current.localObjectUrl = undefined;

      this.setImageState(type, { ...current });

      if (previousObjectUrl) {
        try {
          URL.revokeObjectURL(previousObjectUrl);
        } catch (error) {
          console.warn('No se pudo revocar la URL temporal tras subir la imagen:', error);
        }
      }

    } catch (error) {
      console.error('Error subiendo la imagen:', error);
      this.setImageState(type, fallbackState);
      await this.popups.presentToast('bottom', 'danger', 'Error al subir la imagen. Inténtalo nuevamente.');
    }
  }

  private setImageState(type: 'large' | 'small', state: ImageUpload | null) {
    const current = this.getImageState(type);
    const replacingWithDifferentFile = !!current && (state === null || state.file !== current.file);

    if (replacingWithDifferentFile) {
      this.releaseLocalPreview(current);
    }

    if (type === 'large') {
      this.largeScreenImage = state;
    } else {
      this.smallScreenImage = state;
    }

    this.cdr.detectChanges();
  }

  private getImageState(type: 'large' | 'small'): ImageUpload | null {
    return type === 'large' ? this.largeScreenImage : this.smallScreenImage;
  }

  private cloneImageState(state: ImageUpload | null): ImageUpload | null {
    if (!state) {
      return null;
    }

    return { ...state };
  }

  private createExistingImageState(url: string, path?: string, type?: string, name?: string): ImageUpload {
    return {
      file: null,
      previewUrl: url,
      safePreviewUrl: this.sanitizer.bypassSecurityTrustUrl(url),
      uploading: false,
      progress: 100,
      tempPath: path,
      uploadedUrl: url,
      type,
      name,
      source: 'existing'
    };
  }

  private validateSelectedFile(file: File): string | null {
    if (!this.allowedMimeTypes.has(file.type)) {
      return 'Solo se permiten imágenes en formato JPG, PNG o WEBP.';
    }

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > this.maxFileSizeMb) {
      return `El archivo supera el tamaño máximo permitido (${this.maxFileSizeMb} MB).`;
    }

    return null;
  }

  private extractFileFromDragEvent(event: DragEvent): File | null {
    if (event.dataTransfer?.items?.length) {
      for (const item of Array.from(event.dataTransfer.items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            return file;
          }
        }
      }
    }

    if (event.dataTransfer?.files?.length) {
      return event.dataTransfer.files[0];
    }

    return null;
  }

  private async createPreview(file: File): Promise<{ previewUrl: string; safePreviewUrl: SafeUrl; localObjectUrl?: string }> {
    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      return {
        previewUrl: dataUrl,
        safePreviewUrl: this.sanitizer.bypassSecurityTrustUrl(dataUrl)
      };
    } catch (error) {
      console.warn('Fallo leyendo archivo como DataURL, se usará ObjectURL temporal.', error);
      const objectUrl = URL.createObjectURL(file);
      return {
        previewUrl: objectUrl,
        safePreviewUrl: this.sanitizer.bypassSecurityTrustUrl(objectUrl),
        localObjectUrl: objectUrl
      };
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo generar la previsualización.'));
      reader.readAsDataURL(file);
    });
  }

  private releaseLocalPreview(state: ImageUpload | null) {
    if (!state?.localObjectUrl) {
      return;
    }

    try {
      URL.revokeObjectURL(state.localObjectUrl);
    } catch (error) {
      console.warn('No se pudo revocar la URL temporal:', error);
    } finally {
      state.localObjectUrl = undefined;
    }
  }

  async saveImages() {
    // Verificar si hay imágenes temporales para guardar
    const hasLargeTemp = this.largeScreenImage && this.largeScreenImage.tempPath && this.largeScreenImage.file;
    const hasSmallTemp = this.smallScreenImage && this.smallScreenImage.tempPath && this.smallScreenImage.file;

    if (!hasLargeTemp && !hasSmallTemp) {
      await this.popups.presentToast('bottom', 'warning', 'No hay imágenes nuevas para guardar');
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      let largeScreenData;
      let smallScreenData;

      if (hasLargeTemp) {
        largeScreenData = {
          path: this.largeScreenImage!.tempPath!,
          url: this.largeScreenImage!.uploadedUrl || this.largeScreenImage!.previewUrl,
          type: this.largeScreenImage!.type!,
          name: this.largeScreenImage!.name!
        };
      }

      if (hasSmallTemp) {
        smallScreenData = {
          path: this.smallScreenImage!.tempPath!,
          url: this.smallScreenImage!.uploadedUrl || this.smallScreenImage!.previewUrl,
          type: this.smallScreenImage!.type!,
          name: this.smallScreenImage!.name!
        };
      }

      // Guardar las imágenes (mover de temp a img/settings)
      await this.settingsService.saveHeaderImages(largeScreenData, smallScreenData);

      await this.popups.presentToast('bottom', 'success', 'Imágenes de portada actualizadas correctamente');
      this.closeModal();
    } catch (error) {
      console.error('Error saving images:', error);
      await this.popups.presentToast('bottom', 'danger', 'Error al guardar las imágenes');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  get canSave(): boolean {
    // Verificar si hay alguna imagen subiendo
    const isUploading = (this.largeScreenImage?.uploading) || (this.smallScreenImage?.uploading);
    
    // Verificar si hay imágenes temporales nuevas para guardar
    const hasNewImages =
      (this.largeScreenImage && this.largeScreenImage.tempPath && this.largeScreenImage.file !== null) ||
      (this.smallScreenImage && this.smallScreenImage.tempPath && this.smallScreenImage.file !== null);

    return !isUploading && !!hasNewImages;
  }

  closeModal() {
    this.modalController.dismiss();
  }

}
