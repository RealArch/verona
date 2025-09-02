import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon } from '@ionic/angular/standalone';
import { CategoriesService, Category } from 'src/app/services/categories.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { create, folderOpen, trash } from 'ionicons/icons';

@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.page.html',
  styleUrls: ['./category-manager.page.scss'],
  standalone: true,
  imports: [IonIcon, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class CategoryManagerPage implements OnInit {
  private categoriesService = inject(CategoriesService);
  
  categories: Category[] = [];
  categoryTree: any[] = [];
  newCategory = {
    name: '',
    parentId: null as string | null,
    order: 0
  };
  editingCategory: Category | null = null;
  private categoriesSubscription!: Subscription;
  constructor() { 
        addIcons({folderOpen,create,trash});
    
  }

  ngOnInit() {
        this.categoriesSubscription = this.categoriesService.getCategoriesRealtime().subscribe(categories => {
      this.categories = categories;
      this.categoryTree = this.categoriesService.buildCategoryTree(categories);
    });
  }
ngOnDestroy() {
    if (this.categoriesSubscription) {
      this.categoriesSubscription.unsubscribe();
    }
  }
  
  async addCategory() {
    if (!this.newCategory.name) return;
    
    try {
      await this.categoriesService.addCategory(this.newCategory);
      this.newCategory = {
        name: '',
        parentId: null,
        order: 0
      };
    } catch (error) {
      console.error('Error adding category:', error);
    }
  }
  
  startEdit(category: Category) {
    this.editingCategory = { ...category };
  }
  
  async updateCategory() {
    if (!this.editingCategory) return;
    
    try {
      await this.categoriesService.updateCategory(this.editingCategory.id!, {
        name: this.editingCategory.name,
        parentId: this.editingCategory.parentId,
        order: this.editingCategory.order
      });
      this.cancelEdit();
    } catch (error) {
      console.error('Error updating category:', error);
    }
  }
  
  cancelEdit() {
    this.editingCategory = null;
  }
  
  async deleteCategory(id: string) {
    try {
      await this.categoriesService.deleteCategory(id);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }
  
  getChildren(parentId: string | null): Category[] {
    return this.categories.filter(cat => cat.parentId === parentId);
  }
}
