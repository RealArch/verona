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
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Category {
  id?: string;
  name: string;
  parentId?: string | null;
  path?: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
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

  async addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date();
    const docRef = await addDoc(this.categoriesCollection, {
      ...category,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    const docRef = doc(this.firestore, `categories/${id}`);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const docRef = doc(this.firestore, `categories/${id}`);
    await deleteDoc(docRef);
  }

  buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // Primero, mapear todas las categorías
    categories.forEach(category => {
      categoryMap.set(category.id!, { ...category, children: [] } as any);
    });

    // Luego, construir la jerarquía
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id!) as any;

      if (category.parentId && categoryMap.has(category.parentId)) {
        const parent = categoryMap.get(category.parentId) as any;
        if (!parent.children) parent.children = [];
        parent.children.push(categoryWithChildren);
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }
}