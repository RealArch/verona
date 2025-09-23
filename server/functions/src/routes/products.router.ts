import { onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/firestore';


import { Router, Request, Response } from 'express';

import * as admin from "firebase-admin";
import { db } from '../firebase-init';
import { onDocumentCreated } from 'firebase-functions/firestore';
import { processProductImages } from '../utils/processImages';
import { ProductPhoto } from '../interfaces/productPhoto';
import { FieldValue } from 'firebase-admin/firestore';
import { removePhotoArrayImages } from '../utils/removePhotoArray';
import { defineSecret } from 'firebase-functions/params';
import { removeDocumentAlgolia, syncDocumentAlgolia } from '../utils/syncWithAlgolia';
import { getMinMaxPrice } from '../utils/getMinMaxPrice';

// Define los secrets
const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");
const algoliaAppId = defineSecret("ALGOLIA_APP_ID");

// Define el nombre del índice una sola vez
const PRODUCTS_ALGOLIA_INDEX = !process.env.FUNCTIONS_EMULATOR ? 'products_prod' : 'products_dev';

const productsRouter: Router = Router();

productsRouter.get('/', async (req: Request, res: Response) => {
    const products = await admin.firestore().collection('products').get();
    const productList = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(productList);
});


export const onProductCreated = onDocumentCreated(
    { document: "products/{productId}", secrets: [algoliaAdminKey, algoliaAppId] },
    async (event) => {
        const data = event.data?.data();
        if (!data) {
            console.log("No data associated with the event");
            return;
        }

        const productId = event.params.productId;
        const adminKey = algoliaAdminKey.value();
        const appId = algoliaAppId.value();

        console.log(`Processing product creation: ${productId}`);

        // Calcular precios
        const { minPrice, maxPrice } = getMinMaxPrice(data);
        console.log(`Calculated prices: minPrice=${minPrice}, maxPrice=${maxPrice}`);

        // Preparar referencias
        const batch = db.batch();
        const countersRef = db.collection("metadata").doc("counters");
        const productsRef = db.collection("products").doc(productId);

        // Sincronizar con Algolia (sin await - ejecutar en paralelo)
        syncDocumentAlgolia(PRODUCTS_ALGOLIA_INDEX, productId, data, adminKey, appId);

        // Preparar actualizaciones del producto
        const updatedAt = FieldValue.serverTimestamp();
        const productUpdates: any = {
            minPrice,
            maxPrice,
            createdAt: updatedAt,
            updatedAt: updatedAt
        };
        console.log(`Product updates prepared:`, JSON.stringify(productUpdates));

        // Procesar imágenes si es necesario
        const hasPhotosToProcess = Array.isArray(data.photos) &&
            data.photos.some((photo: ProductPhoto) => photo.processing === true);

        if (hasPhotosToProcess) {
            console.log("Processing images for product:", productId);
            const processedPhotos = await processProductImages(productId, data.photos as ProductPhoto[]);
            productUpdates.photos = processedPhotos;
            productUpdates.processing = false;
        }

        console.log(`Final product updates:`, JSON.stringify(productUpdates, null, 2));

        // Actualizar producto
        batch.update(productsRef, productUpdates);

        // Actualizar contadores
        const counterUpdates: any = { products: FieldValue.increment(1) };
        if (data.status === "active") {
            counterUpdates.products_active = FieldValue.increment(1);
        } else if (data.status === "paused") {
            counterUpdates.products_paused = FieldValue.increment(1);
        }

        batch.update(countersRef, counterUpdates);

        await batch.commit();
        console.log(`Product ${productId} created successfully with minPrice: ${minPrice}, maxPrice: ${maxPrice}`);
    }
);

export const onProductUpdated = onDocumentUpdated(
    { document: "products/{productId}", secrets: [algoliaAdminKey, algoliaAppId] },
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) {
            console.log("No data associated with the event");
            return;
        }

        const productId = event.params.productId;
        const adminKey = algoliaAdminKey.value();
        const appId = algoliaAppId.value();

        console.log(`Processing product update: ${productId}`);

        // Preparar referencias
        const batch = db.batch();
        const countersRef = db.collection("metadata").doc("counters");
        const productsRef = db.collection("products").doc(productId);

        // Sincronizar con Algolia (sin await - ejecutar en paralelo)
        syncDocumentAlgolia(PRODUCTS_ALGOLIA_INDEX, productId, after, adminKey, appId);

        // Calcular precios actualizados
        const { minPrice, maxPrice } = getMinMaxPrice(after);
        console.log(`Updated prices: minPrice=${minPrice}, maxPrice=${maxPrice}`);

        // Verificar si realmente necesitamos actualizar los precios
        const pricesChanged = before.minPrice !== minPrice || before.maxPrice !== maxPrice;
        const needsImageProcessing = after.processing === true;
        const hasImagesToDelete = Array.isArray(after.imagesToDelete) && after.imagesToDelete.length > 0;
        const statusChanged = before.status !== after.status;

        // Si no hay cambios significativos, salir
        if (!pricesChanged && !needsImageProcessing && !hasImagesToDelete && !statusChanged) {
            console.log(`No significant changes for product ${productId}, skipping update`);
            return;
        }

        console.log(`Changes detected - prices: ${pricesChanged}, processing: ${needsImageProcessing}, images to delete: ${hasImagesToDelete}, status: ${statusChanged}`);

        // Preparar actualizaciones del producto solo si hay cambios
        const productUpdates: any = {};

        if (pricesChanged) {
            productUpdates.minPrice = minPrice;
            productUpdates.maxPrice = maxPrice;
        }

        console.log(`Product updates prepared:`, JSON.stringify(productUpdates));

        // Procesar según el estado de procesamiento
        if (needsImageProcessing) {
            // Procesar imágenes si es necesario
            const hasPhotosToProcess = Array.isArray(after.photos) && after.photos.length > 0;

            if (hasPhotosToProcess) {
                console.log("Processing images for updated product:", productId);
                const processedPhotos = await processProductImages(productId, after.photos as ProductPhoto[]);
                productUpdates.photos = processedPhotos;
            }

            productUpdates.processing = false;
        }

        // Manejar eliminación de imágenes
        if (hasImagesToDelete) {
            console.log(`Deleting ${after.imagesToDelete.length} images for product ${productId}`);
            removePhotoArrayImages(after.imagesToDelete);
            productUpdates.imagesToDelete = [];
        }

        console.log(`Final product updates:`, JSON.stringify(productUpdates, null, 2));

        // Solo actualizar si hay cambios
        if (Object.keys(productUpdates).length > 0) {
            batch.update(productsRef, productUpdates);
        }

        // Manejar cambios de estado para contadores
        if (statusChanged) {
            console.log(`Status changed from ${before.status} to ${after.status} for product ${productId}`);

            const statusToField: { [key: string]: string } = {
                active: 'products_active',
                paused: 'products_paused'
            };

            const statusUpdates: { [key: string]: admin.firestore.FieldValue } = {};

            // Decrementar contador del estado anterior
            const oldStatusField = statusToField[before.status];
            if (oldStatusField) {
                statusUpdates[oldStatusField] = FieldValue.increment(-1);
            }

            // Incrementar contador del nuevo estado
            const newStatusField = statusToField[after.status];
            if (newStatusField && newStatusField !== oldStatusField) {
                statusUpdates[newStatusField] = FieldValue.increment(1);
            }

            // Aplicar cambios de estado
            if (Object.keys(statusUpdates).length > 0) {
                batch.update(countersRef, statusUpdates);
            }
        }

        // Solo hacer commit si hay cambios que aplicar
        const hasBatchOperations = Object.keys(productUpdates).length > 0 || statusChanged;

        if (hasBatchOperations) {
            await batch.commit();
            console.log(`Product ${productId} updated successfully`);
        } else {
            console.log(`No changes to commit for product ${productId}`);
        }

        // Remover la verificación de timeout para evitar más triggers
    }
);
export const onProductDeleted = onDocumentDeleted({ document: "products/{productId}", secrets: [algoliaAdminKey, algoliaAppId] },
    async (event) => {
        const data = event.data?.data();
        if (!data) {
            console.log("No data associated with the event");
            return;
        }
        const adminKey = algoliaAdminKey.value();
        const appId = algoliaAppId.value();
        const batch = db.batch();
        const countersRef = db.collection("metadata").doc("counters");
        //Sync with algolia
        removeDocumentAlgolia(PRODUCTS_ALGOLIA_INDEX, event.params.productId, adminKey, appId);

        if (Array.isArray(data.photos) && data.photos.length > 0) {
            removePhotoArrayImages(data.photos);
        }

        batch.update(countersRef, { products: FieldValue.increment(-1) })
        if (data.status === "active") {
            batch.set(countersRef, { products_active: FieldValue.increment(-1) }, { merge: true })
        } else if (data.status === "paused") {
            batch.set(countersRef, { products_paused: FieldValue.increment(-1) }, { merge: true })
        }
        batch.commit()
    });


export default productsRouter;



