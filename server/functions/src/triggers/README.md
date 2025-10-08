# Orders Triggers

Este documento explica los triggers de Firebase Functions para las colecciones `orders` y `users`.

## Triggers Implementados

### 1. `onOrderCreated`
**Se ejecuta cuando:** Se crea una nueva orden en la colección `orders`

**Acciones:**
- ✅ Sincroniza la orden con Algolia (índice `orders_prod` o `orders_dev`)
- ✅ Incrementa el contador global de órdenes en `metadata/counters`
- ✅ Convierte timestamps de Firestore a milisegundos para indexación en Algolia
- ✅ Indexa campos clave: `userId`, `status`, `total`, `itemCount` para búsquedas eficientes

**Datos indexados en Algolia:**
```typescript
{
  objectID: orderId,
  userId: string,
  status: string,
  total: number,
  itemCount: number,
  createdAt: number, // milisegundos
  updatedAt: number, // milisegundos
  // ... resto de datos de la orden
}
```

---

### 2. `onOrderUpdated`
**Se ejecuta cuando:** Se actualiza una orden existente en la colección `orders`

**Acciones:**
- ✅ Sincroniza los cambios con Algolia
- ✅ Actualiza todos los campos modificados
- ✅ Convierte timestamps actualizados a milisegundos

**Casos de uso comunes:**
- Cambio de estado de la orden (pending → processing → completed)
- Actualización de dirección de envío
- Modificación de notas o instrucciones especiales
- Cambio de método de pago

---

### 3. `onOrderDeleted`
**Se ejecuta cuando:** Se elimina una orden de la colección `orders`

**Acciones:**
- ✅ Elimina la orden de Algolia
- ✅ Decrementa el contador global de órdenes en `metadata/counters`
- ✅ **Decrementa el contador de compras del usuario** (`users/{userId}/counters/purchases`)
- ✅ Usa batch writes para garantizar atomicidad

**⚠️ Importante:**
- Si la orden no tiene `userId`, se registra un warning pero continúa con las demás operaciones
- El contador de compras del usuario se decrementa automáticamente
- Esta acción es irreversible y debe usarse con precaución

---

## Índices de Algolia

Los triggers usan diferentes índices según el entorno:

- **Producción:** `orders_prod`
- **Desarrollo/Emulador:** `orders_dev`

Esto permite tener datos de prueba separados de los datos de producción.

---

## Contadores Mantenidos

### 1. Contador Global de Órdenes
**Ubicación:** `metadata/counters/orders`
- Incrementado al crear una orden
- Decrementado al eliminar una orden

### 2. Contadores de Ventas
**Ubicación:** `metadata/counters/sales`

**Estructura:**
```typescript
{
  sales: {
    total: number, // Total de todas las ventas
    byDeliveryMethod: {
      pickup: number,           // Ventas por pickup
      homeDelivery: number,     // Ventas por entrega a domicilio
      shipping: number,         // Ventas por envío
      arrangeWithSeller: number // Ventas por acordar con vendedor
    }
  }
}
```

**Operaciones:**
- **Incremento:** Al crear una orden (`onOrderCreated`)
- **Decremento:** Al eliminar una orden (`onOrderDeleted`)

### 3. Contador de Compras por Usuario
**Ubicación:** `users/{userId}/counters/purchases`
- Incrementado al crear una orden (en `orders.router.ts`)
- Decrementado al eliminar una orden (en `onOrderDeleted`)

---

## Configuración Requerida

Los triggers requieren los siguientes secrets de Firebase:

```bash
ALGOLIA_ADMIN_KEY=your_admin_key
ALGOLIA_APP_ID=your_app_id
```

Para configurar estos secrets:

```bash
firebase functions:secrets:set ALGOLIA_ADMIN_KEY
firebase functions:secrets:set ALGOLIA_APP_ID
```

---

## Manejo de Errores

- Los errores de sincronización con Algolia se registran pero **no detienen** la ejecución
- Los triggers usan `console.log` y `logger` de Firebase para debugging
- Los errores se pueden monitorear en Firebase Console > Functions > Logs

---

## Ejemplo de Estructura en Firestore

### Documento `metadata/counters`

```json
{
  "orders": 1250,
  "sales": {
    "total": 1250,
    "byDeliveryMethod": {
      "pickup": 450,
      "homeDelivery": 380,
      "shipping": 320,
      "arrangeWithSeller": 100
    }
  },
  "users": {
    "total": 5420
  },
  "categories": 25,
  "products": 1800
}
```

### Documento `users/{userId}`

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "counters": {
    "purchases": 8
  }
}
```

### Creación de Orden
1. **Frontend** → POST `/orders/createOrder`
2. **Backend** → Valida y crea documento en `orders` collection
3. **Backend** → Incrementa `users/{userId}/counters/purchases`
4. **Trigger `onOrderCreated`** → Sincroniza con Algolia
5. **Trigger `onOrderCreated`** → Incrementa `metadata/counters/orders`
6. **Trigger `onOrderCreated`** → Incrementa `metadata/counters/sales.total`
7. **Trigger `onOrderCreated`** → Incrementa `metadata/counters/sales.byDeliveryMethod.{deliveryMethod}`

### Actualización de Orden
1. **Frontend/Admin** → Actualiza documento en `orders` collection
2. **Trigger `onOrderUpdated`** → Sincroniza cambios con Algolia

### Eliminación de Orden
1. **Admin** → Elimina documento de `orders` collection
2. **Trigger `onOrderDeleted`** → Elimina de Algolia
3. **Trigger `onOrderDeleted`** → Decrementa `metadata/counters/orders`
4. **Trigger `onOrderDeleted`** → Decrementa `metadata/counters/sales.total`
5. **Trigger `onOrderDeleted`** → Decrementa `metadata/counters/sales.byDeliveryMethod.{deliveryMethod}`
6. **Trigger `onOrderDeleted`** → Decrementa `users/{userId}/counters/purchases`

---

## Testing

Para probar los triggers en el emulador local:

```bash
# Iniciar emuladores
firebase emulators:start

# Los triggers se ejecutarán automáticamente cuando:
# - Se cree una orden vía API o console
# - Se actualice una orden
# - Se elimine una orden
```

---

## Mejoras Futuras

- [ ] Enviar notificaciones por email al crear/actualizar órdenes
- [ ] Webhook a servicios externos (ej: plataformas de shipping)
- [ ] Generar reportes automáticos al final del día
- [ ] Integración con sistemas de inventario en tiempo real
- [ ] Auditoría detallada de cambios de estado

## Resumen de Contadores

| Contador | Ubicación | Incrementa | Decrementa |
|----------|-----------|------------|------------|
| Órdenes globales | `metadata/counters/orders` | onOrderCreated | onOrderDeleted |
| Ventas totales | `metadata/counters/sales.total` | onOrderCreated | onOrderDeleted |
| Ventas por pickup | `metadata/counters/sales.byDeliveryMethod.pickup` | onOrderCreated | onOrderDeleted |
| Ventas por entrega a domicilio | `metadata/counters/sales.byDeliveryMethod.homeDelivery` | onOrderCreated | onOrderDeleted |
| Ventas por envío | `metadata/counters/sales.byDeliveryMethod.shipping` | onOrderCreated | onOrderDeleted |
| Ventas por acordar con vendedor | `metadata/counters/sales.byDeliveryMethod.arrangeWithSeller` | onOrderCreated | onOrderDeleted |
| Usuarios totales | `metadata/counters/users.total` | onUserCreated | onUserDeleted |
| Compras por usuario | `users/{userId}/counters/purchases` | createOrder (API) | onOrderDeleted |

---

## 👤 Users Triggers

### **`onUserCreated`**
**Se ejecuta cuando:** Se crea un nuevo usuario en la colección `users`

**Acciones:**
- ✅ Incrementa el contador global de usuarios en `metadata/counters/users.total`
- ✅ Inicializa `counters.purchases` en 0 si no existe

**Ejemplo:**
```typescript
// Usuario creado
{
  "uid": "abc123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com"
}

// Se actualiza automáticamente a:
{
  "uid": "abc123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@example.com",
  "counters": {
    "purchases": 0  // ← Inicializado automáticamente
  }
}

// Y se incrementa metadata/counters/users.total
```

### **`onUserDeleted`**
**Se ejecuta cuando:** Se elimina un usuario de la colección `users`

**Acciones:**
- ✅ Decrementa el contador global de usuarios en `metadata/counters/users.total`

---
