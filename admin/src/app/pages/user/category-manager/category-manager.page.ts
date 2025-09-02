import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon,
  IonFab, IonFabButton, ModalController, IonList, IonItem, IonLabel,
  IonItemSliding, IonButton, IonItemOption, IonItemOptions, IonReorderGroup, IonReorder
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { create, folderOpen, trash, add, addCircle, reorderThree } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { Category, CategoriesService } from '../../../services/categories.service';
import { CategoryModalComponent } from './category-modal/category-modal.component';


@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.page.html',
  styleUrls: ['./category-manager.page.scss'],
  standalone: true,
  imports: [
    IonReorder, IonReorderGroup, IonItemOptions, IonItemOption, IonButton,
    IonItemSliding, IonLabel, IonItem, IonList, IonFabButton, IonFab, IonIcon,
    IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule,
    FormsModule
  ]
})
export class CategoryManagerPage implements OnInit, OnDestroy {
  private categoriesService = inject(CategoriesService);
  private modalController = inject(ModalController);
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  categories: Category[] = [];
  categoryTree: Category[] = [];
  private categoriesSub!: Subscription;

  constructor() {
    addIcons({ folderOpen, addCircle, create, trash, add, reorderThree });
  }

  ngOnInit() {
    this.categoriesSub = this.categoriesService.getCategoriesRealtime().subscribe(categories => {
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