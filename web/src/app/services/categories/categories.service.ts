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
  readonly categoriesLoading = signal<boolean>(false);
  readonly categoriesLoaded = signal<boolean>(false);
  
  constructor() {
    this.client = algoliasearch(
      environment.algolia.appId,
      environment.algolia.apiKey
    );
    // Load categories immediately on service initialization
    this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (this.categoriesLoading() || this.categoriesLoaded()) {
      return Promise.resolve();
    }
    
    this.categoriesLoading.set(true);
    try {
      const categories = await this.getAllCategories();
      this.categories.set(categories);
      this.categoriesLoaded.set(true);
      console.log('Categories loaded successfully:', categories.length);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      this.categoriesLoading.set(false);
    }
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
   * Get all descendant category IDs (children, grandchildren, etc.) for a given category
   * @param categoryId The parent category ID
   * @returns Array of all descendant category IDs including the parent
   */
  getAllDescendantIds(categoryId: string): string[] {
    const categories = this.categories() ?? [];
    const descendants: string[] = [categoryId]; // Include the parent category itself
    
    // Helper function to recursively find all children
    const findChildren = (parentId: string) => {
      const children = categories.filter((cat: Category) => cat.parentId === parentId);
      children.forEach(child => {
        if (child.objectID) {
          descendants.push(child.objectID);
          // Recursively find grandchildren
          findChildren(child.objectID);
        }
      });
    };
    
    findChildren(categoryId);
    return descendants;
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