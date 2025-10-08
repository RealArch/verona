import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import { syncDocumentAlgolia, removeDocumentAlgolia } from '../utils/syncWithAlgolia';

// Define los secrets para Algolia
const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");
const algoliaAppId = defineSecret("ALGOLIA_APP_ID");

// Definir el índice de Algolia para órdenes (diferente para producción y desarrollo)
const ORDERS_ALGOLIA_INDEX = !process.env.FUNCTIONS_EMULATOR ? 'orders_prod' : 'orders_dev';

const db = admin.firestore();

/**
 * Trigger que se ejecuta cuando se crea una nueva orden
 * - Sincroniza la orden con Algolia
 * - Incrementa el contador de órdenes en metadata
 * - Incrementa los contadores de ventas por tipo de entrega
 */
export const onOrderCreated = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [algoliaAdminKey, algoliaAppId] },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("No data associated with the event");
      return;
    }

    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const orderId = event.params.orderId;
    const deliveryMethod = data.deliveryMethod;

    // Preparar datos para Algolia (omitir información sensible si es necesario)
    const algoliaData = {
      ...data,
      // Convertir timestamps a formato que Algolia pueda indexar
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
      updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
      // Agregar campos útiles para búsqueda
      userId: data.userId,
      status: data.status,
      total: data.totals?.total || 0,
      itemCount: data.totals?.itemCount || 0,
    };

    // Sincronizar con Algolia (sin await - ejecutar en paralelo)
    syncDocumentAlgolia(ORDERS_ALGOLIA_INDEX, orderId, algoliaData, adminKey, appId);

    const batch = db.batch();
    const countersRef = db.collection("metadata").doc("counters");

    // Incrementar contador de órdenes
    batch.set(countersRef, {
      orders: FieldValue.increment(1)
    }, { merge: true });

    // Incrementar contadores de ventas
    if (deliveryMethod) {
      const salesUpdates: any = {
        'sales.total': FieldValue.increment(1)
      };

      // Incrementar contador específico por método de entrega
      switch (deliveryMethod) {
        case 'pickup':
          salesUpdates['sales.byDeliveryMethod.pickup'] = FieldValue.increment(1);
          break;
        case 'homeDelivery':
          salesUpdates['sales.byDeliveryMethod.homeDelivery'] = FieldValue.increment(1);
          break;
        case 'shipping':
          salesUpdates['sales.byDeliveryMethod.shipping'] = FieldValue.increment(1);
          break;
        case 'arrangeWithSeller':
          salesUpdates['sales.byDeliveryMethod.arrangeWithSeller'] = FieldValue.increment(1);
          break;
        default:
          console.warn(`[Orders] Unknown delivery method: ${deliveryMethod}`);
      }

      batch.update(countersRef, salesUpdates);
      console.log(`[Orders] Incremented sales counters for delivery method: ${deliveryMethod}`);
    } else {
      console.warn(`[Orders] Order ${orderId} has no delivery method, skipping sales counters`);
    }

    await batch.commit();
    console.log(`[Orders] Created order ${orderId}, incremented all counters`);
  }
);

/**
 * Trigger que se ejecuta cuando se actualiza una orden
 * - Sincroniza los cambios con Algolia
 */
export const onOrderUpdated = onDocumentUpdated(
  { document: "orders/{orderId}", secrets: [algoliaAdminKey, algoliaAppId] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      console.log("No data associated with the event");
      return;
    }

    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const orderId = event.params.orderId;

    // Preparar datos actualizados para Algolia
    const algoliaData = {
      ...after,
      // Convertir timestamps a formato que Algolia pueda indexar
      createdAt: after.createdAt?.toMillis ? after.createdAt.toMillis() : after.createdAt,
      updatedAt: after.updatedAt?.toMillis ? after.updatedAt.toMillis() : after.updatedAt,
      // Agregar campos útiles para búsqueda
      userId: after.userId,
      status: after.status,
      total: after.totals?.total || 0,
      itemCount: after.totals?.itemCount || 0,
    };

    // Sincronizar cambios con Algolia (sin await - ejecutar en paralelo)
    syncDocumentAlgolia(ORDERS_ALGOLIA_INDEX, orderId, algoliaData, adminKey, appId);

    console.log(`[Orders] Updated order ${orderId}, synced with Algolia`);
  }
);

/**
 * Trigger que se ejecuta cuando se elimina una orden
 * - Elimina la orden de Algolia
 * - Decrementa el contador de órdenes en metadata
 * - Decrementa el contador de compras del usuario (counters.purchases)
 * - Decrementa los contadores de ventas por tipo de entrega
 */
export const onOrderDeleted = onDocumentDeleted(
  { document: "orders/{orderId}", secrets: [algoliaAdminKey, algoliaAppId] },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("No data associated with the event");
      return;
    }

    const adminKey = algoliaAdminKey.value();
    const appId = algoliaAppId.value();
    const orderId = event.params.orderId;
    const userId = data.userData?.uid; // Obtener UID del userData
    const deliveryMethod = data.deliveryMethod;

    // Remover de Algolia
    removeDocumentAlgolia(ORDERS_ALGOLIA_INDEX, orderId, adminKey, appId);

    const batch = db.batch();
    const countersRef = db.collection("metadata").doc("counters");

    // Decrementar contador global de órdenes
    batch.set(countersRef, {
      orders: FieldValue.increment(-1)
    }, { merge: true });

    // Decrementar contadores de ventas
    if (deliveryMethod) {
      const salesUpdates: any = {
        'sales.total': FieldValue.increment(-1)
      };

      // Decrementar contador específico por método de entrega
      switch (deliveryMethod) {
        case 'pickup':
          salesUpdates['sales.byDeliveryMethod.pickup'] = FieldValue.increment(-1);
          break;
        case 'homeDelivery':
          salesUpdates['sales.byDeliveryMethod.homeDelivery'] = FieldValue.increment(-1);
          break;
        case 'shipping':
          salesUpdates['sales.byDeliveryMethod.shipping'] = FieldValue.increment(-1);
          break;
        case 'arrangeWithSeller':
          salesUpdates['sales.byDeliveryMethod.arrangeWithSeller'] = FieldValue.increment(-1);
          break;
        default:
          console.warn(`[Orders] Unknown delivery method: ${deliveryMethod}`);
      }

      batch.update(countersRef, salesUpdates);
      console.log(`[Orders] Decremented sales counters for delivery method: ${deliveryMethod}`);
    } else {
      console.warn(`[Orders] Order ${orderId} has no delivery method, skipping sales counters decrement`);
    }

    // Decrementar contador de compras del usuario
    if (userId) {
      const userRef = db.collection("users").doc(userId);
      batch.update(userRef, {
        'counters.purchases': FieldValue.increment(-1)
      });
      console.log(`[Orders] Decremented purchase counter for user ${userId}`);
    } else {
      console.warn(`[Orders] Order ${orderId} has no userId, skipping user counter decrement`);
    }

    await batch.commit();

    console.log(`[Orders] Deleted order ${orderId}, decremented all counters`);
  }
);
