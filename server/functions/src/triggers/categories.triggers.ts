import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/firestore';
import { defineSecret } from 'firebase-functions/params';
import { syncDocumentAlgolia, removeDocumentAlgolia } from '../utils/syncWithAlgolia';
import { processCategoriesImages } from '../utils/processImages';
import { db, storage } from '../firebase-init';
import { FieldValue } from 'firebase-admin/firestore';

// Define los secrets
const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");
const algoliaAppId = defineSecret("ALGOLIA_APP_ID");

// Define el nombre del índice una sola vez
const CATEGORIES_ALGOLIA_INDEX = !process.env.FUNCTIONS_EMULATOR ? 'categories_prod' : 'categories_dev';

// Helper: elimina recursivamente todas las subcategorías de una categoría dada en dos fases
// Fase 1: marcar hijos directos con internalCascadeDelete y COMMIT
// Fase 2: procesar recursivamente descendientes
// Fase 3: borrar hijos directos en batch y COMMIT
async function deleteSubcategoriesRecursiveBatch(parentCategoryId: string): Promise<number> {
  let deletedCount = 0;
  const subcatsSnap = await db
    .collection('categories')
    .where('parentId', '==', parentCategoryId)
    .get();
  if (subcatsSnap.empty) return 0;

  // Fase 1: marcar hijos
  const markBatch = db.batch();
  for (const doc of subcatsSnap.docs) {
    markBatch.update(doc.ref, { internalCascadeDelete: true });
  }
  await markBatch.commit();

  // Fase 2: eliminar descendientes de cada hijo
  for (const doc of subcatsSnap.docs) {
    const childId = doc.id;
    deletedCount += await deleteSubcategoriesRecursiveBatch(childId);
  }

  // Fase 3: borrar hijos directos
  const deleteBatch = db.batch();
  for (const doc of subcatsSnap.docs) {
    deleteBatch.delete(doc.ref);
    deletedCount += 1;
    console.log(`[Categories] Deleted child category ${doc.id} (parent ${parentCategoryId})`);
  }
  await deleteBatch.commit();

  return deletedCount;
}

export const onCategoryCreated = onDocumentCreated(
  { 
    document: "categories/{categoryId}", 
    secrets: [algoliaAdminKey, algoliaAppId],
    memory: "2GiB",
    timeoutSeconds: 300
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("No data associated with the event");
      return;
    }
    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const batch = db.batch();
    const categoryId = event.params.categoryId;
    const categoryRef = db.collection("categories").doc(categoryId);
    const countersRef = db.collection("metadata").doc("counters");

    // Sync with algolia
    syncDocumentAlgolia(CATEGORIES_ALGOLIA_INDEX, categoryId, data, adminKey, appId);

    // Process image if exists
    if (data.image) {
      const processedPhoto = await processCategoriesImages(categoryId, data.image);
      batch.update(categoryRef, {
        image: processedPhoto,
        processing: false
      });
    }

    // Incrementar contador de categorías (merge para crear doc/campo si no existe)
    batch.set(countersRef, {
      categories: FieldValue.increment(1)
    }, { merge: true });

    console.log(`[Categories] Created category ${categoryId}, incrementing counter`);
    await batch.commit();
  })

export const onCategoryUpdated = onDocumentUpdated(
  { 
    document: "categories/{categoryId}", 
    secrets: [algoliaAdminKey, algoliaAppId],
    memory: "2GiB",
    timeoutSeconds: 300
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    
    if (!before || !after) {
      console.log("No data associated with the event");
      return;
    }

    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const batch = db.batch();
    const categoryId = event.params.categoryId;
    const categoryRef = db.collection("categories").doc(categoryId);

    // Sincronizar con Algolia
    syncDocumentAlgolia(CATEGORIES_ALGOLIA_INDEX, categoryId, after, adminKey, appId);

    // Verificar si la imagen ha cambiado
    const imageChanged = before.image?.path !== after.image?.path;
    
    if (imageChanged) {
      // Borrar la imagen anterior si existe
      if (before.image?.path) {
        try {
          // Verificar si el archivo existe antes de intentar eliminarlo
          const file = storage.bucket().file(before.image.path);
          const [exists] = await file.exists();
          
          if (exists) {
            await file.delete();
            console.log(`Previous category image deleted: ${before.image.path}`);
          } else {
            console.log(`Previous category image already deleted or doesn't exist: ${before.image.path}`);
          }
        } catch (error) {
          console.warn(`Could not delete previous category image: ${before.image.path}`, error);
        }
      }

      // Procesar la nueva imagen si existe
      if (after.image && after.image.processing === true) {
        try {
          const processedPhoto = await processCategoriesImages(categoryId, after.image);
          batch.update(categoryRef, {
            image: processedPhoto,
            processing: false
          });
        } catch (error) {
          console.error(`Error processing category image for ${categoryId}:`, error);
          batch.update(categoryRef, {
            processing: false
          });
        }
      }
    } else {
      // Si no hay cambio de imagen pero está en procesamiento, actualizar estado
      if (after.processing === true) {
        batch.update(categoryRef, {
          processing: false
        });
      }
    }

    await batch.commit();
  })

export const onCategoryDeleted = onDocumentDeleted(
  { 
    document: "categories/{categoryId}", 
    secrets: [algoliaAdminKey, algoliaAppId],
    memory: "2GiB",
    timeoutSeconds: 300
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("No data associated with the event");
      return;
    }
    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const categoryId = event.params.categoryId;
    const countersRef = db.collection("metadata").doc("counters");

    // Si el borrado es interno (por cascada), NO decrementar contador (ya lo hace el padre)
    if (data.internalCascadeDelete) {
      console.log(`[Categories] Internal cascade delete for ${categoryId}, skipping counter (handled by parent)`);
      return;
    }

    // Remover de Algolia
    removeDocumentAlgolia(CATEGORIES_ALGOLIA_INDEX, categoryId, adminKey, appId);

    // Si es una categoría principal (tiene imagen), borrar la imagen
    if (data.image && data.image.path) {
      try {
        await storage.bucket().file(data.image.path).delete();
        console.log(`Category image successfully deleted: ${data.image.path}`);
      } catch (error) {
        console.warn(`Could not delete category image: ${data.image.path}`, error);
      }
    }

    // Eliminar recursivamente subcategorías en batch
    let totalDeleted = 1; // La categoría actual
    try {
      const removed = await deleteSubcategoriesRecursiveBatch(categoryId);
      totalDeleted += removed;
      console.log(`[Categories] Recursively batch removed ${removed} descendant categories for ${categoryId}`);
    } catch (err) {
      console.error(`[Categories] Error recursively removing descendants for ${categoryId}:`, err);
    }

    // Decrementar contador por todas las categorías eliminadas (merge para crear doc/campo si no existe)
    await countersRef.set({
      categories: FieldValue.increment(-totalDeleted)
    }, { merge: true });

    console.log(`Category ${categoryId} deleted successfully. Total categories removed: ${totalDeleted}`);
  })
