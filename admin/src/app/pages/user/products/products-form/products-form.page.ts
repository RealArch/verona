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
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline, add, informationCircleOutline, folderOutline, optionsOutline, colorPaletteOutline, resizeOutline, closeOutline, layersOutline, close, cubeOutline, documentTextOutline, warningOutline, checkmarkOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { QuillModule } from 'ngx-quill';
import { firstValueFrom, Subscription } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';

import { AuthService } from 'src/app/services/auth.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoriesService } from 'src/app/services/categories.service';
import { NewPhoto, ProductPhoto } from 'src/app/interfaces/product-photo';
import { SelectCategoryModalComponent } from './select-category/select-category-modal.component';
import { Category } from 'src/app/interfaces/category';

// Interfaces simplificadas
interface ImageFile {
  file: File;
  previewUrl: string;
  uploading: boolean;
  progress: number;
  tempPath?: string;
}

interface ExistingImage {
  photo: ProductPhoto;
  index: number;
  previewUrl: string;
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
  existingImages: ExistingImage[] = [];
  imagesToDelete: ProductPhoto[] = []; // Objetos completos de imágenes a eliminar
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
    addIcons({ save, cameraOutline, addCircleOutline, trashOutline, folderOutline, informationCircleOutline, documentTextOutline, layersOutline, optionsOutline, add, colorPaletteOutline, resizeOutline, closeOutline, close, cloudUploadOutline, folderOpenOutline, cubeOutline, warningOutline, checkmarkOutline });
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
      slug: ['', [Validators.required]], // Auto-generated from name
      description: [''],
      price: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      sku: [''],
      categoryId: [null, Validators.required],
      status: ['active', Validators.required],
      photos: this.fb.array([]),
      variants: this.fb.array([]),
    });

    // Suscripción para generar slug automáticamente cuando cambia el nombre
    this.productForm.get('name')?.valueChanges.pipe(debounceTime(300)).subscribe(name => {
      if (name && name.trim()) {
        const slug = this.generateSlug(name);
        this.productForm.get('slug')?.setValue(slug, { emitEvent: false });
      }
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
        .pipe(take(1))
        .subscribe(product => {
          if (product) {
            // Si el producto no tiene slug, generarlo desde el nombre
            if (!product.slug && product.name) {
              product.slug = this.generateSlug(product.name);
            }
            
            this.productForm.patchValue(product);

            // Cargar imágenes existentes
            if (product.photos && product.photos.length > 0) {
              this.existingImages = product.photos.map((photo, index) => ({
                photo,
                index,
                previewUrl: photo.medium?.url || photo.large?.url || photo.small?.url || ''
              }));
            }

            // Cargar categoría seleccionada
            if (product.categoryId) {
              this.loadCategoryPath(product.categoryId);
            }

            // Cargar variantes existentes si las hay
            if (product.variants && product.variants.length > 0) {
              const variantsArray = this.productForm.get('variants') as FormArray;
              variantsArray.clear();

              product.variants.forEach(variant => {
                variantsArray.push(this.fb.group({
                  id: [variant.id],
                  type: [this.getVariantType(variant)],
                  name: [variant.name, Validators.required],
                  colorHex: [variant.colorHex || null],
                  sku: [variant.sku || '', Validators.required],
                  price: [variant.price, [Validators.required, Validators.min(0)]],
                  stock: [variant.stock, [Validators.required, Validators.min(0)]],
                  status: [variant.status || 'active', Validators.required]
                }));
              });
            }

            this.cdr.markForCheck();
          }
        });
    }
  }

  private getVariantType(variant: any): string {
    // Lógica para determinar el tipo de variante basado en los datos
    if (variant.colorHex) return 'color';
    if (variant.name && (variant.name.toLowerCase().includes('talla') || variant.name.toLowerCase().includes('size'))) return 'size';
    return 'material'; // por defecto
  }

  private loadCategoryPath(categoryId: string) {
    // Buscar la categoría y construir el path
    this.categoriesService.getCategories().subscribe(categories => {
      const flatCategories = this.flattenCategories(categories);
      const category = flatCategories.find(cat => cat.id === categoryId);
      if (category) {
        this.selectedCategoryPath = this.buildCategoryPath(category, flatCategories);
        this.cdr.markForCheck();
      }
    });
  }

  private buildCategoryPath(category: Category, allCategories: Category[]): Category[] {
    const path: Category[] = [];
    let current: Category | null = category;

    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = allCategories.find(cat => cat.id === current?.parentId) || null;
      } else {
        break;
      }
    }

    return path;
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
      status: ['active', Validators.required],
      totalSales:[0]
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

  removeExistingImage(index: number) {
    const existingImage = this.existingImages[index];
    if (existingImage) {
      // Agregar el objeto completo de la imagen a la lista de eliminación
      this.imagesToDelete.push(existingImage.photo);

      // Eliminar la imagen del array visualmente
      this.existingImages.splice(index, 1);
      this.cdr.markForCheck();
    }
  }

  // --- Guardado del Producto ---
  async saveProduct() {
    if (this.productForm.invalid || this.isUploading) {
      this.presentToast('Por favor, completa el formulario y espera a que terminen de subirse las imágenes.', 'warning');
      return;
    }

    try {
      // Obtener solo los campos que existen en el formulario
      const formData = this.getFormData();

      if (this.isEditMode && this.productId) {
        await this.productsService.updateProduct(this.productId, formData);
        this.presentToast('Producto actualizado con éxito', 'success');
      } else {
        formData.totalSales = 0
        await this.productsService.addProduct({ ...formData, processing: true });
        this.presentToast('Producto creado con éxito. Se está procesando.', 'success');
        console.log(formData)
      }
      this.router.navigate(['/products']);
    } catch (error) {
      console.error('Error saving product:', error);
      this.presentToast('Error al guardar el producto', 'danger');
    }
  }

  private getFormData() {
    // Obtener solo los valores de los campos del formulario
    const formFields = {
      name: this.productForm.get('name')?.value,
      slug: this.productForm.get('slug')?.value,
      description: this.productForm.get('description')?.value,
      price: this.productForm.get('price')?.value,
      stock: this.productForm.get('stock')?.value,
      sku: this.productForm.get('sku')?.value,
      categoryId: this.productForm.get('categoryId')?.value,
      status: this.productForm.get('status')?.value,
    };

    // Manejar fotos
    let photos = this.productForm.get('photos')?.value || [];
    if (this.isEditMode) {
      // Para modo edición, combinar imágenes existentes restantes con nuevas fotos
      const remainingPhotos = this.existingImages.map(img => img.photo);
      photos = [...remainingPhotos, ...photos];
    }

    // Manejar variantes
    const variants = this.productForm.get('variants')?.value || [];

    // Construir el objeto final con campos adicionales calculados
    const productData: any = {
      ...formFields,
      photos,
      variants,
      // Contar variantes pausadas
      pausedVariantsCount: variants.length > 0 ?
        variants.filter((variant: { status: string }) => variant.status === 'paused').length : 0
    };

    // Agregar imagesToDelete solo si hay imágenes para eliminar (modo edición)
    if (this.isEditMode && this.imagesToDelete.length > 0) {
      productData.imagesToDelete = [...this.imagesToDelete];
    }

    return productData;
  }

  // --- Utilidades ---
  trackById(index: number, item: { value: { id: string } }): string {
    return item.value.id;
  }

  getActiveImages(): ExistingImage[] {
    return this.existingImages; // Ya no hay imágenes marcadas, solo las que quedan en el array
  }

  getMarkedForDeletionCount(): number {
    // El conteo se basa directamente en la longitud del array de objetos
    return this.imagesToDelete.length;
  }

  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    toast.present();
  }

  // Generate URL-friendly slug from text
  private generateSlug(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
}
