import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import { syncDocumentAlgolia, removeDocumentAlgolia } from '../utils/syncWithAlgolia';
import {
  sendOrderConfirmationEmail,
  sendOrderCancelledEmail,
  sendOrderCompletedEmail,
  emailUser,
  emailPassword,
  emailFrom,
  emailHost,
  emailPort,
  OrderEmailPayload
} from '../utils/emailService';

// Define los secrets para Algolia
const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");
const algoliaAppId = defineSecret("ALGOLIA_APP_ID");

// Definir el índice de Algolia para órdenes (diferente para producción y desarrollo)
const ORDERS_ALGOLIA_INDEX = !process.env.FUNCTIONS_EMULATOR ? 'orders_prod' : 'orders_dev';

const db = admin.firestore();

function formatOrderDateForVenezuela(timestamp: any): string {
  const baseDate = timestamp?.toMillis ? new Date(timestamp.toMillis()) : new Date();
  return baseDate.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildOrderEmailPayload(orderId: string, data: FirebaseFirestore.DocumentData, orderDate: string): OrderEmailPayload | null {
  if (!data?.userData?.email || !data?.userData?.firstName) {
    console.warn(`[Orders] Cannot prepare email for order ${orderId}: missing user email or first name`);
    return null;
  }

  const items = Array.isArray(data.items) ? data.items : [];
  const totals = data.totals || {};
  const itemCount = typeof totals.itemCount === 'number'
    ? totals.itemCount
    : items.reduce((acc: number, item: any) => acc + (item?.quantity || 0), 0);

  return {
    customerEmail: data.userData.email,
    customerFirstName: data.userData.firstName,
    orderId,
    orderDate,
    orderStatus: data.status || 'pending',
    paymentMethod: data.paymentMethod || 'No especificado',
    deliveryMethod: data.deliveryMethod || 'arrangeWithSeller',
    items,
    totals: {
      subtotal: totals.subtotal ?? 0,
      taxAmount: totals.taxAmount ?? 0,
      taxPercentage: totals.taxPercentage ?? 0,
      shippingCost: totals.shippingCost ?? null,
      total: totals.total ?? 0,
      itemCount
    },
    shippingAddress: data.shippingAddress || null,
    billingAddress: data.billingAddress || null,
    notes: data.notes || null,
    cancellationReason:
      data.cancellationReason || data.cancellation?.reason || data.statusReason || null,
    deliveryMessage:
      data.deliveryMessage || data.completionMessage || data.statusMessage || null
  };
}

const TRACKED_STATUSES = new Set(['pending', 'completed', 'cancelled']);

function normalizeTrackedStatus(status: any): string | null {
  if (status === undefined || status === null) {
    return null;
  }

  const normalized = String(status).toLowerCase();
  return TRACKED_STATUSES.has(normalized) ? normalized : null;
}

function buildStatusCounterTransition(beforeStatus: any, afterStatus: any): Record<string, any> {
  const beforeTracked = normalizeTrackedStatus(beforeStatus);
  const afterTracked = normalizeTrackedStatus(afterStatus);

  if (beforeTracked === afterTracked) {
    return {};
  }

  const statusUpdates: Record<string, FirebaseFirestore.FieldValue> = {};

  if (beforeTracked) {
    statusUpdates[beforeTracked] = FieldValue.increment(-1);
  }

  if (afterTracked) {
    statusUpdates[afterTracked] = FieldValue.increment(1);
  }

  if (Object.keys(statusUpdates).length === 0) {
    return {};
  }

  return {
    sales: {
      byStatus: statusUpdates
    }
  };
}

/**
 * Trigger que se ejecuta cuando se crea una nueva orden
 * - Sincroniza la orden con Algolia
 * - Incrementa el contador de órdenes en metadata
 * - Incrementa los contadores de ventas por tipo de entrega
 * - Envía email de confirmación al cliente
 */
export const onOrderCreated = onDocumentCreated(
  { 
    document: "orders/{orderId}", 
    secrets: [algoliaAdminKey, algoliaAppId, emailUser, emailPassword, emailFrom, emailHost, emailPort] 
  },
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

    // Incrementar contador de órdenes y estado inicial
    let creationStatus = normalizeTrackedStatus(data.status);
    if (!creationStatus && (data.status === undefined || data.status === null)) {
      creationStatus = 'pending';
    }

    const creationCounters: any = {
      orders: FieldValue.increment(1)
    };

    if (creationStatus) {
      creationCounters.sales = {
        byStatus: {
          [creationStatus]: FieldValue.increment(1)
        }
      };
    }

    batch.set(countersRef, creationCounters, { merge: true });

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

    const orderDate = formatOrderDateForVenezuela(data.createdAt);
    const confirmationPayload = buildOrderEmailPayload(orderId, data, orderDate);

    if (confirmationPayload) {
      try {
        await sendOrderConfirmationEmail(confirmationPayload);
        console.log(`[Orders] Order confirmation email sent successfully to ${confirmationPayload.customerEmail}`);
      } catch (error) {
        console.error(`[Orders] Error sending order confirmation email to ${confirmationPayload.customerEmail}:`, error);
      }
    } else {
      console.warn(`[Orders] Cannot send order confirmation email for order ${orderId}: missing user data`);
    }
  }
);

/**
 * Trigger que se ejecuta cuando se actualiza una orden
 * - Sincroniza los cambios con Algolia
 */
export const onOrderUpdated = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    secrets: [algoliaAdminKey, algoliaAppId, emailUser, emailPassword, emailFrom, emailHost, emailPort]
  },
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

    const statusBefore = before.status;
    const statusAfter = after.status;

    if (statusBefore === statusAfter) {
      return;
    }

    const statusCounterUpdates = buildStatusCounterTransition(statusBefore, statusAfter);
    if (Object.keys(statusCounterUpdates).length) {
      const countersRef = db.collection("metadata").doc("counters");
      await countersRef.set(statusCounterUpdates, { merge: true });
      console.log(`[Orders] Updated sales by status counters for order ${orderId}`);
    }

    const orderDate = formatOrderDateForVenezuela(after.createdAt);
    const payload = buildOrderEmailPayload(orderId, after, orderDate);

    if (!payload) {
      return;
    }

    try {
      if (statusAfter === 'cancelled') {
        const cancellationReason = after.cancellationReason || after.cancellation?.reason || after.statusReason || null;
        await sendOrderCancelledEmail({
          ...payload,
          orderStatus: statusAfter,
          cancellationReason
        });
        console.log(`[Orders] Cancellation email sent to ${payload.customerEmail} for order ${orderId}`);
      } else if (statusAfter === 'completed') {
        const deliveryMessage = after.deliveryMessage || after.completionMessage || payload.deliveryMessage || null;
        await sendOrderCompletedEmail({
          ...payload,
          orderStatus: statusAfter,
          deliveryMessage
        });
        console.log(`[Orders] Completion email sent to ${payload.customerEmail} for order ${orderId}`);
      }
    } catch (error) {
      console.error(`[Orders] Error sending status email for order ${orderId}:`, error);
    }
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

    // Decrementar contador global de órdenes y estado actual
    let deletionStatus = normalizeTrackedStatus(data.status);
    if (!deletionStatus && (data.status === undefined || data.status === null)) {
      deletionStatus = 'pending';
    }

    const deletionCounters: any = {
      orders: FieldValue.increment(-1)
    };

    if (deletionStatus) {
      deletionCounters.sales = {
        byStatus: {
          [deletionStatus]: FieldValue.increment(-1)
        }
      };
    }

    batch.set(countersRef, deletionCounters, { merge: true });

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
