import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collectionData,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Category {
  id?: string;
  name: string;
  slug: string; // Para URLs amigables
  description?: string; // Descripción para SEO y para el usuario
  image?: string; // URL de la imagen de la categoría
  parentId?: string | null;
  path?: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  children?: Category[]; // Para anidar las subcategorías
}

@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  private firestore = inject(Firestore);

  private categoriesCollection = collection(this.firestore, 'categories');

  getCategories(): Observable<Category[]> {
    const q = query(this.categoriesCollection, orderBy('order'));
    return collectionData(q, { idField: 'id' }) as Observable<Category[]>;
  }

  getCategoriesRealtime(): Observable<Category[]> {
    return new Observable<Category[]>(subscriber => {
      const q = query(this.categoriesCollection, orderBy('order'));
      return onSnapshot(q, snapshot => {
        const categories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        subscriber.next(categories);
      });
    });
  }

  async addCategory(category: Partial<Category>): Promise<string> {
    const now = new Date();
    const docRef = await addDoc(this.categoriesCollection, {
      ...category,
      slug: this.slugify(category.name!),
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    const docRef = doc(this.firestore, `categories/${id}`);
    if (updates.name) {
      updates.slug = this.slugify(updates.name);
    }
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const docRef = doc(this.firestore, `categories/${id}`);
    await deleteDoc(docRef);
  }

  buildCategoryTree(categories: Category[], parentId: string | null = null): Category[] {
    const tree: Category[] = [];
    categories.forEach(category => {
      if (category.parentId === parentId) {
        const children = this.buildCategoryTree(categories, category.id);
        if (children.length) {
          category.children = children;
        }
        tree.push(category);
      }
    });
    return tree;
  }

  private slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
}