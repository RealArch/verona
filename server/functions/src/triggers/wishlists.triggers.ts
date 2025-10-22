import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Trigger que se ejecuta cuando se crea una wishlist
 * - Incrementa el contador de wishlist del usuario
 */
export const onWishlistCreated = onDocumentCreated(
  { document: "wishlists/{wishlistId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("[Wishlist] No data associated with the event");
      return;
    }

    const wishlistId = event.params.wishlistId;
    const userId = data.userId;

    if (!userId) {
      console.warn(`[Wishlist] Wishlist ${wishlistId} created without userId`);
      return;
    }

    const itemCount = Array.isArray(data.items) ? data.items.length : 0;

    console.log(`[Wishlist] Created wishlist ${wishlistId} for user ${userId} with ${itemCount} items`);

    try {
      const userRef = db.collection("users").doc(userId);
      
      await userRef.update({
        'counters.wishlist': FieldValue.increment(itemCount)
      });

      console.log(`[Wishlist] Incremented wishlist counter by ${itemCount} for user ${userId}`);
    } catch (error) {
      console.error(`[Wishlist] Error updating wishlist counter for user ${userId}:`, error);
      throw error;
    }
  }
);


/**
 * Trigger que se ejecuta cuando se elimina una wishlist
 * - Decrementa el contador de wishlist del usuario
 */
export const onWishlistDeleted = onDocumentDeleted(
  { document: "wishlists/{wishlistId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("[Wishlist] No data associated with the event");
      return;
    }

    const wishlistId = event.params.wishlistId;
    const userId = data.userId;

    if (!userId) {
      console.warn(`[Wishlist] Wishlist ${wishlistId} deleted without userId`);
      return;
    }

    const itemCount = Array.isArray(data.items) ? data.items.length : 0;

    console.log(`[Wishlist] Deleted wishlist ${wishlistId} for user ${userId} with ${itemCount} items`);

    try {
      const userRef = db.collection("users").doc(userId);
      
      await userRef.update({
        'counters.wishlist': FieldValue.increment(-itemCount)
      });

      console.log(`[Wishlist] Decremented wishlist counter by ${itemCount} for user ${userId}`);
    } catch (error) {
      console.error(`[Wishlist] Error updating wishlist counter for user ${userId}:`, error);
      throw error;
    }
  }
);
