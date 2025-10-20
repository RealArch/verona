import { Router, Request, Response } from 'express';
import * as admin from "firebase-admin";

const productsRouter: Router = Router();

productsRouter.get('/', async (req: Request, res: Response) => {
    const products = await admin.firestore().collection('products').get();
    const productList = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(productList);
});


export default productsRouter;

