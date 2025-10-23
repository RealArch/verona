import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import Joi from 'joi';

const authRouter: Router = Router();

// Schema de validación para crear usuario
const createUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email debe tener un formato válido',
      'any.required': 'El email es obligatorio'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'any.required': 'La contraseña es obligatoria'
    }),
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 50 caracteres',
      'any.required': 'El nombre es obligatorio'
    }),
  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres',
      'string.max': 'El apellido no puede exceder 50 caracteres',
      'any.required': 'El apellido es obligatorio'
    }),
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]+$/)
    .min(8)
    .max(20)
    .required()
    .messages({
      'string.pattern.base': 'El número de teléfono contiene caracteres inválidos',
      'string.min': 'El número de teléfono debe tener al menos 8 caracteres',
      'string.max': 'El número de teléfono no puede exceder 20 caracteres',
      'any.required': 'El número de teléfono es obligatorio'
    })
});

// Endpoint para crear usuario
authRouter.post('/createUser', async (req: Request, res: Response): Promise<void> => {
  console.log("entre")
  try {
    // Validar datos de entrada
    const { error, value } = createUserSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.details.map((detail: any) => detail.message)
      });
      return;
    }

    const { email, password, firstName, lastName, phoneNumber } = value;

    // Verificar si el usuario ya existe
    try {
      await admin.auth().getUserByEmail(email);
      res.status(409).json({
        success: false,
        message: 'Ya existe un usuario con este email',
        errorCode: 'auth/email-already-exists'
      });
      return;
    } catch (getUserError: any) {
      // Si el error es que no se encontró el usuario, podemos continuar
      if (getUserError.code !== 'auth/user-not-found') {
        throw getUserError;
      }
    }

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false,
    });

    console.log(`Usuario creado exitosamente: ${userRecord.uid}`);

    // Crear documento del usuario en Firestore
    const userDoc = {
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      phoneNumber: phoneNumber,
      role: 'user', // rol por defecto
      admin: false,
      isActive: true,
      emailVerified: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      counters:
      {
        purchases: 0
      }
    };

    // Guardar en Firestore
    await admin.firestore()
      .collection('users')
      .doc(userRecord.uid)
      .set(userDoc);

    console.log(`Documento de usuario creado en Firestore: ${userRecord.uid}`);

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      uid: userRecord.uid
    });

  } catch (error: any) {
    console.error('Error creando usuario:', error);

    // Manejar errores específicos de Firebase
    let errorMessage = 'Error interno del servidor';
    let statusCode = 500;
    console.log(error.code)
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-exists':
          errorMessage = 'Ya existe un usuario con este email';
          statusCode = 409;
          break;
        case 'auth/invalid-email':
          errorMessage = 'El formato del email es inválido';
          statusCode = 400;
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña es muy débil';
          statusCode = 400;
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      errorCode: error.code || 'internal-error'
    });
  }
});

export default authRouter