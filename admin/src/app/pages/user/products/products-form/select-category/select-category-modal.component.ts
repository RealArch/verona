import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { 
  ModalController, IonList, IonItem, IonButton, IonLabel, IonHeader, IonToolbar, 
  IonTitle, IonButtons, IonContent, IonIcon, IonChip, IonSpinner, IonCard, 
  IonCardContent, IonFooter 
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { CategoriesService } from 'src/app/services/categories.service';
import { Category } from 'src/app/interfaces/category';
import { addIcons } from 'ionicons';
import { 
  close, chevronBack, home, chevronForward, folder, checkmarkCircle, 
  folderOpen, checkmark 
} from 'ionicons/icons';


@Component({
  selector: 'app-select-category-modal',
  templateUrl: './select-category-modal.component.html',
  styleUrls: ['./select-category-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, 
    IonIcon, IonChip, IonLabel, IonSpinner, IonCard, IonCardContent, IonFooter
  ]
})
export class SelectCategoryModalComponent {
  private categoriesService = inject(CategoriesService);
  private modalController = inject(ModalController);

  categories: Category[] = [];
  selectedPath: Category[] = [];
  loading = true;
  initialPath?: Category[];

  constructor() {
    addIcons({ close, chevronBack, home, chevronForward, folder, checkmarkCircle, folderOpen, checkmark });
  }

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
      // Si parentId es null, buscar categorías principales (parentId === "root")
      // Si parentId es un string, buscar categorías hijas con ese parentId
      const targetParentId = parentId === null ? "root" : parentId;
      this.categories = cats.filter(cat => cat.parentId === targetParentId);
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

  async goToRoot() {
    this.selectedPath = [];
    await this.loadCategories();
  }

  async goToCategory(index: number) {
    this.selectedPath = this.selectedPath.slice(0, index + 1);
    const parentId = this.selectedPath.length > 0 ? this.selectedPath[this.selectedPath.length - 1].id : null;
    await this.loadCategories(parentId);
  }
}
