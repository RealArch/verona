import { Router, Request, Response } from 'express';
// import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db, auth, storage } from '../firebase-init';
// import { info } from 'firebase-functions/logger';

const usersRouter: Router = Router();


usersRouter.get('/', async (req: Request, res: Response) => {
    const mockUsers = [
        { id: 'user_1', name: 'Alicia' },
        { id: 'user_2', name: 'Roberto' },
    ];
    res.status(200).json(mockUsers);
});

usersRouter.post('/createAdminUser', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Crear usuario en Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`
        });

        // Establecer claim de administrador

        await auth.setCustomUserClaims(userRecord.uid, { admin: true });

        // Guardar datos adicionales en Firestore

        await db.collection('adminUsers').doc(userRecord.uid).set({
            uid: userRecord.uid,
            firstName,
            lastName,
            email,
            isAdmin: true,
            createdAt: Timestamp.now()
        });
        // Actualizar contador de usuarios administradores
        const adminUsersRef = db.doc('metadata/counters');
        await adminUsersRef.set({
            adminUsers: FieldValue.increment(1)
        }, { merge: true });

        res.status(200).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ error: 'Failed to create admin user', info: error });
    }
});

// Endpoint para eliminar un usuario administrador
usersRouter.delete('/deleteAdminUser/:uid', async (req: Request, res: Response) => {
    try {
        const { uid } = req.params;

        if (!uid) {
            res.status(400).json({ error: 'UID is required' });
            return;
        }

        // Verificar que el usuario existe en Firestore
        const userDoc = await db.collection('adminUsers').doc(uid).get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'Admin user not found in Firestore' });
            return;
        }

        // Eliminar el documento de Firestore
        await db.collection('adminUsers').doc(uid).delete();

        // Eliminar el usuario de Firebase Auth
        await auth.deleteUser(uid);

        // Decrementar el contador de usuarios administradores
        const adminUsersRef = db.doc('metadata/counters');
        await adminUsersRef.set({
            adminUsers: FieldValue.increment(-1)
        }, { merge: true });

        res.status(200).json({ 
            message: 'Admin user deleted successfully',
            uid: uid
        });
    } catch (error) {
        console.error('Error deleting admin user:', error);
        res.status(500).json({ error: 'Failed to delete admin user', info: error });
    }
});

// Endpoint para mover imágenes de header de temp a ubicación final
usersRouter.post('/moveHeaderImage', async (req: Request, res: Response) => {
    try {
        const { tempPath, screenType } = req.body;

        if (!tempPath || !screenType) {
            res.status(400).json({ error: 'tempPath and screenType are required' });
            return;
        }

        if (screenType !== 'large' && screenType !== 'small') {
            res.status(400).json({ error: 'screenType must be "large" or "small"' });
            return;
        }

        // Obtener la extensión del archivo desde tempPath
        const pathParts = tempPath.split('.');
        const extension = pathParts[pathParts.length - 1];

        // Definir el path final
        const finalPath = `img/settings/header-${screenType}.${extension}`;

        // Obtener bucket de storage
        const bucket = storage.bucket();

        // Copiar archivo de temp a ubicación final
        await bucket.file(tempPath).copy(bucket.file(finalPath));

        // Eliminar archivo temporal
        await bucket.file(tempPath).delete();

        // Generar URL según el entorno
        let url: string;
        if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
            // Emulador local
            url = `http://localhost:9199/v0/b/${bucket.name}/o/${encodeURIComponent(finalPath)}?alt=media`;
        } else {
            // Producción - hacer el archivo público
            await bucket.file(finalPath).makePublic();
            url = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(finalPath)}`;
        }

        res.status(200).json({
            success: true,
            finalPath,
            url
        });
    } catch (error) {
        console.error('Error moving header image:', error);
        res.status(500).json({ error: 'Failed to move header image', info: error });
    }
});




export default usersRouter;