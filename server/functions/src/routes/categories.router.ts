import { Router, Request, Response } from 'express';
import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/firestore';
import { defineSecret } from 'firebase-functions/params';
import { syncDocumentAlgolia, removeDocumentAlgolia } from '../utils/syncWithAlgolia';
import { processCategoriesImages } from '../utils/processImages';
import { db, storage } from '../firebase-init';

// Define los secrets
const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");
const algoliaAppId = defineSecret("ALGOLIA_APP_ID");

// Define el nombre del índice una sola vez
const CATEGORIES_ALGOLIA_INDEX = !process.env.FUNCTIONS_EMULATOR ? 'categories_prod' : 'categories_dev';

const categoriesRouter: Router = Router();

categoriesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const newCategory = req.body;
    const docRef = await admin.firestore().collection('categories').add(newCategory);
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

categoriesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await admin.firestore().collection('categories').doc(id).update(updates);
    res.status(200).json({ message: 'Category updated' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

categoriesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await admin.firestore().collection('categories').doc(id).delete();
    res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});


export const onCategoryCreated = onDocumentCreated({ document: "categories/{categoryId}", secrets: [algoliaAdminKey, algoliaAppId] },
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

    //Sync with algolia
    syncDocumentAlgolia(CATEGORIES_ALGOLIA_INDEX, categoryId, data, adminKey, appId);

    //
    if (data.image) {
      const processedPhoto = await processCategoriesImages(categoryId, data.image);
      batch.update(categoryRef, {
        image: processedPhoto,
        processing: false
      });
    }


    batch.commit()

  })

export const onCategoryUpdated = onDocumentUpdated({ document: "categories/{categoryId}", secrets: [algoliaAdminKey, algoliaAppId] },
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

export const onCategoryDeleted = onDocumentDeleted({ document: "categories/{categoryId}", secrets: [algoliaAdminKey, algoliaAppId] },
  async (event) => {
    const data = event.data?.data();
    
    if (!data) {
      console.log("No data associated with the event");
      return;
    }

    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const categoryId = event.params.categoryId;

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

    console.log(`Category ${categoryId} deleted successfully`);
  })

export default categoriesRouter;