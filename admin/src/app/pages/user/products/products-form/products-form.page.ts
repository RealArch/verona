import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonGrid, IonRow, IonCol, IonButton, IonIcon, IonFabButton,
  LoadingController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { AuthService } from 'src/app/services/auth.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoriesService, Category } from 'src/app/services/categories.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './products-form.page.html',
  styleUrls: ['./products-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonGrid, IonRow, IonCol, IonButton, IonIcon, IonFabButton
  ]
})
export class ProductFormPage implements OnInit {
  private fb = inject(FormBuilder);
  private productsService = inject(ProductsService);
  private categoriesService = inject(CategoriesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  productForm!: FormGroup;
  isEditMode = false;
  productId: string | null = null;
  categories: Category[] = [];

  imagePreviewUrl: string | null = null;
  tempImagePath: string | null = null;
  isUploading = false;
  private selectedFile: File | null = null;

  constructor() {
    addIcons({ save, cloudUploadOutline, folderOpenOutline, cameraOutline, trashOutline });
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
      status: ['active', Validators.required]
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
      flatList.push({ ...category, name: `${prefix}${category.name}`});
      if (category.children) {
        flatList = flatList.concat(this.flattenCategories(category.children, level + 1, `${prefix}- `));
      }
    }
    return flatList;
  }
  
  private checkEditMode() {
    this.productId = this.route.snapshot.paramMap.get('id');
    if (this.productId) {
      this.isEditMode = true;
      this.productsService.getProduct(this.productId).subscribe(product => {
        if(product) {
          this.productForm.patchValue(product);
          this.imagePreviewUrl = product.images?.thumbnail || null;
        }
      });
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFile(file);
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
        this.handleFile(file);
      }
    } catch (error) {
      console.error('Error taking picture', error);
    }
  }

  private async handleFile(file: File) {
                console.log(3)

    if (this.isUploading) return;
    this.isUploading = true;
    const loading = await this.loadingCtrl.create({ message: 'Subiendo imagen...' });
    loading.present();

    try {
            console.log(1)

      // if (this.tempImagePath) {
      //   await this.productsService.deleteTempImage(this.tempImagePath);
      // }

      this.selectedFile = file;
      this.imagePreviewUrl = URL.createObjectURL(file);
      
      const user = await this.authService.user$.toPromise();
      console.log(2)
      if (!user) throw new Error('User not authenticated');
      console.log(0)
      const result = await this.productsService.uploadTempImage(file, user.uid);
      this.tempImagePath = result.path;
      this.imagePreviewUrl = result.url;

    } catch (error) {
      console.error('Error uploading image:', error);
      this.presentToast('Error al subir la imagen', 'danger');
      this.removeImage();
    } finally {
      this.isUploading = false;
      loading.dismiss();
    }
  }
  
  async removeImage() {
    if (this.tempImagePath) {
      try {
        await this.productsService.deleteTempImage(this.tempImagePath);
      } catch (error) {
        console.error('Error deleting temp image', error);
      }
    }
    this.imagePreviewUrl = null;
    this.tempImagePath = null;
    this.selectedFile = null;
  }
  
  async saveProduct() {
    if (this.productForm.invalid) {
      this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }
    if (!this.isEditMode && !this.tempImagePath) {
      this.presentToast('Por favor, sube una imagen para el producto.', 'warning');
      return;
    }
    
    const loading = await this.loadingCtrl.create({ message: 'Guardando producto...' });
    await loading.present();
    
    try {
      const productData = this.productForm.value;
      productData.slug = this.slugify(productData.name);

      if (this.isEditMode && this.productId) {
        await this.productsService.updateProduct(this.productId, productData);
      } else {
        await this.productsService.addProduct(productData, this.tempImagePath!);
      }
      
      this.presentToast(`Producto ${this.isEditMode ? 'actualizado' : 'creado'} con éxito`, 'success');
      this.router.navigate(['/products']);
    } catch (error) {
      console.error('Error saving product:', error);
      this.presentToast('Error al guardar el producto.', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
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
