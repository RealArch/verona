import { Router, Request, Response } from 'express';
import * as admin from "firebase-admin";

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
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`
    });
    
    // Establecer claim de administrador
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
    
    // Guardar datos adicionales en Firestore
    await admin.firestore().collection('adminUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      firstName,
      lastName,
      email,
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Actualizar contador de usuarios administradores
    const adminUsersRef = admin.firestore().doc('metadata/counters');
    await adminUsersRef.set({
      adminUsers: admin.firestore.FieldValue.increment(1)
    }, { merge: true });
    
    res.status(200).json({ message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});


export default usersRouter;