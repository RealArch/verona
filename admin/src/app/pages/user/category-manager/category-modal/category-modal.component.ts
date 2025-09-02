import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonItem, IonLabel, IonInput, ModalController } from '@ionic/angular/standalone';
import { Category, CategoriesService } from '../../../../services/categories.service';

@Component({
  selector: 'app-category-modal',
  templateUrl: './category-modal.component.html',
  standalone: true,
  imports: [
    IonInput, IonLabel, IonItem, IonButton, IonContent, IonHeader, IonTitle,
    IonToolbar, CommonModule, FormsModule, ReactiveFormsModule
  ]
})
export class CategoryModalComponent implements OnInit {
  @Input() category?: Category;
  @Input() parentId?: string;

  private categoriesService = inject(CategoriesService);
  private modalController = inject(ModalController);
  private fb = inject(FormBuilder);

  categoryForm!: FormGroup;

  ngOnInit() {
    this.categoryForm = this.fb.group({
      name: [this.category?.name || '', Validators.required],
      description: [this.category?.description || '']
    });
  }

  async save() {
    if (this.categoryForm.invalid) {
      return;
    }

    const formData = this.categoryForm.value;
    if (this.category) {
      await this.categoriesService.updateCategory(this.category.id!, formData);
    } else {
      const newCategory: Partial<Category> = {
        name: formData.name,
        description: formData.description,
        parentId: this.parentId || null,
        order: 0 // Deberías implementar una lógica para el orden
      };
      await this.categoriesService.addCategory(newCategory);
    }
    this.modalController.dismiss();
  }

  cancel() {
    this.modalController.dismiss();
  }
}