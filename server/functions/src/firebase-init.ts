import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as admin from "firebase-admin";

// Importa tus credenciales
import serviceAccountJson from './serviceAccountKey.json';
import { getStorage } from 'firebase-admin/storage';
const serviceAccount = serviceAccountJson as admin.ServiceAccount;

// Llama a initializeApp() UNA SOLA VEZ en toda tu aplicación
initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'verona-ffbcd.firebasestorage.app' // Reemplaza con el nombre de tu bucket
});

// Crea y exporta las instancias de los servicios que usarás
// Ahora estas variables se pueden importar de forma segura en otros archivos.
export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();