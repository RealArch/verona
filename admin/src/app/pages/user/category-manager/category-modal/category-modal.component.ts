import { Component, inject, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, IonLabel, IonInput, ModalController, IonSpinner, IonIcon, IonImg, IonFooter, IonButtons } from '@ionic/angular/standalone';
import { CategoriesService } from '../../../../services/categories.service';
import { ProductsService } from 'src/app/services/products.service';
import { AuthService } from 'src/app/services/auth.service';
import { addIcons } from 'ionicons';
import { cameraOutline, trashOutline } from 'ionicons/icons';
import { firstValueFrom, filter, take } from 'rxjs';
import { Category, CategoryImage } from 'src/app/interfaces/category';

interface ImageUpload {
  file: File;
  previewUrl: string;
  uploading: boolean;
  progress: number;
  tempPath?: string;
}

@Component({
  selector: 'app-category-modal',
  templateUrl: './category-modal.component.html',
  standalone: true,
  imports: [
    IonInput, IonLabel, IonItem, IonButton, IonContent, IonHeader, IonTitle,
    IonToolbar, IonFooter, IonButtons, CommonModule, FormsModule, ReactiveFormsModule, IonSpinner, IonIcon, IonImg
  ]
})
export class CategoryModalComponent implements OnInit {
  @Input() category?: Category;
  @Input() parentId?: string;

  private categoriesService = inject(CategoriesService);
  private productsService = inject(ProductsService);
  private authService = inject(AuthService);
  private modalController = inject(ModalController);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  categoryForm!: FormGroup;
  imageUpload: ImageUpload | null = null;
  private originalImagePath?: string; // Para detectar si la imagen cambió

  isSaving = false;

  constructor() {
    addIcons({ cameraOutline, trashOutline });
  }

  ngOnInit() {
    this.categoryForm = this.fb.group({
      name: [this.category?.name || '', Validators.required],
      image: [this.category?.image || null]
    });

    // Si es modo edición y tiene imagen, crear la estructura para mostrar
    if (this.category?.image) {
      this.originalImagePath = this.category.image.path; // Guardar la imagen original
      this.imageUpload = {
        file: null as any, // No tenemos el archivo original
        previewUrl: this.category.image.url,
        uploading: false,
        progress: 100,
        tempPath: this.category.image.path
      };
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se permiten imágenes JPG, PNG o WEBP.');
      return;
    }

    this.imageUpload = {
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      progress: 0
    };
    this.cdr.markForCheck();

    try {
      const user = await firstValueFrom(this.authService.user$.pipe(filter(u => u !== undefined), take(1)));
      if (!user) throw new Error('User not authenticated');

      const { path, url } = await this.productsService.uploadTempImage(
        file,
        user.uid,
        (progress) => {
          if (this.imageUpload) {
            this.imageUpload.progress = progress;
            this.cdr.markForCheck();
          }
        }
      );

      if (this.imageUpload) {
        this.imageUpload.uploading = false;
        this.imageUpload.tempPath = path;
        
        // Crear el objeto CategoryImage completo
        // Determinar processing: true solo si es categoría principal y es nueva imagen
        const isMainCategory = !this.parentId;
        const processing = isMainCategory;
        
        const categoryImage: CategoryImage = {
          path: path,
          url: url,
          type: file.type,
          processing: processing
        };
        
        this.categoryForm.patchValue({ image: categoryImage });
        this.cdr.markForCheck();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      this.imageUpload = null;
      this.cdr.markForCheck();
    }
  }

  removeImage() {
    // Solo eliminar del storage si es una imagen temporal nueva (no de categoría existente)
    if (this.imageUpload?.tempPath && !this.category) {
      // Solo eliminar si es una nueva categoría, no si es edición
      this.productsService.deleteTempImage(this.imageUpload.tempPath);
    }
    
    // Resetear la imagen visualmente y en el formulario
    this.imageUpload = null;
    this.categoryForm.patchValue({ image: null });
    this.cdr.markForCheck();
  }

  removeImageWithStopPropagation(event: Event) {
    event.stopPropagation();
    this.removeImage();
  }

  async save() {
    if (this.categoryForm.invalid || this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      const formData = this.categoryForm.value;
      // Detectar si la imagen cambió en una categoría principal
      const isMainCategory = !this.parentId;
      let imageChanged = false;
      if (isMainCategory) {
        const currentImagePath = formData.image?.path;
        const originalPath = this.originalImagePath;
        imageChanged = (
          (!originalPath && currentImagePath) || 
          (originalPath && !currentImagePath) || 
          (originalPath !== currentImagePath)
        );
        if (formData.image && imageChanged) {
          formData.image.processing = true;
        } else if (formData.image && !imageChanged) {
          formData.image.processing = false;
        }
      }
      if (this.category) {
        if (!this.parentId) {
          formData.parentId = "root";
        }
        await this.categoriesService.updateCategory(this.category.id!, formData);
      } else {
        const newCategory: Partial<Category> = {
          name: formData.name,
          parentId: this.parentId || "root",
          order: 0,
          image: formData.image
        };
        await this.categoriesService.addCategory(newCategory);
      }
      this.modalController.dismiss();
    } catch (error) {
      // Puedes mostrar un toast aquí si quieres
      console.error('Error saving category:', error);
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  cancel() {
    this.modalController.dismiss();
  }
}