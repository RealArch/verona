# Implementación del Sistema de Órdenes

## 📋 Resumen de la Implementación Final

### **Flujo de Datos del Usuario**

El frontend envía `userId` → El backend obtiene los datos completos de Firestore → Se crea el objeto `userData` → Se guarda en la orden

---

## 🔄 **Flujo Completo de Creación de Orden**

### **1. Frontend envía:**
```json
{
  "userId": "abc123def456",  // ← Solo envía el ID
  "items": [...],
  "deliveryMethod": "pickup",
  "totals": {...}
}
```

### **2. Backend procesa:**
```typescript
// Obtener datos completos del usuario desde Firestore
const userDoc = await admin.firestore().collection('users').doc(orderData.userId).get();
const userDataFromDB = userDoc.data();

// Construir objeto userData
const userData = {
  uid: orderData.userId,
  firstName: userDataFromDB?.firstName || '',
  lastName: userDataFromDB?.lastName || '',
  email: userDataFromDB?.email || ''
};
```

### **3. Se guarda en Firestore:**
```json
{
  "userId": "abc123def456",      // ← Para compatibilidad
  "userData": {                  // ← Datos completos del usuario
    "uid": "abc123def456",
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com"
  },
  "items": [...],
  "deliveryMethod": "pickup",
  "status": "pending",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 🎯 **Contadores Implementados**

### **1. Contadores Globales** (`metadata/counters`)
```json
{
  "orders": 1250,                    // Total de órdenes
  "sales": {
    "total": 1250,                   // Total de ventas
    "byDeliveryMethod": {
      "pickup": 450,                 // Ventas por pickup
      "homeDelivery": 380,           // Ventas por entrega a domicilio
      "shipping": 320,               // Ventas por envío
      "arrangeWithSeller": 100       // Ventas por acordar con vendedor
    }
  }
}
```

### **2. Contadores por Usuario** (`users/{uid}`)
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "counters": {
    "purchases": 8                   // Total de compras del usuario
  }
}
```

---

## 🔧 **Triggers Implementados**

### **`onOrderCreated`** (Al crear una orden)
✅ Sincroniza con Algolia  
✅ Incrementa `metadata/counters/orders`  
✅ Incrementa `metadata/counters/sales.total`  
✅ Incrementa `metadata/counters/sales.byDeliveryMethod.{método}`  
✅ Incrementa `users/{uid}/counters/purchases` (desde API)

### **`onOrderUpdated`** (Al actualizar una orden)
✅ Sincroniza cambios con Algolia

### **`onOrderDeleted`** (Al eliminar una orden)
✅ Elimina de Algolia  
✅ Decrementa `metadata/counters/orders`  
✅ Decrementa `metadata/counters/sales.total`  
✅ Decrementa `metadata/counters/sales.byDeliveryMethod.{método}`  
✅ **Decrementa `users/{uid}/counters/purchases`** ← ¡NUEVO!

---

## 📊 **Validaciones Implementadas**

### **Validación de Usuario**
```typescript
// 1. Verifica que el usuario exista en Firestore
const userDoc = await admin.firestore().collection('users').doc(orderData.userId).get();
if (!userDoc.exists) {
  return res.status(404).json({ message: 'Usuario no encontrado' });
}

// 2. Verifica que tenga datos completos
if (!userData.firstName || !userData.lastName || !userData.email) {
  return res.status(400).json({ 
    message: 'El usuario no tiene datos completos' 
  });
}
```

### **Validaciones de Orden**
✅ Stock disponible  
✅ Precios actualizados  
✅ Totales correctos  
✅ Impuestos según configuración de tienda  
✅ Método de entrega habilitado  
✅ Direcciones según método de entrega  

---

## 🔐 **Campos Requeridos en Firestore**

### **Documento de Usuario** (`users/{uid}`)
```json
{
  "firstName": "Juan",       // ← REQUERIDO
  "lastName": "Pérez",       // ← REQUERIDO
  "email": "juan@example.com", // ← REQUERIDO
  "counters": {
    "purchases": 0           // Se crea automáticamente
  }
}
```

---

## 🚀 **API Endpoint: POST /orders/createOrder**

### **Request Body:**
```json
{
  "userId": "abc123def456",
  "items": [
    {
      "productId": "prod123",
      "quantity": 2,
      "unitPrice": 99.99,
      "totalPrice": 199.98,
      "productName": "Producto ejemplo"
    }
  ],
  "shippingAddress": {
    "name": "Juan Pérez",
    "address_1": "Calle Principal 123",
    "city": "CDMX",
    "state": "Ciudad de México",
    "postalCode": "01234",
    "country": "México"
  },
  "billingAddress": null,
  "deliveryMethod": "homeDelivery",
  "paymentMethod": "card",
  "notes": "Tocar el timbre",
  "totals": {
    "subtotal": 199.98,
    "taxAmount": 31.99,
    "taxPercentage": 16,
    "shippingCost": 50.00,
    "total": 281.97,
    "itemCount": 2
  }
}
```

### **Response Success (201):**
```json
{
  "success": true,
  "orderId": "order123xyz",
  "message": "Orden creada exitosamente"
}
```

### **Response Error (400):**
```json
{
  "success": false,
  "message": "La orden contiene errores de validación",
  "errors": [
    {
      "field": "items[0].quantity",
      "message": "Stock insuficiente. Disponible: 1, solicitado: 2"
    }
  ]
}
```

---

## ⚡ **Operaciones Atómicas**

Todas las operaciones críticas usan **transacciones de Firestore**:

```typescript
// Transacción garantiza:
// - Lecturas consistentes de stock
// - Validaciones sin condiciones de carrera
// - Todo se guarda o nada se guarda (rollback automático)
await admin.firestore().runTransaction(async (transaction) => {
  // 1. Leer productos y validar stock
  // 2. Validar precios y totales
  // 3. Crear orden
  // 4. Actualizar stocks
  // Todo es atómico ✅
});
```

---

## 🎯 **Estados de Orden Disponibles**

```typescript
type OrderStatus =
  // Iniciales
  | 'pending'           // Orden creada
  | 'payment_pending'   // Esperando pago
  | 'confirmed'         // Confirmada y pagada
  
  // Preparación
  | 'processing'        // Preparando productos
  | 'ready_for_pickup'  // Lista para recoger
  | 'ready_for_delivery' // Lista para entregar
  
  // Envío/Entrega
  | 'out_for_delivery'  // En camino
  | 'shipped'          // Enviado por paquetería
  | 'delivered'        // Entregado
  | 'picked_up'        // Recogido
  
  // Finales
  | 'completed'        // Completada
  | 'cancelled'        // Cancelada
  | 'refunded'         // Reembolsada
  | 'returned'         // Devuelta
  
  // Especiales
  | 'on_hold'          // En espera
  | 'disputed'         // En disputa
  | 'partially_delivered'; // Parcialmente entregada
```

---

## 📈 **Métricas Disponibles**

Con los contadores implementados puedes obtener:

- Total de órdenes creadas
- Total de ventas realizadas
- Ventas por método de entrega
- Compras por usuario individual
- Reportes de tendencias
- Análisis de métodos más populares

---

## 🔍 **Búsqueda con Algolia**

Las órdenes se sincronizan automáticamente a Algolia con:

```json
{
  "objectID": "order123",
  "userId": "abc123",
  "userData": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com"
  },
  "status": "pending",
  "total": 281.97,
  "itemCount": 2,
  "createdAt": 1696723200000,  // Timestamp en ms
  "updatedAt": 1696723200000
}
```

**Búsquedas posibles:**
- Por nombre de usuario
- Por email
- Por estado de orden
- Por rango de fechas
- Por monto total
- Por cantidad de items

---

## ✅ **Testing Checklist**

- [ ] Crear orden con usuario válido
- [ ] Crear orden con usuario sin datos completos (debe fallar)
- [ ] Crear orden con usuario inexistente (debe fallar)
- [ ] Verificar que `userData` se guarda correctamente
- [ ] Verificar incremento de contadores al crear orden
- [ ] Eliminar orden y verificar decremento de contadores
- [ ] Verificar que `counters.purchases` del usuario se actualiza
- [ ] Verificar sincronización con Algolia
- [ ] Probar cada método de entrega

---

## 🚀 **Para Desplegar**

```bash
# 1. Compilar
cd functions
npm run build

# 2. Desplegar todas las functions
firebase deploy --only functions

# 3. O desplegar solo triggers de orders
firebase deploy --only functions:onOrderCreated,functions:onOrderUpdated,functions:onOrderDeleted
```

---

## 🐛 **Debugging**

### **Ver logs de producción:**
```bash
firebase functions:log --only onOrderCreated,onOrderUpdated,onOrderDeleted
```

### **Logs importantes:**
- `[Orders] Created order {id}, incremented all counters`
- `[Orders] Decremented purchase counter for user {uid}`
- `[Orders] Decremented sales counters for delivery method: {method}`

---

## 📝 **Notas Importantes**

1. **userId vs userData:**
   - `userId` se mantiene en la raíz para compatibilidad
   - `userData` contiene los datos completos del usuario
   - El trigger usa `userData.uid` para decrementar contadores

2. **Contadores del usuario:**
   - Se incrementan en el API al crear orden
   - Se decrementan en el trigger al eliminar orden
   - Usan `FieldValue.increment()` para atomicidad

3. **Validación de datos:**
   - Los datos del usuario se obtienen de Firestore, no del frontend
   - Se valida que existan firstName, lastName y email
   - Garantiza integridad de los datos guardados

4. **Manejo de errores:**
   - Si falla el incremento de contador, no falla la orden
   - Si falla Algolia, no falla la orden
   - Todos los errores se loggean para debugging
