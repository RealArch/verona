import { Component, OnInit, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  ToastController, IonSpinner, IonProgressBar, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  ModalController, IonPopover, IonList, IonButton, IonIcon, IonRow, IonCol, IonGrid
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline, add, informationCircleOutline, folderOutline, optionsOutline, colorPaletteOutline, resizeOutline, closeOutline, layersOutline, close, cubeOutline, documentTextOutline, warningOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { QuillModule } from 'ngx-quill';
import { firstValueFrom, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { AuthService } from 'src/app/services/auth.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoriesService, Category } from 'src/app/services/categories.service';
import { NewPhoto } from 'src/app/interfaces/product-photo';
import { SelectCategoryModalComponent } from './select-category/select-category-modal.component';

// Interfaces simplificadas
interface ImageFile {
  file: File;
  previewUrl: string;
  uploading: boolean;
  progress: number;
  tempPath?: string;
}

@Component({
  selector: 'app-product-form',
  templateUrl: './products-form.page.html',
  styleUrls: ['./products-form.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, QuillModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonButton, IonIcon, IonSpinner, IonProgressBar, IonCard, IonCardHeader,
    IonCardContent, IonCardTitle, IonPopover, IonList, IonGrid, IonRow, IonCol
  ]
})
export class ProductFormPage implements OnInit {
  // Inyección de dependencias
  private fb = inject(FormBuilder);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private modalCtrl = inject(ModalController);

  // Propiedades del componente
  productForm!: FormGroup;
  isEditMode = false;
  productId: string | null = null;
  categories: Category[] = [];
  selectedCategoryPath: Category[] = [];
  imageFiles: ImageFile[] = [];
  isUploading = false;
  private variantsSub: Subscription | undefined;

  // Configuración de Quill
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link']
    ]
  };

  constructor() {
    addIcons({ save, cameraOutline, addCircleOutline, trashOutline, folderOutline, informationCircleOutline, documentTextOutline, layersOutline, optionsOutline, add, colorPaletteOutline, resizeOutline, closeOutline, close, cloudUploadOutline, folderOpenOutline, cubeOutline, warningOutline });
  }

  // --- Ciclo de Vida ---
  ngOnInit() {
    this.initForm();
    this.loadCategories();
    this.checkEditMode();
  }

  ngOnDestroy() {
    this.variantsSub?.unsubscribe();
  }

  // --- Getters para el Formulario ---
  get variants(): FormArray {
    return this.productForm.get('variants') as FormArray;
  }

  get primaryAttributeType(): string | null {
    const variants = this.variants.value;
    return variants.length > 0 ? variants[0].type : null;
  }

  get hasVariants(): boolean {
    return this.variants.length > 0;
  }

  // --- Inicialización ---
  private initForm() {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      price: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      sku: [''],
      categoryId: [null, Validators.required],
      status: ['active', Validators.required],
      photos: this.fb.array([]),
      variants: this.fb.array([]),
    });

    // Suscripción para actualizar el stock total desde las variantes
    this.variantsSub = this.variants.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      if (this.hasVariants) {
        const totalStock = this.variants.controls.reduce((sum, control) => {
          return sum + (control.get('stock')?.value || 0);
        }, 0);
        this.productForm.get('stock')?.setValue(totalStock, { emitEvent: false });
      }
    });
  }

  private checkEditMode() {
    this.productId = this.route.snapshot.paramMap.get('id');
    if (this.productId) {
      this.isEditMode = true;
      this.productsService.getProduct(this.productId)
      .subscribe(product => {
        if (product) {
          this.productForm.patchValue(product);
          // Manejo de variantes y fotos existentes
        }
      });
    }
  }

  // --- Gestión de Variantes ---
  addVariant(type: 'color' | 'size' | 'material') {
    if (this.hasVariants) return; // Solo permite un tipo de atributo

    this.productForm.get('price')?.setValue(0, { emitEvent: false });
    this.productForm.get('stock')?.setValue(0, { emitEvent: false });
    this.productForm.get('sku')?.setValue('', { emitEvent: false });

    this.addVariantOption(type);
  }

  addVariantOption(type: string) {
    const newId = Date.now().toString();
    const index = this.variants.length + 1;
    let name = `Opción ${index}`;
    let colorHex: string | null = null;

    if (type === 'color') {
      name = `Color ${index}`;
      colorHex = '#000000';
    } else if (type === 'size') {
      name = `Talla ${index}`;
    }

    this.variants.push(this.fb.group({
      id: [newId],
      type: [type],
      name: [name, Validators.required],
      colorHex: [colorHex],
      sku: ['', Validators.required],
      price: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      status: ['active', Validators.required]
    }));
  }

  removeVariant(index: number) {
    if (this.variants.length > 1) {
      this.variants.removeAt(index);
    }
  }

  removeAllVariants() {
    this.variants.clear();
    this.productForm.get('price')?.setValue(null);
    this.productForm.get('stock')?.setValue(null);
    this.productForm.get('sku')?.setValue('');
  }

  // --- Gestión de Categorías ---
  private loadCategories() {
    this.categoriesService.getCategories().subscribe(cats => {
      this.categories = this.flattenCategories(cats);
    });
  }

  private flattenCategories(categories: Category[], prefix = ''): Category[] {
    return categories.reduce((acc, category) => {
      const newCategory = { ...category, name: `${prefix}${category.name}` };
      acc.push(newCategory);
      if (category.children) {
        acc.push(...this.flattenCategories(category.children, `${prefix}- `));
      }
      return acc;
    }, [] as Category[]);
  }

  async openCategorySelectionModal(isEditing: boolean = false) {
    const modal = await this.modalCtrl.create({
      component: SelectCategoryModalComponent,
      componentProps: isEditing ? { initialPath: this.selectedCategoryPath } : undefined
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data?.length) {
      this.selectedCategoryPath = data;
      this.productForm.get('categoryId')?.setValue(data[data.length - 1].id);
    } else if (role === 'confirm') {
      this.selectedCategoryPath = [];
      this.productForm.get('categoryId')?.setValue(null);
    }
    this.cdr.markForCheck();
  }

  // --- Gestión de Imágenes ---
  async onFileSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) this.handleFiles(Array.from(files));
  }

  async takePicture() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      if (image.webPath) {
        const blob = await (await fetch(image.webPath)).blob();
        const file = new File([blob], `photo_${Date.now()}.jpeg`, { type: 'image/jpeg' });
        this.handleFiles([file]);
      }
    } catch (error) {
      console.error('Error taking picture', error);
    }
  }

  private handleFiles(files: File[]) {
    if (this.isUploading) return;
    files.forEach(file => {
      const fileWrapper: ImageFile = {
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
        progress: 0
      };
      this.imageFiles.push(fileWrapper);
      this.uploadFile(fileWrapper);
    });
  }

  private async uploadFile(fileWrapper: ImageFile) {
    this.isUploading = true;
    fileWrapper.uploading = true;
    try {
      const user = await firstValueFrom(this.authService.user$);
      if (!user) throw new Error('User not authenticated');

      const result = await this.productsService.uploadTempImage(
        fileWrapper.file, user.uid, (progress) => fileWrapper.progress = progress
      );
      fileWrapper.tempPath = result.path;

      const photos = this.productForm.get('photos') as FormArray;
      photos.push(this.fb.control({
        name: fileWrapper.file.name,
        path: result.path,
        url: result.url || '',
        type: fileWrapper.file.type,
        processing: true,
      } as NewPhoto));
    } catch (error) {
      console.error('Error uploading image:', error);
      this.imageFiles = this.imageFiles.filter(fw => fw !== fileWrapper);
    } finally {
      fileWrapper.uploading = false;
      this.isUploading = this.imageFiles.some(f => f.uploading);
      this.cdr.markForCheck();
    }
  }

  async removeImage(index: number) {
    const fileWrapper = this.imageFiles[index];
    if (fileWrapper.tempPath) {
      try {
        await this.productsService.deleteTempImage(fileWrapper.tempPath);
        const photos = this.productForm.get('photos') as FormArray;
        const photoIndex = photos.controls.findIndex(c => c.value.path === fileWrapper.tempPath);
        if (photoIndex > -1) photos.removeAt(photoIndex);
      } catch (error) {
        console.error('Error deleting temp image', error);
      } finally {
        this.cdr.markForCheck();

      }
    }
    this.imageFiles.splice(index, 1);
  }

  // --- Guardado del Producto ---
  async saveProduct() {
    if (this.productForm.invalid || this.isUploading) {
      this.presentToast('Por favor, completa el formulario y espera a que terminen de subirse las imágenes.', 'warning');
      return;
    }

    try {
      const productData = this.productForm.value;

      // Contar variantes pausadas
      if (productData.variants && productData.variants.length > 0) {
        productData.pausedVariantsCount = productData.variants.filter(
          (variant: { status: string }) => variant.status === 'paused'
        ).length;
      } else {
        productData.pausedVariantsCount = 0;
      }

      if (this.isEditMode && this.productId) {
        await this.productsService.updateProduct(this.productId, productData);
        this.presentToast('Producto actualizado con éxito', 'success');
      } else {
        await this.productsService.addProduct({ ...productData, processing: true });
        this.presentToast('Producto creado con éxito. Se está procesando.', 'success');
        console.log(productData)
      }
      this.router.navigate(['/products']);
    } catch (error) {
      console.error('Error saving product:', error);
      this.presentToast('Error al guardar el producto', 'danger');
    }
  }

  // --- Utilidades ---
  trackById(index: number, item: { value: { id: string } }): string {
    return item.value.id;
  }

  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    toast.present();
  }
}
