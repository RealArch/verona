import { Injectable, signal } from '@angular/core';
import { algoliasearch, SearchClient } from 'algoliasearch';
import { environment } from '../../../environments/environment.development';
import { Category } from '../../interfaces/categories';


@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private client: SearchClient;
  private readonly indexName = environment.algolia.indexes.categories;
  readonly categories = signal<Category[] | null>(null);
  constructor() {
    this.client = algoliasearch(
      environment.algolia.appId,
      environment.algolia.apiKey
    );
  }

  loadCategories() {
    this.getAllCategories().then(categories => {
      this.categories.set(categories);
      console.log('Categories loaded:', categories);
    });
  }
  /**
   * Get all categories from Algolia
   * @returns Promise with all categories
   */
  async getAllCategories(): Promise<Category[]> {
    try {
      const index = this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query: '',
          hitsPerPage: 1000,
          // filters: 'isActive:true'
        }
      });
      const response = await index;
      return response.hits as Category[];
    } catch (error) {
      console.error('Error fetching all categories:', error);
      throw error;
    }
  }

  getTreeNames(categoryId: string): string[] {
    const categories = this.categories() ?? [];
    const path: string[] = [];
    let currentId = categoryId;
    while (currentId) {
      const category = categories.find((cat: Category) => cat.objectID === currentId);
      if (!category) break;
      path.unshift(category.name);
      currentId = category.parentId;
      if (!currentId || currentId === 'root') break;
    }
    return path;
  }

  /**
   * Get all main categories (level 0) from Algolia
   * @returns Promise with main categories only
   */
  async getAllMainCategories(): Promise<Category[]> {
    try {
      const index = this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query: '',
          hitsPerPage: 1000,
          filters: 'parentId:root'
        }
      });
      const response = await index;
      return response.hits as Category[];
    } catch (error) {
      console.error('Error fetching main categories:', error);
      throw error;
    }
  }
}