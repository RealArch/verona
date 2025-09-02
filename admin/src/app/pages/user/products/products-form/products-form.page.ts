import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonGrid, IonRow, IonCol, IonButton, IonIcon, IonFabButton,
  ToastController, IonSpinner, IonProgressBar, IonCard, IonCardHeader, IonCardContent, IonCardTitle } from '@ionic/angular/standalone';
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
      flatList.push({ ...category, name: `${prefix}${category.name}` });
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
      } catch (error) {
        console.error('Error deleting temp image', error);
      }
    }
    this.imageFiles.splice(index, 1);
  }

  async saveProduct() {
    // ... (rest of the saveProduct logic, adapted for multiple images)
  }

  // ... (slugify, presentToast, etc.)
}