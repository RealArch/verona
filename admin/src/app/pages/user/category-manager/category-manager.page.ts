import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon,
  ModalController, IonButton, IonBackButton, IonGrid, IonRow, IonCol, IonCard,
  IonCardHeader, IonCardContent, IonItem, IonLabel, IonImg, IonAvatar, IonSkeletonText, IonMenuButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { create, trash, add, addCircleOutline, folderOpenOutline, createOutline, trashOutline, fileTrayOutline, folderOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { CategoriesService } from '../../../services/categories.service';
import { ProductsService } from '../../../services/products.service';
import { Popups } from 'src/app/services/popups';
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
    IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonBackButton, IonSkeletonText, IonMenuButton
  ]
})
export class CategoryManagerPage implements OnInit, OnDestroy {
  private categoriesService = inject(CategoriesService);
  private productsService = inject(ProductsService);
  private modalController = inject(ModalController);
  private popups = inject(Popups);
  categories: Category[] = [];
  categoryTree: Category[] = [];
  loading = true;
  private categoriesSub!: Subscription;

  constructor() {
    addIcons({ addCircleOutline, folderOpenOutline, createOutline, trashOutline, fileTrayOutline, add, folderOutline, create, trash });
  }

  ngOnInit() {
    this.loading = true;
    this.categoriesSub = this.categoriesService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.categoryTree = this.categoriesService.buildCategoryTree(this.categories);
      this.loading = false;
    }, () => {
      this.loading = false;
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
    try {
      // Paso 1: Obtener todos los IDs de la categoría y sus descendientes
      const categoryIds = this.categoriesService.getCategoryAndDescendantIds(id, this.categories);
      
      console.log('Checking categories for products:', categoryIds);
      
      // Paso 2: Verificar si alguna de estas categorías tiene productos
      const hasProducts = await this.productsService.categoryHasProducts(categoryIds);
      
      if (hasProducts) {
        // Mostrar alerta profesional indicando que no se puede eliminar
        await this.popups.presentAlert(
          'No se puede eliminar la categoría',
          'Esta categoría o alguna de sus subcategorías contiene productos asociados. ' +
          'Por favor, elimina o reasigna los productos antes de eliminar la categoría.'
        );
        return;
      }
      
      // Paso 3: Si no tiene productos, pedir confirmación
      const confirmed = await this.popups.confirm(
        'Eliminar categoría',
        '¿Deseas eliminar esta categoría? Esta acción es irreversible y también eliminará todas las subcategorías asociadas.'
      );
      
      if (!confirmed) return;
      
      // Paso 4: Proceder con la eliminación
      await this.categoriesService.deleteCategory(id);
      await this.popups.presentToast('bottom', 'success', 'La categoría y sus subcategorías fueron eliminadas correctamente.');
      
    } catch (error) {
      console.error('Error deleting category:', error);
      await this.popups.presentToast('bottom', 'danger', 'Ocurrió un error al intentar eliminar la categoría. Por favor, inténtalo nuevamente.');
    }
  }

}
