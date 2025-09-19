import { Component, OnInit, inject, signal } from '@angular/core';
import { CategoriesService } from '../../services/categories/categories.service';
import { Category } from '../../interfaces/categories';

@Component({
  selector: 'app-categories-show',
  imports: [],
  templateUrl: './categories-show.html',
  styleUrl: './categories-show.scss'
})
export class CategoriesShow implements OnInit {
  // INJECTIONS
  private readonly categoriesService = inject(CategoriesService);

  // Signals
  mainCategories = signal<Category[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMainCategories();
  }

  /**
   * Load all main categories from Algolia
   * Handles loading state and error management
   */
  async loadMainCategories(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const categories = await this.categoriesService.getAllMainCategories();
      this.mainCategories.set(categories);

    } catch (error) {
      this.error.set('Error al cargar las categorías principales');
      console.error('Failed to load main categories:', error);
      this.mainCategories.set([]);

    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refresh categories data
   * Can be called from template for manual refresh
   */
  async refreshCategories(): Promise<void> {
    await this.loadMainCategories();
  }
}
