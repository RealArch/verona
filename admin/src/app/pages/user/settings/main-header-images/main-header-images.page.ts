import { Component, OnDestroy, ViewChild, ElementRef, inject, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonProgressBar, IonSpinner, IonFooter } from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, closeOutline } from 'ionicons/icons';
import { SettingsService } from 'src/app/services/settings.service';
import { Popups } from 'src/app/services/popups';
import { ModalController } from '@ionic/angular/standalone';
import { HeaderImage } from 'src/app/interfaces/settings';

type ScreenType = 'large' | 'small';

interface PendingUpload {
  name: string;
  path: string;
  type: string;
  url: string;
}

interface SlotConfig {
  title: string;
  ratio: string;
  recommendation: string;
  description: string;
}

@Component({
  selector: 'app-main-header-images',
  templateUrl: './main-header-images.page.html',
  styleUrls: ['./main-header-images.page.scss'],
  standalone: true,
  host: {
    class: 'ion-page'
  },
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
  IonContent,
    IonProgressBar,
    IonSpinner,
    IonFooter
  ]
})
export class MainHeaderImagesPage implements OnDestroy {
  private settingsService = inject(SettingsService);
  private popups = inject(Popups);
  private modalController = inject(ModalController);

  @ViewChild('largeFileInput') private largeFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('smallFileInput') private smallFileInput?: ElementRef<HTMLInputElement>;

  readonly slotConfig: Record<ScreenType, SlotConfig> = {
    large: {
      title: 'Hero principal (pantallas grandes)',
      ratio: '16:6',
      recommendation: '1536 x 677 px',
      description: 'Ideal para desktop y tablets horizontales.'
    },
    small: {
      title: 'Hero principal (pantallas pequenas)',
      ratio: '1:1',
      recommendation: '660 x 660 px',
      description: 'Optimizada para moviles y tablets verticales.'
    }
  };

  // Signals per slot to keep the component reactive and predictable.
  private readonly previewLarge = signal<string | null>(null);
  private readonly previewSmall = signal<string | null>(null);
  private readonly uploadingLarge = signal(false);
  private readonly uploadingSmall = signal(false);
  private readonly progressLarge = signal(0);
  private readonly progressSmall = signal(0);
  private readonly pendingLarge = signal<PendingUpload | null>(null);
  private readonly pendingSmall = signal<PendingUpload | null>(null);
  private readonly dragOverLarge = signal(false);
  private readonly dragOverSmall = signal(false);
  private readonly isSaving = signal(false);

  // Exposed read-only selectors for the template.
  readonly largePreview = computed(() => this.previewLarge());
  readonly smallPreview = computed(() => this.previewSmall());
  readonly largeIsUploading = computed(() => this.uploadingLarge());
  readonly smallIsUploading = computed(() => this.uploadingSmall());
  readonly largeProgressValue = computed(() => this.progressLarge());
  readonly smallProgressValue = computed(() => this.progressSmall());
  readonly largeDragOver = computed(() => this.dragOverLarge());
  readonly smallDragOver = computed(() => this.dragOverSmall());
  readonly saving = computed(() => this.isSaving());
  readonly hasPendingChanges = computed(() => Boolean(this.pendingLarge() || this.pendingSmall()));
  readonly largePendingData = computed(() => this.pendingLarge());
  readonly smallPendingData = computed(() => this.pendingSmall());
  readonly storedLargeImage = computed(() => this.settingsService.largeScreenImage());
  readonly storedSmallImage = computed(() => this.settingsService.smallScreenImage());

  private transientPreviews: Partial<Record<ScreenType, string>> = {};

  constructor() {
  addIcons({ cloudUploadOutline, closeOutline });

    // Update previews whenever the persisted images change and there is no pending upload.
    effect(() => {
      const stored = this.settingsService.largeScreenImage();
      if (!this.pendingLarge() && stored) {
        this.updatePreviewFromStored('large', stored);
      }
      if (!stored && !this.pendingLarge()) {
        this.previewLarge.set(null);
      }
    });

    effect(() => {
      const stored = this.settingsService.smallScreenImage();
      if (!this.pendingSmall() && stored) {
        this.updatePreviewFromStored('small', stored);
      }
      if (!stored && !this.pendingSmall()) {
        this.previewSmall.set(null);
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupTransientPreviews();
  }

  triggerFileInput(slot: ScreenType): void {
    if (this.isSaving()) {
      return;
    }
    const input = slot === 'large' ? this.largeFileInput?.nativeElement : this.smallFileInput?.nativeElement;
    input?.click();
  }

  async onZoneClick(slot: ScreenType): Promise<void> {
    if (this.isSaving()) {
      return;
    }

    const handled = await this.tryNativePicker(slot);
    if (!handled) {
      this.triggerFileInput(slot);
    }
  }

  onZoneKeyUp(event: KeyboardEvent, slot: ScreenType): void {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    event.preventDefault();
    void this.onZoneClick(slot);
  }

  async onFileChange(event: Event, slot: ScreenType): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.processFile(slot, file);
    }
  }

  async onDrop(event: DragEvent, slot: ScreenType): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.setDragState(slot, false);
    const file = this.extractFileFromDrop(event);
    if (file) {
      await this.processFile(slot, file);
    } else {
      await this.popups.presentToast('bottom', 'warning', 'No se detecto ningun archivo de imagen.');
    }
  }

  onDragOver(event: DragEvent, slot: ScreenType): void {
    event.preventDefault();
    this.setDragState(slot, true);
  }

  onDragLeave(event: DragEvent, slot: ScreenType): void {
    event.preventDefault();
    this.setDragState(slot, false);
  }

  async save(): Promise<void> {
    if (!this.hasPendingChanges()) {
      await this.popups.presentToast('bottom', 'medium', 'No hay cambios por guardar.');
      return;
    }

    this.isSaving.set(true);

    try {
      await this.settingsService.saveHeaderImages(
        this.pendingLarge() ?? undefined,
        this.pendingSmall() ?? undefined
      );

      this.pendingLarge.set(null);
      this.pendingSmall.set(null);
      this.progressLarge.set(0);
      this.progressSmall.set(0);
      this.cleanupTransientPreviews();

      await this.popups.presentToast('bottom', 'success', 'Imagenes guardadas correctamente.');
      await this.modalController.dismiss(true);
    } catch (error) {
      console.error('[MainHeaderImagesPage] save error', error);
      await this.popups.presentToast('bottom', 'danger', 'Error al guardar las imagenes. Revisa tu conexion.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async close(): Promise<void> {
    if (this.hasPendingChanges()) {
      const confirmed = await this.popups.confirm(
        'Cerrar sin guardar?',
        'Tienes cambios sin guardar. Si cierras ahora se perderan.'
      );
      if (!confirmed) {
        return;
      }
    }
    await this.modalController.dismiss(false);
  }

  private async processFile(slot: ScreenType, file: File): Promise<void> {
    if (!this.isAllowedImage(file)) {
      await this.popups.presentToast('bottom', 'warning', 'Formato no permitido. Usa PNG, JPG o WEBP.');
      return;
    }

    const state = this.getSlotState(slot);

    if (state.uploading()) {
      await this.popups.presentToast('bottom', 'warning', 'Espera a que termine la carga actual.');
      return;
    }

    this.registerTransientPreview(slot, URL.createObjectURL(file));
    state.uploading.set(true);
    state.progress.set(0);

    const uploadReadyFile = await this.ensureFileHasContent(slot, file);
    if (uploadReadyFile !== file) {
      this.registerTransientPreview(slot, URL.createObjectURL(uploadReadyFile));
    }

    try {
  const upload = await this.settingsService.updateHeaderImage(uploadReadyFile, slot, (progress) => state.progress.set(progress));
      const inferredType = upload.type ?? uploadReadyFile.type ?? this.resolveMimeForPending(uploadReadyFile);
      const pending: PendingUpload = {
        path: upload.path,
        url: upload.url,
        type: inferredType,
        name: upload.name ?? (uploadReadyFile.name?.trim() ? uploadReadyFile.name : this.buildFallbackName(uploadReadyFile, slot, inferredType))
      };
      state.pending.set(pending);
      this.revokeTransientPreview(slot);
      state.preview.set(upload.url);
    } catch (error) {
      console.error('[MainHeaderImagesPage] processFile upload error', error);
      await this.popups.presentToast('bottom', 'danger', 'No se pudo subir la imagen. Intenta nuevamente.');
      this.revertPreviewToStored(slot);
      state.pending.set(null);
    } finally {
      state.uploading.set(false);
      state.progress.set(0);
    }
  }

  private getSlotState(slot: ScreenType) {
    return slot === 'large'
      ? {
          preview: this.previewLarge,
          uploading: this.uploadingLarge,
          progress: this.progressLarge,
          pending: this.pendingLarge
        }
      : {
          preview: this.previewSmall,
          uploading: this.uploadingSmall,
          progress: this.progressSmall,
          pending: this.pendingSmall
        };
  }

  private setDragState(slot: ScreenType, value: boolean): void {
    const state = slot === 'large' ? this.dragOverLarge : this.dragOverSmall;
    state.set(value);
  }

  private extractFileFromDrop(event: DragEvent): File | null {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return null;
    }

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (const item of Array.from(dataTransfer.items)) {
        if (item.kind === 'file') {
          const candidate = item.getAsFile();
          if (candidate) {
            return candidate;
          }
        }
      }
    }

    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return dataTransfer.files[0];
    }

    return null;
  }

  private async ensureFileHasContent(slot: ScreenType, file: File): Promise<File> {
    if (file.size > 0) {
      return file;
    }

    const previewUrl = this.transientPreviews[slot];
    if (!previewUrl) {
      return file;
    }

    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        return file;
      }

      const type = this.normalizeAllowedType(blob.type || this.resolveMimeForPending(file));
      const name = file.name?.trim().length
        ? file.name
        : `header-${slot}-${Date.now()}.${this.getExtensionFromMime(type)}`;

      return new File([blob], name, { type });
    } catch (error) {
      console.warn('[MainHeaderImagesPage] ensureFileHasContent fallo', error);
      return file;
    }
  }

  private isAllowedImage(file: File): boolean {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const allowedExt = ['.png', '.jpg', '.jpeg', '.webp'];
    if (file.type && allowedTypes.includes(file.type.toLowerCase())) {
      return true;
    }
    const name = file.name?.toLowerCase() ?? '';
    return allowedExt.some((ext) => name.endsWith(ext));
  }

  private resolveMimeForPending(file: File): string {
    if (file.type && file.type.trim().length > 0) {
      return file.type;
    }
    const lower = file.name?.toLowerCase() ?? '';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.jfif')) return 'image/jpeg';
    return 'image/jpeg';
  }

  private buildFallbackName(file: File, slot: ScreenType, type: string): string {
    const trimmed = file.name?.trim();
    if (trimmed) {
      return trimmed;
    }
    const extension = this.getExtensionFromMime(type);
    return `header-${slot}-${Date.now()}.${extension}`;
  }

  private async tryNativePicker(slot: ScreenType): Promise<boolean> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        promptLabelHeader: 'Seleccionar imagen'
      });
      const file = await this.photoToFile(photo, slot);
      if (file) {
        await this.processFile(slot, file);
      }
      return true;
    } catch (error: any) {
      if (this.isUserCancellation(error)) {
        return true;
      }
      if (this.isPluginUnavailable(error)) {
        return false;
      }
      console.error('[MainHeaderImagesPage] tryNativePicker error', error);
      await this.popups.presentToast('bottom', 'danger', 'No se pudo abrir la galeria. Intenta de nuevo.');
      return false;
    }
  }

  private async photoToFile(photo: Photo, slot: ScreenType): Promise<File | null> {
    try {
      const url = photo.webPath ?? photo.path;
      if (!url) {
        return null;
      }
      const response = await fetch(url);
      const blob = await response.blob();
      const extension = this.getExtensionFromMime(blob.type) || 'jpg';
      const fileName = `header-${slot}-${Date.now()}.${extension}`;
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('[MainHeaderImagesPage] photoToFile error', error);
      await this.popups.presentToast('bottom', 'danger', 'No se pudo procesar la imagen seleccionada.');
      return null;
    }
  }

  private getExtensionFromMime(type: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    if (type && map[type]) {
      return map[type];
    }
    if (!type) {
      return 'jpg';
    }
    const [, ext] = type.split('/');
    if (!ext) {
      return 'jpg';
    }
    return ext.replace('+xml', '') || 'jpg';
  }

  private normalizeAllowedType(type: string): string {
    const lower = type.toLowerCase();
    if (lower.includes('png')) return 'image/png';
    if (lower.includes('webp')) return 'image/webp';
    return 'image/jpeg';
  }

  private updatePreviewFromStored(slot: ScreenType, image: HeaderImage): void {
    const state = this.getSlotState(slot);
    state.preview.set(image?.url ?? null);
  }

  private revertPreviewToStored(slot: ScreenType): void {
    const stored = slot === 'large' ? this.settingsService.largeScreenImage() : this.settingsService.smallScreenImage();
    if (stored) {
      this.updatePreviewFromStored(slot, stored);
    } else {
      const state = this.getSlotState(slot);
      state.preview.set(null);
    }
    this.revokeTransientPreview(slot);
  }

  private registerTransientPreview(slot: ScreenType, url: string): void {
    this.revokeTransientPreview(slot);
    this.transientPreviews[slot] = url;
    const state = this.getSlotState(slot);
    state.preview.set(url);
  }

  private revokeTransientPreview(slot: ScreenType): void {
    const existing = this.transientPreviews[slot];
    if (existing) {
      URL.revokeObjectURL(existing);
      delete this.transientPreviews[slot];
    }
  }

  private cleanupTransientPreviews(): void {
    (Object.keys(this.transientPreviews) as ScreenType[]).forEach((slot) => this.revokeTransientPreview(slot));
  }

  private isUserCancellation(error: any): boolean {
    if (!error) {
      return false;
    }
    const message = typeof error === 'string' ? error : error.message || error.errorMessage;
    return message?.toLowerCase().includes('cancel') ?? false;
  }

  private isPluginUnavailable(error: any): boolean {
    const message = typeof error === 'string' ? error : error?.message || error?.errorMessage;
    const normalized = message?.toLowerCase() ?? '';
    const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
    return normalized.includes('plugin not implemented') || normalized.includes('not implemented') || normalized.includes('unavailable') || code.includes('unavailable') || code.includes('notimplemented');
  }
}
