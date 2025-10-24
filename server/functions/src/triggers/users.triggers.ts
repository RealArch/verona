import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import { sendWelcomeEmail, emailUser, emailPassword, emailFrom, emailHost, emailPort } from '../utils/emailService';

const db = admin.firestore();

/**
 * Trigger que se ejecuta cuando se crea un nuevo usuario
 * - Incrementa el contador de usuarios en metadata/counters
 * - Inicializa contadores del usuario si no existen
 * - Envía email de bienvenida
 */
export const onUserCreated = onDocumentCreated(
    { 
        document: "users/{userId}",
        secrets: [emailUser, emailPassword, emailFrom, emailHost, emailPort]
    },
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

        // Crear wishlist vacío para el nuevo usuario
        const wishlistRef = db.collection("wishlists").doc(userId);
        batch.set(wishlistRef, {
            userId: userId,
            items: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[Users] Created user ${userId}, incremented global counter, and initialized wishlist`);

        // Enviar email de bienvenida (en paralelo, sin bloquear)
        if (data.email && data.firstName && data.lastName) {
            const registrationDate = data.createdAt 
                ? new Date(data.createdAt.toMillis()).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : new Date().toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

            sendWelcomeEmail(data.email, {
                firstName: data.firstName,
                lastName: data.lastName,
                phoneNumber: data.phoneNumber,
                registrationDate: registrationDate
            }).catch(error => {
                console.error(`[Users] Error sending welcome email to ${data.email}:`, error);
                // No lanzar el error para no afectar la creación del usuario
            });

            console.log(`[Users] Welcome email queued for ${data.email}`);
        } else {
            console.warn(`[Users] Cannot send welcome email for user ${userId}: missing email, firstName, or lastName`);
        }
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
            users: {
                total: FieldValue.increment(-1)
            }
        }, { merge: true });

        console.log(`[Users] Deleted user ${userId}, decremented global counter`);
    }
);
