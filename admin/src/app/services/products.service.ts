import { Injectable, inject, Injector, runInInjectionContext, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collectionData,
  query,
  where,
  Timestamp,
  docData,
  serverTimestamp,
  orderBy,
  getDocs
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from '@angular/fire/storage';
import { Observable, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Product, ProductStatus } from 'src/app/interfaces/product';
import { ProductPhoto } from 'src/app/interfaces/product-photo';


@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage);
  private http: HttpClient = inject(HttpClient);
  private injector: Injector = inject(Injector);
  private zone: NgZone = inject(NgZone);
  private productsCollection = collection(this.firestore, 'products');
  private readonly API_URL = environment.useEmulators ? 'http://localhost:5001/verona-ffbcd/us-central1/api' : '/api';

  getProductsByStatus(status: 'all' | 'active' | 'paused'): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      let q;
      if (status === 'all') {
        q = query(this.productsCollection);
      } else {
        q = query(this.productsCollection, where('status', '==', status));
      }
      return collectionData(q, { idField: 'id' }) as Observable<Product[]>;
    });
  }

  getProduct(id: string): Observable<Product> {
    return runInInjectionContext(this.injector, () => {
      const productDoc = doc(this.firestore, `products/${id}`);
      return docData(productDoc, { idField: 'id' }) as Observable<Product>;
    });
  }

  async addProduct(productData: Partial<Product>): Promise<any> {
    return runInInjectionContext(this.injector, () => {
      // Generate slug if name is provided
      if (productData.name && !productData.slug) {
        productData.slug = this.generateSlug(productData.name);
      }
      return addDoc(this.productsCollection, productData);
    });
  }

  async updateProduct(id: string, productData: Partial<Product & { imagesToDelete?: ProductPhoto[] }>): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      // Update slug if name has changed
      if (productData.name) {
        productData.slug = this.generateSlug(productData.name);
      }
      
      const productDoc = doc(this.firestore, `products/${id}`);
      console.log('Updating product with data:', productData);
      return updateDoc(productDoc, {
        ...productData,
        updatedAt: serverTimestamp(),
        processing: true // Asegura que processing se establezca en false al actualizar
      });
    });
  }


  async deleteProduct(id: string): Promise<void> {
    return runInInjectionContext(this.injector, () => {
      const productDoc = doc(this.firestore, `products/${id}`);
      return deleteDoc(productDoc);
      // Note: Deleting images from storage should be handled by a cloud function for security and reliability.
    });
  }

  // Uploads image to a temporary path and returns the full path
  async uploadTempImage(
    file: File,
    userId: string,
    onProgress: (progress: number) => void
  ): Promise<{ path: string, url: string }> {
    return runInInjectionContext(this.injector, () => {
      const tempPath = `temp/${userId}/${Date.now()}_${file.name}`;
      const storageRef = ref(this.storage, tempPath);

      return new Promise<{ path: string, url: string }>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => {
            console.error("Upload failed", error);
            reject(error);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ path: tempPath, url: downloadUrl });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });
  }
  //funcion para actualizar el status de un producto. puede ser active, paused
  updateStatus(productId: string, status: ProductStatus): Promise<void> {
    return runInInjectionContext(this.injector, () => {
      const productDoc = doc(this.firestore, `products/${productId}`);
      return updateDoc(productDoc, { status, updatedAt: serverTimestamp() });
    });
  }

  async deleteTempImage(path: string): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    });
  }

  async deleteImages(imagePaths: string[]): Promise<void[]> {
    return runInInjectionContext(this.injector, () => {
      const deletePromises = imagePaths.map(path => {
        const storageRef = ref(this.storage, path);
        return deleteObject(storageRef).catch(error => {
          console.warn(`Failed to delete image at path ${path}:`, error);
        });
      });

      return Promise.all(deletePromises);
    });
  }

  /**
   * Verifica si una categoría o cualquiera de sus subcategorías tiene productos asociados
   * @param categoryIds Array de IDs de categorías a verificar (incluye la categoría principal y sus hijos)
   * @returns Promise<boolean> true si hay productos, false si no hay productos
   */
  async categoryHasProducts(categoryIds: string[]): Promise<boolean> {
    return runInInjectionContext(this.injector, async () => {
      if (!categoryIds || categoryIds.length === 0) {
        return false;
      }

      try {
        // Verificar cada categoría en el array
        for (const categoryId of categoryIds) {
          const q = query(
            this.productsCollection, 
            where('categoryId', '==', categoryId)
          );
          const snapshot = await getDocs(q);
          
          // Si encontramos al menos un producto en cualquier categoría, retornar true
          if (!snapshot.empty) {
            console.log(`Found ${snapshot.size} product(s) in category ${categoryId}`);
            return true;
          }
        }
        
        // No se encontraron productos en ninguna categoría
        return false;
      } catch (error) {
        console.error('Error checking if category has products:', error);
        // En caso de error, por seguridad retornamos true para evitar eliminaciones accidentales
        return true;
      }
    });
  }

  // Generate URL-friendly slug from text
  private generateSlug(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }
}
