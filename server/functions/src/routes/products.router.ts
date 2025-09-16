import { onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/firestore';


import { Router, Request, Response } from 'express';

import * as admin from "firebase-admin";
import { db } from '../firebase-init';
import { onDocumentCreated } from 'firebase-functions/firestore';
import { processProductImages } from '../utils/processProductImages';
import { ProductPhoto } from '../interfaces/productPhoto';
import { FieldValue } from 'firebase-admin/firestore';
import { removePhotoArrayImages } from '../utils/removePhotoArray';

const productsRouter: Router = Router();

productsRouter.get('/', async (req: Request, res: Response) => {
    const products = await admin.firestore().collection('products').get();
    const productList = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(productList);
});


export const onProductCreated = onDocumentCreated("products/{productId}", async (event) => {
    console.log("-----------------------------")
    const data = event.data?.data();
    if (!data) {
        console.log("No data associated with the event");
        return;
    }
    // Procesar imágenes si corresponde
    console.log("Processing images for product:", event.params.productId);
    if (Array.isArray(data.photos) && data.photos.some((f: ProductPhoto) => f.processing === true)) {
        const productId = event.params.productId;
        const processedPhotos = await processProductImages(productId, data.photos as ProductPhoto[]);
        await db.collection("products").doc(productId).update({
            photos: processedPhotos,
            processing: false
        });
    }
    // Actualizar contadores en metadata/counters
    const batch = db.batch()
    const countersRef = db.collection("metadata").doc("counters");
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
export const onProductUpdated = onDocumentUpdated("products/{productId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
        console.log("No data associated with the event");
        return;
    }

    if (before.status !== after.status) {
        const batch = db.batch();
        const countersRef = db.collection("metadata").doc("counters");

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

        await batch.commit();
    }
})
export const onProductDeleted = onDocumentDeleted("products/{productId}", async (event) => {
    const data = event.data?.data();
    if (!data || !Array.isArray(data.photos) || data.photos.length === 0) return;
    removePhotoArrayImages(data.photos);

    const batch = db.batch()
    const countersRef = db.collection("metadata").doc("counters");
    batch.update(countersRef, { products: FieldValue.increment(-1) })
    if (data.status === "active") {
        batch.set(countersRef, { products_active: FieldValue.increment(-1) }, { merge: true })
    } else if (data.status === "paused") {
        batch.set(countersRef, { products_paused: FieldValue.increment(-1) }, { merge: true })
    }
    batch.commit()
});


export default productsRouter;



