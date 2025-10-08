import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Trigger que se ejecuta cuando se crea un nuevo usuario
 * - Incrementa el contador de usuarios en metadata/counters
 * - Inicializa contadores del usuario si no existen
 */
export const onUserCreated = onDocumentCreated(
    { document: "users/{userId}" },
    async (event) => {
        const data = event.data?.data();
        if (!data) {
            console.log("No data associated with the event");
            return;
        }

        const userId = event.params.userId;
        const batch = db.batch();

        // Incrementar contador global de usuarios
        const countersRef = db.collection("metadata").doc("counters");
        batch.set(countersRef, {
            users: {
                total: FieldValue.increment(1)
            }
        }, { merge: true });


        await batch.commit();
        console.log(`[Users] Created user ${userId}, incremented global counter`);
    }
);

/**
 * Trigger que se ejecuta cuando se elimina un usuario
 * - Decrementa el contador de usuarios en metadata/counters
 */
export const onUserDeleted = onDocumentDeleted(
    { document: "users/{userId}" },
    async (event) => {
        const data = event.data?.data();
        if (!data) {
            console.log("No data associated with the event");
            return;
        }

        const userId = event.params.userId;

        // Decrementar contador global de usuarios
        const countersRef = db.collection("metadata").doc("counters");
        await countersRef.set({
            'users.total': FieldValue.increment(-1)
        }, { merge: true });

        console.log(`[Users] Deleted user ${userId}, decremented global counter`);
    }
);
