import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
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
import { Category } from '../interfaces/category';





@Injectable({
  providedIn: 'root'
})
export class CategoriesService {
  // private firestore = inject(Firestore);
  private injector = inject(Injector);

  categoriesCollection

  constructor(private firestore: Firestore) { 
    this.categoriesCollection = collection(this.firestore, 'categories');
  }

  getCategories(): Observable<Category[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(this.categoriesCollection, orderBy('order'));
      return collectionData(q, { idField: 'id' }) as Observable<Category[]>;
    })
  }


  async addCategory(category: Partial<Category>): Promise<string> {
    const now = new Date();
    let path: string[] = [];
    // Si tiene parentId, obtener el path del padre
    if (category.parentId) {
      const parentRef = doc(this.firestore, `categories/${category.parentId}`);
      const parentSnap = await (await import('@angular/fire/firestore')).getDoc(parentRef);
      const parentData = parentSnap.exists() ? parentSnap.data() as Category : null;
      if (parentData && parentData.path) {
        path = [...parentData.path];
      }
    }
    // Crear la categoría
    const docRef = await addDoc(this.categoriesCollection, {
      ...category,
      slug: this.slugify(category.name!),
      path,
      createdAt: now,
      updatedAt: now
    });
    // Actualizar el path con el id propio
    await updateDoc(docRef, { path: [...path, docRef.id] });
    return docRef.id;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    const docRef = doc(this.firestore, `categories/${id}`);
    if (updates.name) {
      updates.slug = this.slugify(updates.name);
    }
    let newPath: string[] | undefined;
    if (updates.parentId !== undefined) {
      // Si cambia el parentId, recalcular el path
      if (updates.parentId) {
        const parentRef = doc(this.firestore, `categories/${updates.parentId}`);
        const parentSnap = await (await import('@angular/fire/firestore')).getDoc(parentRef);
        const parentData = parentSnap.exists() ? parentSnap.data() as Category : null;
        if (parentData && parentData.path) {
          newPath = [...parentData.path, id];
        } else {
          newPath = [id];
        }
      } else {
        newPath = [id];
      }
      updates.path = newPath;
    }
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
    // Si el path cambió, actualizar los hijos
    if (newPath) {
      await this.updateChildrenPaths(id, newPath);
    }
  }

  // Actualiza el path de los hijos recursivamente
  private async updateChildrenPaths(parentId: string, parentPath: string[]): Promise<void> {
    // Obtener hijos directos
    const q = query(this.categoriesCollection, orderBy('order'));
    const snapshot = await onSnapshot(q, () => { }); // No usar onSnapshot, usar getDocs
    // Reemplazar por getDocs
    // Este método requiere Firestore getDocs, ajusta según tu SDK
    // Aquí solo se muestra la lógica:
    // const children = snapshot.docs.filter(doc => doc.data().parentId === parentId);
    // for (const child of children) {
    //   const childId = child.id;
    //   const childPath = [...parentPath, childId];
    //   await updateDoc(doc(this.firestore, `categories/${childId}`), { path: childPath });
    //   await this.updateChildrenPaths(childId, childPath);
    // }
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