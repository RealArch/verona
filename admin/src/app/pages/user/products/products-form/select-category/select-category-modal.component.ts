import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { ModalController, IonList, IonItem, IonButton, IonLabel, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { CategoriesService, Category } from 'src/app/services/categories.service';


@Component({
  selector: 'app-select-category-modal',
  templateUrl: './select-category-modal.component.html',
  styleUrls: ['./select-category-modal.component.scss'],
  standalone: true,
  imports: [IonContent, IonButtons, IonTitle, IonToolbar, IonHeader, CommonModule, IonList, IonItem, IonButton, IonLabel]
})
export class SelectCategoryModalComponent {
  private categoriesService = inject(CategoriesService);
  private modalController = inject(ModalController);

  categories: Category[] = [];
  selectedPath: Category[] = [];
  loading = true;
  initialPath?: Category[];

  async ngOnInit() {
    if (this.initialPath && this.initialPath.length > 0) {
      // Cargar el árbol en el estado actual
      this.selectedPath = [...this.initialPath];
      const lastCat = this.selectedPath[this.selectedPath.length - 1];
      await this.loadCategories(lastCat ? lastCat.id : null);
    } else {
      await this.loadCategories();
    }
  }

  async loadCategories(parentId: string | null = null) {
    this.loading = true;
    this.categoriesService.getCategories().subscribe(cats => {
      this.categories = cats.filter(cat => cat.parentId === parentId);
      this.loading = false;
    });
  }

  hasSubcategories = false;

  async selectCategory(category: Category) {
    this.selectedPath.push(category);
    this.categoriesService.getCategories().subscribe(allCats => {
      const subcats = allCats.filter(cat => cat.parentId === category.id);
      if (subcats.length > 0) {
        this.categories = subcats;
        this.hasSubcategories = true;
      } else {
        this.categories = [];
        this.hasSubcategories = false;
      }
    });
  }

  async confirmSelection() {
    await this.modalController.dismiss(this.selectedPath, 'confirm');
  }

  async goBack() {
    this.selectedPath.pop();
    const parentId = this.selectedPath.length > 0 ? this.selectedPath[this.selectedPath.length - 1].id : null;
    await this.loadCategories(parentId);
  }

  async close() {
    await this.modalController.dismiss(null);
  }
}
