import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon,
  ModalController, IonButton, IonBackButton, IonGrid, IonRow, IonCol, IonCard,
  IonCardHeader, IonCardContent, IonItem, IonLabel, IonImg, IonAvatar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { create, trash, add, addCircleOutline, folderOpenOutline, createOutline, trashOutline, fileTrayOutline, folderOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { CategoriesService } from '../../../services/categories.service';
import { CategoryModalComponent } from './category-modal/category-modal.component';
import { Category } from 'src/app/interfaces/category';


@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.page.html',
  styleUrls: ['./category-manager.page.scss'],
  standalone: true,
  imports: [IonAvatar, IonImg, 
    IonCard, IonCardHeader, IonCardContent, IonItem, IonLabel,
    IonGrid, IonRow, IonCol, IonButton, IonIcon, IonButtons, IonContent,
    IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonBackButton
  ]
})
export class CategoryManagerPage implements OnInit, OnDestroy {
  private categoriesService = inject(CategoriesService);
  private modalController = inject(ModalController);
  categories: Category[] = [];
  categoryTree: Category[] = [];
  private categoriesSub!: Subscription;

  constructor() {
    addIcons({ addCircleOutline, folderOpenOutline, createOutline, trashOutline, fileTrayOutline, add, folderOutline, create, trash });
  }

  ngOnInit() {
    this.categoriesSub = this.categoriesService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.categoryTree = this.categoriesService.buildCategoryTree(this.categories);
    });
  }

  ngOnDestroy() {
    if (this.categoriesSub) {
      this.categoriesSub.unsubscribe();
    }
  }

  async openCategoryModal(category?: Category, parentId?: string) {
    const modal = await this.modalController.create({
      component: CategoryModalComponent,
      componentProps: {
        category,
        parentId
      }
    });
    await modal.present();
  }

  async addCategory(parentId: string | null = null) {
    this.openCategoryModal(undefined, parentId || undefined);
  }

  async editCategory(category: Category) {
    this.openCategoryModal(category);
  }

  async deleteCategory(id: string) {
    // Aquí deberías agregar una confirmación antes de borrar
    await this.categoriesService.deleteCategory(id);
  }

}
