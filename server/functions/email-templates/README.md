# 📧 Sistema de Email con Plantillas

Sistema profesional y robusto para el envío de emails usando plantillas HTML personalizables.

## 📁 Estructura

```
functions/
├── email-templates/           # Plantillas HTML desplegadas
│   ├── welcome.html           # Email de bienvenida
│   └── [nuevas-plantillas].html
├── lib/                       # Código compilado para Cloud Functions
└── src/
    ├── utils/
    │   └── emailService.ts    # Servicio de envío de emails
    └── triggers/
        └── users.triggers.ts  # Trigger que envía email de bienvenida
```

> ⚠️ Las plantillas ahora viven en `functions/email-templates` (fuera de `src/`) para que estén disponibles tanto en desarrollo como después del build.

## 🔧 Configuración

### 1. Configurar Variables de Entorno (Secrets)

Debes configurar los siguientes secrets en Firebase:

```bash
# Para desarrollo local (emulador)
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASSWORD
firebase functions:secrets:set EMAIL_FROM
firebase functions:secrets:set EMAIL_HOST
firebase functions:secrets:set EMAIL_PORT
```

**Valores para ZeptoMail:**

- `EMAIL_HOST`: smtp.zeptomail.com
- `EMAIL_PORT`: 587
- `EMAIL_USER`: Tu usuario SMTP de ZeptoMail
- `EMAIL_PASSWORD`: Tu contraseña SMTP de ZeptoMail
- `EMAIL_FROM`: "Verona <noreply@tudominio.com>"

### 2. Variables de Entorno Opcionales

Puedes configurar estas URLs en tu `.env` o directamente en el código:

```bash
STORE_URL=https://verona.com
SUPPORT_URL=https://verona.com/soporte
PRIVACY_URL=https://verona.com/privacidad
```

## 📝 Cómo Crear una Nueva Plantilla

### Paso 1: Crear el archivo HTML

Crea un nuevo archivo en `functions/email-templates/`:

```html
<!-- functions/email-templates/order-confirmation.html -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Confirmación de Pedido</title>
    <style>
        /* Tus estilos aquí */
    </style>
</head>
<body>
    <h1>¡Pedido Confirmado!</h1>
    <p>Hola {{firstName}},</p>
    <p>Tu pedido #{{orderNumber}} ha sido confirmado.</p>
    <p>Total: ${{total}}</p>
</body>
</html>
```

### Paso 2: Usar variables en la plantilla

Las variables se definen con `{{nombreVariable}}`. Ejemplo:

- `{{firstName}}` - Nombre del usuario
- `{{email}}` - Email del usuario
- `{{orderNumber}}` - Número de orden
- `{{total}}` - Total de la compra
- `{{year}}` - Año actual (automático)

### Paso 3: Crear función helper (opcional)

En `src/utils/emailService.ts`, agrega una función helper:

```typescript
export async function sendOrderConfirmationEmail(
  userEmail: string,
  orderData: {
    firstName: string;
    orderNumber: string;
    total: number;
  }
): Promise<void> {
  const emailData: EmailData = {
    to: userEmail,
    subject: 'Confirmación de Pedido #' + orderData.orderNumber,
    templateName: 'order-confirmation',
    templateData: {
      firstName: orderData.firstName,
      orderNumber: orderData.orderNumber,
      total: orderData.total.toFixed(2)
    }
  };

  await sendTemplatedEmail(emailData);
}
```

### Paso 4: Usar en un trigger o ruta

```typescript
import { sendOrderConfirmationEmail } from '../utils/emailService';

// En un trigger o endpoint
await sendOrderConfirmationEmail('user@example.com', {
  firstName: 'Juan',
  orderNumber: 'ORD-12345',
  total: 99.99
});
```

## 🎨 Plantillas Disponibles

### 1. `welcome.html` - Email de Bienvenida

**Cuándo se envía:** Cuando se crea un nuevo usuario en Firestore

**Variables disponibles:**
- `{{firstName}}` - Nombre del usuario
- `{{lastName}}` - Apellido del usuario
- `{{email}}` - Email del usuario
- `{{phoneNumber}}` - Teléfono del usuario
- `{{registrationDate}}` - Fecha de registro
- `{{storeUrl}}` - URL de la tienda
- `{{supportUrl}}` - URL de soporte
- `{{privacyUrl}}` - URL de política de privacidad
- `{{year}}` - Año actual (automático)

**Uso:**
```typescript
import { sendWelcomeEmail } from '../utils/emailService';

await sendWelcomeEmail('user@example.com', {
  firstName: 'Juan',
  lastName: 'Pérez',
  phoneNumber: '+1-555-1234',
  registrationDate: '23 de octubre de 2025'
});
```

## 🔨 Funciones del Email Service

### `sendTemplatedEmail(emailData: EmailData)`

Función principal para enviar emails con plantilla.

```typescript
await sendTemplatedEmail({
  to: 'user@example.com',
  subject: 'Asunto del email',
  templateName: 'nombre-plantilla',
  templateData: {
    variable1: 'valor1',
    variable2: 'valor2'
  }
});
```

### `sendCustomEmail(to, subject, templateName, data)`

Función de utilidad para enviar emails personalizados.

```typescript
await sendCustomEmail(
  'user@example.com',
  'Asunto del email',
  'mi-plantilla',
  { nombre: 'Juan', edad: 30 }
);
```

## 📋 Mejores Prácticas

- **Estilos inline**: los emails deben usar estilos inline o `<style>` en el `<head>`.
- **Compatibilidad**: prueba en Gmail, Outlook, Apple Mail y Yahoo Mail.
- **Responsive**: usa `max-width: 600px` y media queries para móviles.
- **Fallbacks**: siempre proporciona valores por defecto para variables opcionales.
- **Errores controlados**: los emails se envían en segundo plano sin bloquear la operación principal.

## 🧪 Testing Local

Para probar los emails localmente, puedes usar servicios como:

1. **Mailtrap** (recomendado para desarrollo)
2. **Ethereal Email**
3. **Gmail** (para pruebas rápidas)

Configura los secrets con las credenciales del servicio de prueba.

## 🚀 Deployment

Los secrets deben estar configurados en producción antes del deploy:

```bash
# Configurar secrets en producción
firebase functions:secrets:set EMAIL_HOST --project production
firebase functions:secrets:set EMAIL_PORT --project production
firebase functions:secrets:set EMAIL_USER --project production
firebase functions:secrets:set EMAIL_PASSWORD --project production
firebase functions:secrets:set EMAIL_FROM --project production

# Deploy
firebase deploy --only functions
```

## 📊 Monitoreo

Revisa los logs de Firebase Functions para ver el estado de los emails:

```bash
firebase functions:log
```

Busca mensajes como:
- `[EmailService] Email sent successfully`
- `[EmailService] Error sending email`
- `[Users] Welcome email queued`

## 💡 Ideas para Nuevas Plantillas

- `order-confirmation.html` - Confirmación de pedido
- `order-shipped.html` - Pedido enviado
- `order-delivered.html` - Pedido entregado
- `password-reset.html` - Reseteo de contraseña
- `newsletter.html` - Newsletter mensual
- `promotion.html` - Ofertas especiales
- `cart-reminder.html` - Carrito abandonado

---

**Desarrollado con ❤️ para Verona**
