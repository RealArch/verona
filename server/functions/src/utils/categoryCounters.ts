import { db } from '../firebase-init';
import { FieldValue } from 'firebase-admin/firestore';
import { Category } from '../interfaces/category.interface';

/**
 * Helper function to get all parent category IDs from a given category
 * @param categoryId - The ID of the category to get parents from
 * @returns Array of parent category IDs (from immediate parent to root)
 */
export async function getParentCategoryIds(categoryId: string): Promise<string[]> {
  const parentIds: string[] = [];
  let currentCategoryId = categoryId;

  while (currentCategoryId && currentCategoryId !== 'root') {
    const categoryDoc = await db.collection('categories').doc(currentCategoryId).get();
    
    if (!categoryDoc.exists) {
      console.warn(`[CategoryCounters] Category ${currentCategoryId} not found`);
      break;
    }

    const categoryData = categoryDoc.data() as Category;
    const parentId = categoryData.parentId;

    if (parentId && parentId !== 'root') {
      parentIds.push(parentId);
      currentCategoryId = parentId;
    } else {
      break;
    }
  }

  return parentIds;
}

/**
 * Increment or decrement product counter for a category and all its parents
 * @param categoryId - The ID of the category
 * @param increment - The value to increment (1 for add, -1 for remove)
 * @returns Promise that resolves when all updates are committed
 */
export async function updateCategoryProductCounters(categoryId: string, increment: number): Promise<void> {
  if (!categoryId || categoryId === 'root') {
    console.log('[CategoryCounters] No valid category to update counters');
    return;
  }

  try {
    const batch = db.batch();
    const categoryRef = db.collection('categories').doc(categoryId);

    // Update the main category
    batch.update(categoryRef, {
      'counters.products': FieldValue.increment(increment)
    });

    console.log(`[CategoryCounters] Updating category ${categoryId} counter by ${increment}`);

    // Get and update all parent categories
    const parentIds = await getParentCategoryIds(categoryId);
    
    for (const parentId of parentIds) {
      const parentRef = db.collection('categories').doc(parentId);
      batch.update(parentRef, {
        'counters.products': FieldValue.increment(increment)
      });
      console.log(`[CategoryCounters] Updating parent category ${parentId} counter by ${increment}`);
    }

    await batch.commit();
    console.log(`[CategoryCounters] Successfully updated product counters for category ${categoryId} and ${parentIds.length} parent(s)`);
  } catch (error) {
    console.error(`[CategoryCounters] Error updating counters for category ${categoryId}:`, error);
    throw error;
  }
}

/**
 * Move product counter from one category to another (when a product's category changes)
 * @param oldCategoryId - The category ID where the product was before
 * @param newCategoryId - The category ID where the product is now
 * @returns Promise that resolves when all updates are committed
 */
export async function moveCategoryProductCounter(oldCategoryId: string, newCategoryId: string): Promise<void> {
  if (!oldCategoryId || !newCategoryId || oldCategoryId === newCategoryId) {
    console.log('[CategoryCounters] Invalid category IDs for move operation');
    return;
  }

  console.log(`[CategoryCounters] Moving product counter from ${oldCategoryId} to ${newCategoryId}`);
  
  try {
    // Decrement old category and its parents
    await updateCategoryProductCounters(oldCategoryId, -1);
    
    // Increment new category and its parents
    await updateCategoryProductCounters(newCategoryId, 1);
    
    console.log(`[CategoryCounters] Successfully moved product counter from ${oldCategoryId} to ${newCategoryId}`);
  } catch (error) {
    console.error(`[CategoryCounters] Error moving product counter:`, error);
    throw error;
  }
}
