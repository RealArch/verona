import { Router, Request, Response } from 'express';
import * as admin from "firebase-admin";

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

export default categoriesRouter;