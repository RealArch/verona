import { onDocumentDeleted } from 'firebase-functions/firestore';


import { Router, Request, Response } from 'express';

import * as admin from "firebase-admin";
import { db, storage } from '../firebase-init';
import { onDocumentCreated } from 'firebase-functions/firestore';
import { processProductImages } from '../utils/processProductImages';
import { logger } from 'firebase-functions/v1';
import { ProductPhoto } from '../interfaces/productPhoto';

const productsRouter: Router = Router();

productsRouter.get('/', async (req: Request, res: Response) => {
    const products = await admin.firestore().collection('products').get();
    const productList = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(productList);
});


export const onProductCreated = onDocumentCreated("products/{productId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (Array.isArray(data.photos) && data.photos.some((f: ProductPhoto) => f.processing === true)) {
        const productId = event.params.productId;
        const processedPhotos = await processProductImages(productId, data.photos as ProductPhoto[]);
        // Actualizar el documento con las fotos procesadas
        await db.collection("products").doc(productId).update({
            photos: processedPhotos,
            processing: false
        });
    }
});
export const onProductDeleted = onDocumentDeleted("products/{productId}", async (event) => {
    const data = event.data?.data();
    if (!data || !Array.isArray(data.photos)) return;
    for (const photo of data.photos) {
        if (photo.path) {
            try {
                await storage.bucket().file(photo.path).delete();
            } catch (err) {
                // Puedes loggear el error si lo deseas con un logger.error
                logger.error(`Error deleting file ${photo.path}:`, err);
            }
        }
    }
});


export default productsRouter;



