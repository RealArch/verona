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
  orderBy
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from '@angular/fire/storage';
import { Observable, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Product, ProductStatus } from 'src/app/interfaces/product';


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
    const productDoc = doc(this.firestore, `products/${id}`);
    return docData(productDoc, { idField: 'id' }) as Observable<Product>;
  }

  async addProduct(productData: Partial<Product>): Promise<any> {
    // addDoc se encarga de añadir el documento a la colección especificada.
    return addDoc(this.productsCollection, productData);
  }

  async updateProduct(id: string, productData: Partial<Product>): Promise<void> {
    const productDoc = doc(this.firestore, `products/${id}`);
    return updateDoc(productDoc, {
      ...productData,
      updatedAt: serverTimestamp()
    });
  }


  async deleteProduct(id: string): Promise<void> {
    const productDoc = doc(this.firestore, `products/${id}`);
    await deleteDoc(productDoc);
    // Note: Deleting images from storage should be handled by a cloud function for security and reliability.
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
              return runInInjectionContext(this.injector, async () => {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({ path: tempPath, url: downloadUrl });
              });
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
    const productDoc = doc(this.firestore, `products/${productId}`);
    return updateDoc(productDoc, { status, updatedAt: serverTimestamp() });
  }

  async deleteTempImage(path: string): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    });
  }
}
