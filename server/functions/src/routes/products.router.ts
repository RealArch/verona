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


export const onProductCreated = onDocumentCreated({ document: "products/{productId}", secrets: [algoliaAdminKey, algoliaAppId] },
    async (event) => {
        const data = event.data?.data();
        if (!data) {
            console.log("No data associated with the event");
            return;
        }
        const batch = db.batch()
        const adminKey = algoliaAdminKey.value();
        const appId = algoliaAppId.value();
        const productId = event.params.productId;
        const countersRef = db.collection("metadata").doc("counters");
        const productsRef = db.collection("products").doc(productId);
        //Sync with algolia
        syncDocumentAlgolia(PRODUCTS_ALGOLIA_INDEX, productId, data, adminKey, appId);

        // Procesar imágenes si corresponde
        console.log("Processing images for product:", productId);
        if (Array.isArray(data.photos) && data.photos.some((f: ProductPhoto) => f.processing === true)) {
            const processedPhotos = await processProductImages(productId, data.photos as ProductPhoto[]);
            batch.update(productsRef, {
                photos: processedPhotos,
                processing: false
            });

        }
        // Actualizar contadores en metadata/counters

        batch.update(countersRef, { products: FieldValue.increment(1) })
        // const updates: any = { products: admin.firestore.FieldValue.increment(1) };
        console.log("Product status:", data.status);
        if (data.status === "active") {
            batch.set(countersRef, { products_active: FieldValue.increment(1) }, { merge: true })
        } else if (data.status === "paused") {
            batch.set(countersRef, { products_paused: FieldValue.increment(1) }, { merge: true })
        }
        // await countersRef.set(updates, { merge: true });
        batch.commit()
    });

export const onProductUpdated = onDocumentUpdated({ document: "products/{productId}", secrets: [algoliaAdminKey, algoliaAppId] },
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();
        const batch = db.batch();
        const countersRef = db.collection("metadata").doc("counters");
        const productsRef = db.collection("products").doc(event.params.productId);
        const adminKey = algoliaAdminKey.value();
        const appId = algoliaAppId.value();

        //Sync with algolia
        syncDocumentAlgolia(PRODUCTS_ALGOLIA_INDEX, event.params.productId, after, adminKey, appId);

        if (!before || !after) {
            console.log("No data associated with the event");
            return;
        }
        if (after.processing == false) {
            return;
        }

        const processedPhotos = await processProductImages(event.params.productId, after.photos as ProductPhoto[]);
        batch.update(productsRef, { photos: processedPhotos });


        if (after.imagesToDelete.length > 0) {
            removePhotoArrayImages(after.imagesToDelete);
            batch.update(productsRef, {
                imagesToDelete: []
            });
        }

        if (before.status !== after.status) {

            // Decrement old status counter
            if (before.status === "active") {
                batch.set(countersRef, { products_active: FieldValue.increment(-1) }, { merge: true });
            } else if (before.status === "paused") {
                batch.set(countersRef, { products_paused: FieldValue.increment(-1) }, { merge: true });
            }

            // Increment new status counter
            if (after.status === "active") {
                batch.set(countersRef, { products_active: FieldValue.increment(1) }, { merge: true });
            } else if (after.status === "paused") {
                batch.set(countersRef, { products_paused: FieldValue.increment(1) }, { merge: true });
            }

        }
        batch.update(productsRef, { processing: false });

        await batch.commit();

    })
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

        if (Array.isArray(data.photos) || data.photos.length > 0) {
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



