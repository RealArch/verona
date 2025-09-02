import { Router, Request, Response } from 'express';
import * as admin from "firebase-admin";

const categoriesRouter: Router = Router();

categoriesRouter.get('/', async (req: Request, res: Response) => {
    try {
        const snapshot = await admin.firestore().collection('categories')
            .orderBy('order')
            .get();

        const categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

export default categoriesRouter;