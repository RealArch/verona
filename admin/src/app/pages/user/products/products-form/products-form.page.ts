import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonGrid, IonRow, IonCol, IonButton, IonIcon, IonFabButton,
  ToastController, IonSpinner, IonProgressBar, IonCard, IonCardHeader, IonCardContent, IonCardTitle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { AuthService } from 'src/app/services/auth.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoriesService, Category } from 'src/app/services/categories.service';
import { firstValueFrom } from 'rxjs';

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
  imports: [IonCardTitle, IonCardContent, IonCardHeader, IonCard,
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonGrid, IonRow, IonCol, IonButton, IonIcon, IonFabButton, IonSpinner, IonProgressBar
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

  productForm!: FormGroup;
  isEditMode = false;
  productId: string | null = null;
  categories: Category[] = [];
  imageFiles: ImageFile[] = [];
  isUploading = false;

  constructor() {
    addIcons({ save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline, addCircleOutline }); // Añadir aquí
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
      fotos: this.fb.array([]) // Array para las fotos

    });
  }

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
      // Añadir la ruta al FormArray 'fotos'
      const fotos = this.productForm.get('fotos') as FormArray;
      fotos.push(this.fb.control(result.path));
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
        // Remover la ruta del FormArray 'fotos'
        const fotos = this.productForm.get('fotos') as FormArray;
        const fotoIndex = fotos.controls.findIndex(control => control.value === fileWrapper.tempPath);
        if (fotoIndex > -1) {
          fotos.removeAt(fotoIndex);
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
      console.log(this.isEditMode)
      if (this.isEditMode && this.productId) {
        // Para el modo de edición, solo necesitamos los valores del formulario.
        // El servicio se encargará de añadir el 'updatedAt'.
        const productData = this.productForm.value;
        await this.productsService.updateProduct(this.productId, productData);
        this.presentToast('Producto actualizado con éxito', 'success');
      } else {
        // Para un nuevo producto, añadimos el estado y los timestamps.
        const newProductData = {
          ...this.productForm.value,
          processing: true, // Establece el estado a "processing"
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
