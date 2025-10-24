import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline, add, informationCircleOutline, folderOutline, optionsOutline, colorPaletteOutline, resizeOutline, closeOutline, layersOutline, close, cubeOutline, documentTextOutline, warningOutline, checkmarkOutline, textOutline, toggleOutline } from 'ionicons/icons';
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
  private modalCtrl = inject(ModalController);

  // Propiedades del componente
  productForm!: FormGroup;
  
  // Signals para propiedades reactivas
  isEditMode = signal(false);
  productId = signal<string | null>(null);
  categories = signal<Category[]>([]);
  selectedCategoryPath = signal<Category[]>([]);
  imageFiles = signal<ImageFile[]>([]);
  existingImages = signal<ExistingImage[]>([]);
  imagesToDelete = signal<ProductPhoto[]>([]);
  isUploading = signal(false);
  productType = signal<'individual' | 'variants'>('individual');
  
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
    addIcons({save,cameraOutline,addCircleOutline,trashOutline,folderOutline,textOutline,
      layersOutline,cubeOutline,informationCircleOutline,optionsOutline,add,closeOutline,
      documentTextOutline,toggleOutline,colorPaletteOutline,resizeOutline,close,
      cloudUploadOutline,folderOpenOutline,warningOutline,checkmarkOutline});
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
      // Prevenir activar precios dinámicos del producto principal si hay variantes
      if (hasDynamicPricing && this.hasVariants) {
        // Revertir el cambio y mostrar mensaje
        this.productForm.get('hasDynamicPricing')?.setValue(false, { emitEvent: false });
        this.presentToast('No se pueden activar precios dinámicos del producto cuando hay variantes activas. Usa precios dinámicos por variante.', 'warning');
        return;
      }

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
        // Al desactivar precios dinámicos, verificar si hay variantes para decidir si habilitar el precio base
        if (!this.hasVariants) {
          // Solo habilitar el campo de precio base si no hay variantes
          priceControl?.enable();
          // Restaurar validadores del precio base
          priceControl?.setValidators([Validators.required, Validators.min(0)]);
        } else {
          // Si hay variantes, mantener el campo deshabilitado
          priceControl?.disable();
          priceControl?.clearValidators();
        }
        priceControl?.updateValueAndValidity();
        // Limpiar rangos de precios dinámicos
        this.clearDynamicPrices();
      }
    });
  }

  private checkEditMode() {
    this.productId.set(this.route.snapshot.paramMap.get('id'));
    if (this.productId()) {
      this.isEditMode.set(true);
      this.productsService.getProduct(this.productId()!)
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
              this.existingImages.set(product.photos.map((photo, index) => ({
                photo,
                index,
                previewUrl: photo.medium?.url || photo.large?.url || photo.small?.url || ''
              })));
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
                const hasDynamicPricing = variant.hasDynamicPricing || false;
                
                const variantGroup = this.fb.group({
                  id: [variant.id],
                  type: [this.getVariantType(variant)],
                  name: [variant.name, Validators.required],
                  colorHex: [variant.colorHex || null],
                  sku: [variant.sku || ''],
                  price: hasDynamicPricing ? 
                    [{ value: null, disabled: true }] : // Si tiene precios dinámicos, bloquear
                    [variant.price, [Validators.required, Validators.min(0)]], // Si no, habilitar con valor existente
                  stock: [variant.stock, [Validators.required, Validators.min(0)]],
                  status: [variant.status || 'active', Validators.required],
                  hasDynamicPricing: [hasDynamicPricing],
                  dynamicPrices: this.fb.array([])
                });

                // Cargar precios dinámicos de variante si existen Y están activados
                if (hasDynamicPricing && variant.dynamicPrices && variant.dynamicPrices.length > 0) {
                  const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
                  
                  variant.dynamicPrices.forEach((priceRange, index) => {
                    const isFirstRange = index === 0;
                    const rangeGroup = this.fb.group({
                      id: [priceRange.id || Date.now().toString()],
                      minQuantity: [
                        { value: priceRange.minQuantity, disabled: isFirstRange },
                        [Validators.required, Validators.min(1)]
                      ],
                      price: [priceRange.price, [Validators.required, Validators.min(0)]]
                    });
                    
                    dynamicPricesArray.push(rangeGroup);

                    // Agregar suscripción para auto-ajustar valores
                    if (!isFirstRange) {
                      rangeGroup.get('minQuantity')?.valueChanges.pipe(debounceTime(300)).subscribe(value => {
                        if (value !== null && value !== undefined) {
                          const variantIndex = variantsArray.controls.indexOf(variantGroup);
                          this.adjustVariantMinQuantityValues(variantIndex, index);
                        }
                      });
                    }
                  });
                }

                // Suscripción para toggle de precios dinámicos
                variantGroup.get('hasDynamicPricing')?.valueChanges.subscribe(hasDynamicPricing => {
                  const variantIndex = variantsArray.controls.indexOf(variantGroup);
                  this.toggleVariantDynamicPricing(variantIndex, !!hasDynamicPricing);
                });

                variantsArray.push(variantGroup);
              });

              // Si hay variantes cargadas, asegurar que los campos del producto principal estén bloqueados
              this.productForm.get('price')?.disable();
              this.productForm.get('sku')?.disable();
              
              // Si hay variantes cargadas y precios dinámicos del producto están activos, desactivarlos
              if (product.hasDynamicPricing) {
                this.productForm.get('hasDynamicPricing')?.setValue(false, { emitEvent: true });
                console.warn('Precios dinámicos del producto desactivados automáticamente debido a la presencia de variantes.');
              }
              
              // Establecer tipo de producto como 'variants'
              this.productType.set('variants');
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
                    [Validators.required, Validators.min(1), this.minQuantityValidator.bind(this)]
                  ],
                  price: [priceRange.price, [Validators.required, Validators.min(0)]]
                });
                
                dynamicPricesArray.push(rangeGroup);

                // Agregar suscripción para auto-ajustar valores cuando cambien
                if (!isFirstRange) {
                  rangeGroup.get('minQuantity')?.valueChanges.pipe(debounceTime(300)).subscribe(value => {
                    if (value !== null && value !== undefined) {
                      this.adjustMinQuantityValues(index);
                    }
                  });
                }
              });
            }

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
        this.selectedCategoryPath.set(this.buildCategoryPath(category, flatCategories));
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

  // --- Gestión de Tipo de Producto ---
  changeProductType(type: 'individual' | 'variants') {
    this.productType.set(type);
    
    if (type === 'individual') {
      // Limpiar y reiniciar valores para modo individual
      this.resetToIndividualMode();
    } else if (type === 'variants') {
      // Limpiar y reiniciar valores para modo variantes
      this.resetToVariantsMode();
    }
  }

  private resetToIndividualMode() {
    this.clearAllVariants();
    this.setProductFieldsState(true, null, '', 0);
    this.productForm.get('hasDynamicPricing')?.setValue(false);
    this.clearDynamicPrices();
  }

  private resetToVariantsMode() {
    this.productForm.get('hasDynamicPricing')?.setValue(false);
    this.clearDynamicPrices();
    this.setProductFieldsState(false, null, '', 0);
    this.clearAllVariants();
  }

  private setProductFieldsState(enabled: boolean, priceValue: any, skuValue: string, stockValue: number) {
    const priceControl = this.productForm.get('price');
    const skuControl = this.productForm.get('sku');
    
    enabled ? priceControl?.enable() : priceControl?.disable();
    enabled ? skuControl?.enable() : skuControl?.disable();
    
    priceControl?.setValue(priceValue);
    skuControl?.setValue(skuValue);
    this.productForm.get('stock')?.setValue(stockValue);
  }

  private clearAllVariants() { this.variants.clear(); }

  // --- Gestión de Variantes ---
  addVariant(type: 'color' | 'size' | 'material') {
    if (this.hasVariants) return; // Solo permite un tipo de atributo
    
    // Cambiar automáticamente a tipo 'variants'
    this.productType.set('variants');

    // Desactivar precios dinámicos del producto principal cuando se activan variantes
    if (this.hasDynamicPricing) {
      this.productForm.get('hasDynamicPricing')?.setValue(false, { emitEvent: true });
    }

    // Bloquear campos del producto principal cuando hay variantes
    this.productForm.get('price')?.setValue(null, { emitEvent: false });
    this.productForm.get('price')?.disable();
    this.productForm.get('stock')?.setValue(0, { emitEvent: false });
    this.productForm.get('sku')?.setValue('', { emitEvent: false });
    this.productForm.get('sku')?.disable();

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

    const variantGroup = this.fb.group({
      id: [newId],
      type: [type],
      name: [name, Validators.required],
      colorHex: [colorHex],
      sku: [''],
      price: [null, [Validators.required, Validators.min(0)]], // Precio habilitado por defecto
      stock: [null, [Validators.required, Validators.min(0)]],
      status: ['active', Validators.required],
      totalSales: [0],
      hasDynamicPricing: [false], // No activar precios dinámicos por defecto
      dynamicPrices: this.fb.array([])
    });

    this.variants.push(variantGroup);

    // Suscripción para manejar precios dinámicos en variantes
    const variantIndex = this.variants.length - 1;
    variantGroup.get('hasDynamicPricing')?.valueChanges.subscribe(hasDynamicPricing => {
      this.toggleVariantDynamicPricing(variantIndex, !!hasDynamicPricing);
    });
  }

  removeVariant(index: number) {
    if (this.variants.length > 1) {
      this.variants.removeAt(index);
      
      // Si después de eliminar una variante no quedan más, rehabilitar campos del producto principal
      if (this.variants.length === 0) {
        this.productForm.get('price')?.enable();
        this.productForm.get('price')?.setValue(null);
        this.productForm.get('sku')?.enable();
        this.productForm.get('price')?.setValidators([Validators.required, Validators.min(0)]);
        this.productForm.get('price')?.updateValueAndValidity();
      }
    }
  }

  removeAllVariants() {
    this.variants.clear();
    
    // Rehabilitar los campos del producto principal
    this.productForm.get('price')?.enable();
    this.productForm.get('price')?.setValue(null);
    this.productForm.get('sku')?.enable();
    this.productForm.get('sku')?.setValue('');
    this.productForm.get('stock')?.setValue(null);
    
    // Restaurar validadores del precio base
    this.productForm.get('price')?.setValidators([Validators.required, Validators.min(0)]);
    this.productForm.get('price')?.updateValueAndValidity();
    
    // Cuando se eliminan todas las variantes, permitir nuevamente precios dinámicos del producto principal
  }

  // --- Gestión de Precios Dinámicos ---
  addInitialDynamicPriceRanges() {
    // Agregar dos rangos iniciales automáticamente
    this.addDynamicPriceRangeWithValues(1, null); // Primer rango: desde 1 unidad
    this.addDynamicPriceRangeWithValues(10, null); // Segundo rango: desde 10 unidades
  }

  addDynamicPriceRange() {
    const currentRanges = this.dynamicPrices.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
    let minQuantity = 1;
    
    // Si hay rangos existentes, calcular la siguiente cantidad mínima
    if (currentRanges.length > 0) {
      // Ordenar por minQuantity y tomar el último + 1
      const sortedRanges = currentRanges.sort((a, b) => a.minQuantity - b.minQuantity);
      const lastRange = sortedRanges[sortedRanges.length - 1];
      minQuantity = lastRange.minQuantity + 1;
    }

    this.addDynamicPriceRangeWithValues(minQuantity, null);
  }



  private addDynamicPriceRangeWithValues(minQuantity: number, price: number | null) {
    this.createPriceRange(this.dynamicPrices, minQuantity, price, 
      (index) => this.adjustMinQuantityValues(index));
  }

  // Validador para asegurar que minQuantity sea mayor que el anterior
  private minQuantityValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value || control.disabled) {
      return null; // No validar si está vacío o deshabilitado
    }

    const currentIndex = this.dynamicPrices.controls.findIndex(c => c === control.parent);
    if (currentIndex <= 0) {
      return null; // No validar el primer elemento
    }

    const previousRange = this.dynamicPrices.at(currentIndex - 1).getRawValue();
    if (control.value <= previousRange.minQuantity) {
      return { minQuantityTooLow: true };
    }

    return null;
  }



  // Validar que cada minQuantity sea mayor que el anterior
  validateDynamicPricesRanges(): boolean {
    // Usar getRawValue() para incluir campos deshabilitados
    const ranges = this.dynamicPrices.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
    
    // Ordenar por minQuantity para verificar secuencia
    const sortedRanges = ranges.sort((a, b) => a.minQuantity - b.minQuantity);
    
    for (let i = 1; i < sortedRanges.length; i++) {
      const currentRange = sortedRanges[i];
      const previousRange = sortedRanges[i - 1];
      
      // Verificar que el minQuantity actual sea mayor que el anterior
      if (currentRange.minQuantity <= previousRange.minQuantity) {
        return false; // minQuantity no es mayor que el anterior
      }
    }
    
    return true; // Secuencia correcta
  }

  // Métodos unificados para manejo de rangos
  removeDynamicPriceRange(index: number) { if (index >= 2) this.dynamicPrices.removeAt(index); }
  canRemoveDynamicPriceRange(index: number): boolean { return index >= 2; }
  clearDynamicPrices() { this.dynamicPrices.clear(); }
  
  removeVariantDynamicPriceRange(variantIndex: number, rangeIndex: number) {
    if (rangeIndex >= 2) {
      const variantGroup = this.variants.at(variantIndex);
      const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
      dynamicPricesArray.removeAt(rangeIndex);
    }
  }
  canRemoveVariantDynamicPriceRange(rangeIndex: number): boolean { return rangeIndex >= 2; }

  // Métodos para manejar precios dinámicos en variantes
  toggleVariantDynamicPricing(variantIndex: number, hasDynamicPricing: boolean) {
    const variantGroup = this.variants.at(variantIndex);
    const priceControl = variantGroup.get('price');
    const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;

    if (hasDynamicPricing) {
      // Deshabilitar precio base y usar precios dinámicos
      priceControl?.setValue(null, { emitEvent: false });
      priceControl?.disable();
      priceControl?.clearValidators();
      priceControl?.updateValueAndValidity();
      
      if (dynamicPricesArray.length === 0) {
        this.addVariantDynamicPriceRange(variantIndex);
        this.addVariantDynamicPriceRange(variantIndex);
      }
    } else {
      // Habilitar precio base para precio fijo
      priceControl?.enable();
      priceControl?.setValue(null, { emitEvent: false });
      priceControl?.setValidators([Validators.required, Validators.min(0)]);
      priceControl?.updateValueAndValidity();
      
      // Limpiar rangos de precios dinámicos
      dynamicPricesArray.clear();
    }
  }

  addVariantDynamicPriceRange(variantIndex: number) {
    const variantGroup = this.variants.at(variantIndex);
    const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
    
    const currentRanges = dynamicPricesArray.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
    let minQuantity = 1;
    
    if (currentRanges.length > 0) {
      const sortedRanges = currentRanges.sort((a, b) => a.minQuantity - b.minQuantity);
      const lastRange = sortedRanges[sortedRanges.length - 1];
      minQuantity = currentRanges.length === 1 ? 10 : lastRange.minQuantity + 1;
    } else {
      minQuantity = currentRanges.length === 0 ? 1 : 10;
    }

    this.addVariantDynamicPriceRangeWithValues(variantIndex, minQuantity, null);
  }

  private addVariantDynamicPriceRangeWithValues(variantIndex: number, minQuantity: number, price: number | null) {
    const variantGroup = this.variants.at(variantIndex);
    const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
    this.createPriceRange(dynamicPricesArray, minQuantity, price, 
      (index) => this.adjustVariantMinQuantityValues(variantIndex, index));
  }



  private adjustVariantMinQuantityValues(variantIndex: number, changedIndex: number) {
    if (changedIndex === 0) return;
    const variantGroup = this.variants.at(variantIndex);
    const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
    this.adjustPriceSequence(dynamicPricesArray.controls, changedIndex);
  }



  getVariantDynamicPrices(variantIndex: number): FormArray {
    const variantGroup = this.variants.at(variantIndex);
    return variantGroup.get('dynamicPrices') as FormArray;
  }

  hasVariantDynamicPricing(variantIndex: number): boolean {
    const variantGroup = this.variants.at(variantIndex);
    return variantGroup.get('hasDynamicPricing')?.value || false;
  }

  private adjustMinQuantityValues(changedIndex: number) {
    if (changedIndex === 0) return;
    this.adjustPriceSequence(this.dynamicPrices.controls, changedIndex);
  }

  // Método para ajustar valores subsecuentes
  // Método unificado para crear rangos de precios
  private createPriceRange(formArray: FormArray, minQuantity: number, price: number | null, 
                          adjustCallback: (index: number) => void) {
    const isFirstRange = formArray.length === 0;
    const validators = isFirstRange ? 
      [Validators.required, Validators.min(1), this.minQuantityValidator.bind(this)] :
      [Validators.required, Validators.min(1)];
    
    const newRange = this.fb.group({
      id: [Date.now().toString() + '_' + formArray.length],
      minQuantity: [{ value: minQuantity, disabled: isFirstRange }, validators],
      price: [price, [Validators.required, Validators.min(0)]]
    });

    formArray.push(newRange);

    if (!isFirstRange) {
      const currentIndex = formArray.length - 1;
      newRange.get('minQuantity')?.valueChanges.pipe(debounceTime(300)).subscribe(value => {
        if (value !== null && value !== undefined) adjustCallback(currentIndex);
      });
    }
  }

  // Método unificado para ajustar secuencias de precios
  private adjustPriceSequence(controls: AbstractControl[], startIndex: number) {
    for (let i = Math.max(1, startIndex); i < controls.length; i++) {
      const currentControl = controls[i].get('minQuantity');
      const previousControl = controls[i - 1]?.get('minQuantity');
      
      if (currentControl && previousControl && !currentControl.disabled) {
        const previousValue = previousControl.disabled ? previousControl.value : previousControl.getRawValue();
        const currentValue = currentControl.value;
        
        if (currentValue <= previousValue) {
          const newValue = previousValue + 1;
          currentControl.setValue(newValue, { emitEvent: false });
        }
      }
    }
  }

  // --- Gestión de Categorías ---
  private loadCategories() {
    this.categoriesService.getCategories().subscribe(cats => {
      this.categories.set(this.flattenCategories(cats));
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
      componentProps: isEditing ? { initialPath: this.selectedCategoryPath() } : undefined
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data?.length) {
      this.selectedCategoryPath.set(data);
      this.productForm.get('categoryId')?.setValue(data[data.length - 1].id);
    } else if (role === 'confirm') {
      this.selectedCategoryPath.set([]);
      this.productForm.get('categoryId')?.setValue(null);
    }
  }

  // --- Gestión de Imágenes ---
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files) {
      this.handleFiles(Array.from(files));
      // Limpiar el valor del input para permitir seleccionar la misma imagen de nuevo
      input.value = '';
    }
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
    if (this.isUploading()) return;
    files.forEach(file => {
      const fileWrapper: ImageFile = {
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
        progress: 0
      };
      this.imageFiles.update(files => [...files, fileWrapper]);
      this.uploadFile(fileWrapper);
    });
  }

  private async uploadFile(fileWrapper: ImageFile) {
    this.isUploading.set(true);
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
      this.imageFiles.update(files => files.filter(fw => fw !== fileWrapper));
    } finally {
      fileWrapper.uploading = false;
      this.isUploading.set(this.imageFiles().some(f => f.uploading));
    }
  }

  async removeImage(index: number) {
    const files = this.imageFiles();
    const fileWrapper = files[index];
    if (fileWrapper.tempPath) {
      try {
        await this.productsService.deleteTempImage(fileWrapper.tempPath);
        const photos = this.productForm.get('photos') as FormArray;
        const photoIndex = photos.controls.findIndex(c => c.value.path === fileWrapper.tempPath);
        if (photoIndex > -1) photos.removeAt(photoIndex);
      } catch (error) {
        console.error('Error deleting temp image', error);
      }
    }
    this.imageFiles.update(files => files.filter((_, i) => i !== index));
  }

  removeExistingImage(index: number) {
    const existingImages = this.existingImages();
    const existingImage = existingImages[index];
    if (existingImage) {
      // Agregar el objeto completo de la imagen a la lista de eliminación
      this.imagesToDelete.update(images => [...images, existingImage.photo]);

      // Eliminar la imagen del array visualmente
      this.existingImages.update(images => images.filter((_, i) => i !== index));
    }
  }

  // --- Guardado del Producto ---
  async saveProduct() {
    if (this.productForm.invalid || this.isUploading()) {
      this.presentToast('Por favor, completa el formulario y espera a que terminen de subirse las imágenes.', 'warning');
      return;
    }

    // Validaciones específicas para precios dinámicos del producto
    if (this.hasDynamicPricing) {
      if (this.dynamicPrices.length === 0) {
        this.presentToast('Debes agregar al menos un rango de precios dinámicos.', 'warning');
        return;
      }

      if (!this.validateDynamicPricesRanges()) {
        this.presentToast('Cada cantidad "Desde" debe ser mayor que la anterior.', 'warning');
        return;
      }

      // Verificar que el primer rango empiece desde 1
      const ranges = this.dynamicPrices.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
      const sortedRanges = ranges.sort((a, b) => a.minQuantity - b.minQuantity);
      if (sortedRanges[0].minQuantity !== 1) {
        this.presentToast('El primer rango de cantidad debe empezar desde 1.', 'warning');
        return;
      }
    }

    // Validaciones para variantes
    const variantsArray = this.productForm.get('variants') as FormArray;
    for (let i = 0; i < variantsArray.length; i++) {
      const variantGroup = variantsArray.at(i);
      const hasDynamicPricing = variantGroup.get('hasDynamicPricing')?.value;
      
      if (hasDynamicPricing) {
        // Si tiene precios dinámicos, validar rangos
        const dynamicPricesArray = variantGroup.get('dynamicPrices') as FormArray;
        
        if (dynamicPricesArray.length === 0) {
          this.presentToast(`La variante "${variantGroup.get('name')?.value}" debe tener al menos un rango de precios dinámicos.`, 'warning');
          return;
        }

        // Validar secuencia de precios dinámicos de la variante
        const variantRanges = dynamicPricesArray.controls.map(control => control.getRawValue()) as DynamicPriceRange[];
        const sortedVariantRanges = variantRanges.sort((a, b) => a.minQuantity - b.minQuantity);
        
        if (sortedVariantRanges[0].minQuantity !== 1) {
          this.presentToast(`El primer rango de la variante "${variantGroup.get('name')?.value}" debe empezar desde 1.`, 'warning');
          return;
        }

        // Validar secuencia creciente
        for (let j = 1; j < sortedVariantRanges.length; j++) {
          if (sortedVariantRanges[j].minQuantity <= sortedVariantRanges[j - 1].minQuantity) {
            this.presentToast(`Los rangos de la variante "${variantGroup.get('name')?.value}" deben tener una secuencia creciente.`, 'warning');
            return;
          }
        }
      } else {
        // Si no tiene precios dinámicos, validar que tenga precio fijo
        const priceValue = variantGroup.get('price')?.value;
        if (!priceValue || priceValue <= 0) {
          this.presentToast(`La variante "${variantGroup.get('name')?.value}" debe tener un precio válido.`, 'warning');
          return;
        }
      }
    }

    try {
      // Obtener solo los campos que existen en el formulario
      const formData = this.getFormData();

      if (this.isEditMode() && this.productId()) {
        await this.productsService.updateProduct(this.productId()!, formData);
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
      plain_description: this.stripHtml(this.productForm.get('description')?.value || ''),
      price: this.productForm.get('price')?.value,
      stock: this.productForm.get('stock')?.value,
      sku: this.productForm.get('sku')?.value,
      categoryId: this.productForm.get('categoryId')?.value,
      status: this.productForm.get('status')?.value,
      hasDynamicPricing: this.productForm.get('hasDynamicPricing')?.value,
    };

    // Manejar fotos
    let photos = this.productForm.get('photos')?.value || [];
    if (this.isEditMode()) {
      // Para modo edición, combinar imágenes existentes restantes con nuevas fotos
      const remainingPhotos = this.existingImages().map(img => img.photo);
      photos = [...remainingPhotos, ...photos];
    }

    // Manejar variantes - usar getRawValue() para incluir campos deshabilitados
    const variantsArray = this.productForm.get('variants') as FormArray;
    const variants = variantsArray.controls.map(control => {
      const variantData = control.getRawValue();
      
      // Para cada variante, obtener también los precios dinámicos con getRawValue()
      if (variantData.hasDynamicPricing) {
        const dynamicPricesArray = control.get('dynamicPrices') as FormArray;
        variantData.dynamicPrices = dynamicPricesArray.controls.map(priceControl => priceControl.getRawValue());
      }
      
      return variantData;
    }) || [];

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
    if (this.isEditMode() && this.imagesToDelete().length > 0) {
      productData.imagesToDelete = [...this.imagesToDelete()];
    }

    return productData;
  }

  // --- Utilidades ---
  /**
   * Elimina todas las etiquetas HTML y devuelve solo el texto plano
   * @param html Cadena HTML
   * @returns Texto sin etiquetas HTML
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    
    // Crear un elemento temporal para parsear el HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // Obtener solo el texto
    const text = tmp.textContent || tmp.innerText || '';
    
    // Limpiar espacios múltiples y saltos de línea excesivos
    return text
      .replace(/\s+/g, ' ')  // Reemplazar múltiples espacios con uno solo
      .replace(/\n+/g, ' ')  // Reemplazar saltos de línea con espacio
      .trim();               // Eliminar espacios al inicio y final
  }

  trackById(index: number, item: { value: { id: string } }): string { return item.value.id; }
  getActiveImages(): ExistingImage[] { return this.existingImages(); }
  
  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    toast.present();
  }

  private generateSlug(text: string): string {
    return text.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-')
      .replace(/^-+/, '').replace(/-+$/, '');
  }
}
