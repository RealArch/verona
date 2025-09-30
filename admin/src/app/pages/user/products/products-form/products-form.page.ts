import { Component, OnInit, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonSelect, IonSelectOption, IonCheckbox,
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
import { DynamicPriceRange } from 'src/app/interfaces/product';

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
    IonItem, IonLabel, IonInput, IonSelect, IonSelectOption, IonCheckbox,
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

  get dynamicPrices(): FormArray {
    return this.productForm.get('dynamicPrices') as FormArray;
  }

  get primaryAttributeType(): string | null {
    const variants = this.variants.value;
    return variants.length > 0 ? variants[0].type : null;
  }

  get hasVariants(): boolean {
    return this.variants.length > 0;
  }

  get hasDynamicPricing(): boolean {
    return this.productForm.get('hasDynamicPricing')?.value || false;
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
      hasDynamicPricing: [false],
      dynamicPrices: this.fb.array([]),
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

    // Suscripción para manejar el toggle de precios dinámicos
    this.productForm.get('hasDynamicPricing')?.valueChanges.subscribe(hasDynamicPricing => {
      const priceControl = this.productForm.get('price');
      if (hasDynamicPricing) {
        // Deshabilitar el campo de precio base cuando se activan precios dinámicos
        priceControl?.disable();
        // Remover validadores del precio base ya que se maneja por rangos dinámicos
        priceControl?.clearValidators();
        priceControl?.updateValueAndValidity();
        // Agregar dos rangos iniciales automáticamente si no existen
        if (this.dynamicPrices.length === 0) {
          this.addInitialDynamicPriceRanges();
        }
      } else {
        // Habilitar el campo de precio base cuando se desactivan precios dinámicos
        priceControl?.enable();
        // Restaurar validadores del precio base
        priceControl?.setValidators([Validators.required, Validators.min(0)]);
        priceControl?.updateValueAndValidity();
        // Limpiar rangos de precios dinámicos
        this.clearDynamicPrices();
      }
      this.cdr.markForCheck();
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

            // Cargar precios dinámicos existentes si los hay
            if (product.hasDynamicPricing && product.dynamicPrices && product.dynamicPrices.length > 0) {
              const dynamicPricesArray = this.productForm.get('dynamicPrices') as FormArray;
              dynamicPricesArray.clear();

              product.dynamicPrices.forEach((priceRange, index) => {
                const isFirstRange = index === 0;
                const rangeGroup = this.fb.group({
                  id: [priceRange.id || Date.now().toString()],
                  minQuantity: [
                    { value: priceRange.minQuantity, disabled: isFirstRange }, // El primer "desde" está bloqueado
                    [Validators.required, Validators.min(1)]
                  ],
                  maxQuantity: [priceRange.maxQuantity, [Validators.required, Validators.min(1)]],
                  price: [priceRange.price, [Validators.required, Validators.min(0)]]
                });
                
                // Agregar validación de rango
                rangeGroup.setValidators(this.rangeValidator.bind(this));
                dynamicPricesArray.push(rangeGroup);
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

  // --- Gestión de Precios Dinámicos ---
  addInitialDynamicPriceRanges() {
    // Agregar dos rangos iniciales automáticamente
    this.addDynamicPriceRangeWithValues(1, 10, null); // Primer rango: 1-10
    this.addDynamicPriceRangeWithValues(11, 50, null); // Segundo rango: 11-50
  }

  addDynamicPriceRange() {
    const currentRanges = this.dynamicPrices.value as DynamicPriceRange[];
    let minQuantity = 1;
    let maxQuantity = 10;
    
    // Si hay rangos existentes, calcular la siguiente cantidad mínima
    if (currentRanges.length > 0) {
      // Ordenar por maxQuantity y tomar el último
      const sortedRanges = currentRanges.sort((a, b) => a.maxQuantity - b.maxQuantity);
      const lastRange = sortedRanges[sortedRanges.length - 1];
      minQuantity = lastRange.maxQuantity + 1;
      maxQuantity = minQuantity + 9;
    }

    this.addDynamicPriceRangeWithValues(minQuantity, maxQuantity, null);
  }

  private addDynamicPriceRangeWithValues(minQuantity: number, maxQuantity: number, price: number | null) {
    const isFirstRange = this.dynamicPrices.length === 0;
    
    const newRange = this.fb.group({
      id: [Date.now().toString() + '_' + this.dynamicPrices.length],
      minQuantity: [
        { value: minQuantity, disabled: isFirstRange }, // El primer "desde" está bloqueado
        [Validators.required, Validators.min(1)]
      ],
      maxQuantity: [maxQuantity, [Validators.required, Validators.min(1)]],
      price: [price, [Validators.required, Validators.min(0)]]
    });

    // Agregar validación de rango al FormGroup
    newRange.setValidators(this.rangeValidator.bind(this));

    this.dynamicPrices.push(newRange);
  }

  // Validador para asegurar que minQuantity < maxQuantity
  private rangeValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!control.get('minQuantity') || !control.get('maxQuantity')) {
      return null;
    }

    const minQuantity = control.get('minQuantity')!.value;
    const maxQuantity = control.get('maxQuantity')!.value;

    if (minQuantity && maxQuantity && minQuantity >= maxQuantity) {
      return { invalidRange: true };
    }

    return null;
  }

  // Validar que no haya solapamiento entre rangos
  validateDynamicPricesRanges(): boolean {
    // Usar getRawValue() para incluir campos deshabilitados
    const ranges = this.dynamicPrices.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
    
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const range1 = ranges[i];
        const range2 = ranges[j];
        
        // Verificar solapamiento
        if (
          (range1.minQuantity <= range2.maxQuantity && range1.maxQuantity >= range2.minQuantity) ||
          (range2.minQuantity <= range1.maxQuantity && range2.maxQuantity >= range1.minQuantity)
        ) {
          return false; // Hay solapamiento
        }
      }
    }
    
    return true; // No hay solapamiento
  }

  removeDynamicPriceRange(index: number) {
    // Solo permitir eliminar a partir del tercer ítem (índice 2)
    if (index >= 2) {
      this.dynamicPrices.removeAt(index);
    }
  }

  canRemoveDynamicPriceRange(index: number): boolean {
    // Solo permitir eliminar a partir del tercer ítem (índice 2)
    return index >= 2;
  }

  clearDynamicPrices() {
    this.dynamicPrices.clear();
  }

  toggleDynamicPricing() {
    const currentValue = this.productForm.get('hasDynamicPricing')?.value;
    this.productForm.get('hasDynamicPricing')?.setValue(!currentValue);
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

    // Validaciones específicas para precios dinámicos
    if (this.hasDynamicPricing) {
      if (this.dynamicPrices.length === 0) {
        this.presentToast('Debes agregar al menos un rango de precios dinámicos.', 'warning');
        return;
      }

      if (!this.validateDynamicPricesRanges()) {
        this.presentToast('Los rangos de cantidad no pueden solaparse entre sí.', 'warning');
        return;
      }

      // Verificar que el primer rango empiece desde 1
      // Obtenemos el valor raw para incluir campos deshabilitados
      const ranges = this.dynamicPrices.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
      const sortedRanges = ranges.sort((a, b) => a.minQuantity - b.minQuantity);
      if (sortedRanges[0].minQuantity !== 1) {
        this.presentToast('El primer rango de cantidad debe empezar desde 1.', 'warning');
        return;
      }
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
      hasDynamicPricing: this.productForm.get('hasDynamicPricing')?.value,
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

    // Manejar precios dinámicos - usar getRawValue() para incluir campos deshabilitados
    const dynamicPricesArray = this.productForm.get('dynamicPrices') as FormArray;
    const dynamicPrices = dynamicPricesArray.controls.map(control => control.getRawValue()) || [];

    // Construir el objeto final con campos adicionales calculados
    const productData: any = {
      ...formFields,
      photos,
      variants,
      dynamicPrices,
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
