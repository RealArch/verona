import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  ToastController, IonSpinner, IonProgressBar, IonCard, IonCardHeader, IonCardContent, IonCardTitle,
  ModalController, IonPopover, IonList, IonButton, IonIcon, IonRow, IonCol, IonGrid, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline, add, informationCircleOutline, folderOutline, optionsOutline, colorPaletteOutline, resizeOutline, closeOutline, layersOutline, close, cubeOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { AuthService } from 'src/app/services/auth.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoriesService, Category } from 'src/app/services/categories.service';
import { firstValueFrom } from 'rxjs';
import { NewPhoto, ProductPhoto } from 'src/app/interfaces/product-photo';
import { SelectCategoryModalComponent } from './select-category/select-category-modal.component';

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
  imports: [IonModal, IonGrid, IonRow, IonCol, IonIcon, IonButton, IonList, IonPopover, IonCardTitle, IonCardContent, IonCardHeader, IonCard,
    CommonModule, ReactiveFormsModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonButton, IonIcon, IonSpinner, IonProgressBar
  ]
})
export class ProductFormPage implements OnInit {




  private fb = inject(FormBuilder);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  productForm!: FormGroup;
  isEditMode = false;
  productId: string | null = null;
  categories: Category[] = [];
  imageFiles: ImageFile[] = [];
  isUploading = false;

  constructor() {
    addIcons({save,cameraOutline,addCircleOutline,trashOutline,informationCircleOutline,folderOutline,optionsOutline,add,colorPaletteOutline,resizeOutline,closeOutline,layersOutline,close,cloudUploadOutline,folderOpenOutline,cubeOutline}); // Añadir aquí
  }

  ngOnInit() {
    this.initForm();
    this.loadCategories();
    this.checkEditMode();
  }

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
      attributes: this.fb.array([]),
      variants: this.fb.array([]),
    });
  }

  //get product form attributes
  get formAttributes(): FormArray {
    return this.productForm.get('attributes') as FormArray;
  }
  get variants(): FormArray {
  return this.productForm.get('variants') as FormArray;
}
  //VARIANTES
  attributesAdded: string[] = [];
  // Nueva estructura para variaciones anidadas
  nestedVariants: any[] = [];
  showAddPrimaryModal = false;
  showAddSecondaryModalFlag = false;
  currentPrimaryOptionId = '';
  
  // Variables para el modal
  newPrimaryName = '';
  newPrimaryColor = '#000000';
  
  // Obtener el primer atributo (principal)
  get primaryAttribute() {
    return this.attributesAdded.length > 0 ? this.attributesAdded[0] : null;
  }
  
  // Obtener el segundo atributo (anidado)
  get secondaryAttribute() {
    return this.attributesAdded.length > 1 ? this.attributesAdded[1] : null;
  }
  
  // Obtener el tercer atributo
  get tertiaryAttribute() {
    return this.attributesAdded.length > 2 ? this.attributesAdded[2] : null;
  }
  
  // Método para añadir una nueva opción del atributo principal
  addPrimaryOption(name: string, colorHex?: string | null) {
    const newOption = {
      id: Date.now().toString(),
      name: name,
      colorHex: colorHex || null,
      products: [{
        id: Date.now().toString() + '_product',
        sku: '',
        price: null,
        stock: null,
        status: 'active'
      }] // Automáticamente añadir el primer producto
    };
    this.nestedVariants.push(newOption);
    this.cdr.detectChanges(); // Forzar detección de cambios
  }
  
  // Método para añadir un producto a un atributo específico
  addProductToAttribute(attributeId: string) {
    const attribute = this.nestedVariants.find(v => v.id === attributeId);
    if (attribute) {
      const newProduct = {
        id: Date.now().toString(),
        sku: '',
        price: null,
        stock: null,
        status: 'active'
      };
      if (!attribute.products) {
        attribute.products = [];
      }
      attribute.products.push(newProduct);
      this.cdr.detectChanges(); // Forzar detección de cambios
    }
  }
  
  // Método para eliminar un producto de un atributo
  removeProductFromAttribute(attributeId: string, productIndex: number) {
    const attribute = this.nestedVariants.find(v => v.id === attributeId);
    if (attribute && attribute.products && attribute.products.length > 1) {
      attribute.products.splice(productIndex, 1);
      this.cdr.detectChanges(); // Forzar detección de cambios
    }
  }
  
  // Método para verificar si se puede eliminar un producto (debe haber al menos 2)
  canRemoveProduct(attributeId: string): boolean {
    const attribute = this.nestedVariants.find(v => v.id === attributeId);
    const canRemove = attribute && attribute.products ? attribute.products.length > 1 : false;
    return canRemove;
  }
  
  // Función trackBy para mejor performance en ngFor
  trackByAttributeId(index: number, item: any): any {
    return item.id;
  }
  
  trackByProductId(index: number, item: any): any {
    return item.id;
  }
  
  // Método para eliminar una opción principal
  removePrimaryOption(optionId: string) {
    const index = this.nestedVariants.findIndex(v => v.id === optionId);
    if (index > -1) {
      this.nestedVariants.splice(index, 1);
    }
  }
  
  // Crear una variante individual
  createVariant(attributes: any[]) {
    const variantName = attributes.map(attr => attr.name).join(' - ');
    const variantGroup = this.fb.group({
      name: [variantName],
      attributes: [attributes.reduce((acc: any, attr) => {
        acc[attr.type] = { name: attr.name, colorHex: attr.colorHex };
        return acc;
      }, {})],
      sku: [null, [Validators.required]],
      stock: [0, [Validators.required, Validators.min(0)]],
      price: [null, [Validators.required, Validators.min(0)]],
      photos: this.fb.array([]),
      status: ['active']
    });
    this.variants.push(variantGroup);
  }
  
  // Métodos para la UI de modales
  showAddSecondaryModal(primaryOptionId: string) {
    this.currentPrimaryOptionId = primaryOptionId;
    this.showAddSecondaryModalFlag = true;
  }
  
  confirmAddPrimary() {
    if (this.newPrimaryName.trim()) {
      const colorHex = this.primaryAttribute === 'color' ? this.newPrimaryColor : null;
      this.addPrimaryOption(this.newPrimaryName.trim(), colorHex);
      this.closeAddPrimaryModal();
    }
  }
  
  // Método para cerrar el modal y detectar cambios
  closeAddPrimaryModal() {
    this.showAddPrimaryModal = false;
    // Reset form
    this.newPrimaryName = '';
    this.newPrimaryColor = '#000000';
    this.cdr.detectChanges(); // Forzar detección de cambios
  }
  
  addOption(attribute: FormGroup, type: string) {
    const options = this.getOptions(attribute);
    options.push(this.fb.group({ 
      name: [`${type} ${options.length + 1}`], 
      value: type === 'color' ? '#000000' : '',
      colorHex: type === 'color' ? '#000000' : null
    }));
  }

  removeOption(attribute: FormGroup, index: number) {
    const options = this.getOptions(attribute);
    if (options.length > 1) {
      options.removeAt(index);
    }
  }

  removeVariant(index: number) {
    this.variants.removeAt(index);
  }
  addAttribute(type: string) {
    if (!this.attributesAdded.includes(type)) {
      this.attributesAdded.push(type);
      const attributes = this.productForm.get('attributes') as FormArray;
      attributes.push(this.fb.group({
        type: [type],
        name: [type],
        options: this.fb.array([])
      }));
      
      // Si es el primer atributo, no crear variantes automáticamente
      // El usuario las creará manualmente en la nueva UI
      if (this.attributesAdded.length === 1) {
        this.nestedVariants = [];
      }
    }
  }
  addVariant() {
  this.variants.push(
    this.fb.group({
      name: ['', Validators.required],
      price: [null, Validators.required],
      stock: [null, Validators.required],
    })
  );
}
  removeAttribute(index: number) {
    const attributes = this.productForm.get('attributes') as FormArray;
    const type = attributes.at(index).value.type;
    attributes.removeAt(index);
    const idx = this.attributesAdded.indexOf(type);
    if (idx > -1) {
      this.attributesAdded.splice(idx, 1);
    }
    
    // Limpiar la estructura anidada cuando se remueven atributos
    this.nestedVariants = [];
    this.variants.clear();
  }
  
  //`

  private loadCategories() {
    this.categoriesService.getCategories().subscribe(cats => {
      this.categories = this.flattenCategories(cats);
    });
  }

  private flattenCategories(categories: Category[], level = 0, prefix = ''): Category[] {
    let flatList: Category[] = [];
    for (const category of categories) {
      flatList.push({ ...category, name: `${prefix}${category.name}` });
      if (category.children) {
        flatList = flatList.concat(this.flattenCategories(category.children, level + 1, `${prefix}- `));
      }
    }
    return flatList;
  }

  async modifySelectedCategory() {
    const modal = await this.modalCtrl.create({
      component: SelectCategoryModalComponent,
      componentProps: {
        initialPath: this.selectedCategoryPath
      }
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data && Array.isArray(data) && data.length > 0) {
      this.selectedCategoryPath = data;
      this.productForm.get('categoryId')?.setValue(data[data.length - 1].id);
    } else if (role === 'confirm' && (!data || data.length === 0)) {
      this.selectedCategoryPath = [];
      this.productForm.get('categoryId')?.setValue(null);
    }
  }
  selectedCategoryPath: Category[] = [];
  modalCtrl = inject(ModalController);




  removeSelectedCategory() {
    this.selectedCategoryPath = [];
    this.productForm.get('categoryId')?.setValue(null);
  }

  private checkEditMode() {
    this.productId = this.route.snapshot.paramMap.get('id');
    console.log(this.productId)
    if (this.productId) {
      this.isEditMode = true;
      this.productsService.getProduct(this.productId).subscribe(product => {
        if (product) {
          this.productForm.patchValue(product);
          // Here you would handle existing images if needed
        }
      });
    }
  }

  async onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
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
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${new Date().getTime()}.jpeg`, { type: 'image/jpeg' });
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
        fileWrapper.file,
        user.uid,
        (progress) => {
          fileWrapper.progress = progress;
        }
      );
      fileWrapper.tempPath = result.path;
      // Añadir el objeto ProductPhoto al FormArray 'photos'
      const photos = this.productForm.get('photos') as FormArray;
      const productPhoto: NewPhoto = {
        name: fileWrapper.file.name,
        path: result.path,
        url: result.url || '',
        type: fileWrapper.file.type,
        processing: true,
      };
      photos.push(this.fb.control(productPhoto));
    } catch (error) {
      console.error('Error uploading image:', error);
      // this.presentToast('Error al subir la imagen', 'danger');
      const index = this.imageFiles.indexOf(fileWrapper);
      if (index > -1) {
        this.imageFiles.splice(index, 1);
      }
    } finally {
      fileWrapper.uploading = false;
      this.isUploading = this.imageFiles.some(f => f.uploading);
    }
  }

  async removeImage(index: number) {
    const fileWrapper = this.imageFiles[index];
    if (fileWrapper.tempPath) {
      try {
        await this.productsService.deleteTempImage(fileWrapper.tempPath);
        // Remover el objeto ProductPhoto del FormArray 'photos' comparando el path
        const photos = this.productForm.get('photos') as FormArray;
        const photoIndex = photos.controls.findIndex(control => control.value && control.value.path === fileWrapper.tempPath);
        if (photoIndex > -1) {
          photos.removeAt(photoIndex);
        }
      } catch (error) {
        console.error('Error deleting temp image', error);
      }
    }
    this.imageFiles.splice(index, 1);
  }

  async saveProduct() {
    if (this.productForm.invalid || this.isUploading) {
      this.presentToast('Por favor, completa el formulario y espera a que terminen de subirse las imágenes.', 'warning');
      return;
    }

    try {
      if (this.isEditMode && this.productId) {
        const productData = {
          ...this.productForm.value,
        };
        await this.productsService.updateProduct(this.productId, productData);
        this.presentToast('Producto actualizado con éxito', 'success');
      } else {
        const newProductData = {
          ...this.productForm.value,
          processing: true,
        };
        await this.productsService.addProduct(newProductData);
        this.presentToast('Producto creado con éxito. Se está procesando.', 'success');
      }
      this.router.navigate(['/products']);
    } catch (error) {
      console.error('Error saving product:', error);
      this.presentToast('Error al guardar el producto', 'danger');
    }
  }



  async openSelectCategoryModal() {
    const modal = await this.modalCtrl.create({
      component: SelectCategoryModalComponent,
    });
    modal.present();


    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data && Array.isArray(data) && data.length > 0) {
      this.selectedCategoryPath = data;
      this.productForm.get('categoryId')?.setValue(data[data.length - 1].id);
    }
  }


  // Utility functions for type safety
  getOptions(attribute: FormGroup): FormArray {
    return attribute.get('options') as FormArray;
  }

  getOptionsArray(attribute: AbstractControl): FormArray {
    return this.getOptions(attribute as FormGroup);
  }

  getOptionFormControl(option: AbstractControl, controlName: string): FormControl {
    return (option as FormGroup).get(controlName) as FormControl;
  }

  getVariantFormControl(variant: AbstractControl, controlName: string): FormControl {
    return (variant as FormGroup).get(controlName) as FormControl;
  }

  // Utility function to cast AbstractControl to FormGroup
  asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }
}

// ... (slugify, presentToast, etc.)
