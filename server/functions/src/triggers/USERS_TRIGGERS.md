# Users Triggers Documentation

## 📋 Triggers de Usuarios

### **Objetivo**
Mantener sincronizados los contadores globales de usuarios y garantizar que cada usuario tenga sus contadores inicializados correctamente.

---

## 🔧 Triggers Implementados

### **1. `onUserCreated`**

**Se ejecuta cuando:** Se crea un nuevo documento en la colección `users`

**Acciones automáticas:**
1. ✅ Incrementa `metadata/counters/users.total` en 1
2. ✅ Inicializa `counters.purchases` en 0 (si no existe)

**Código:**
```typescript
export const onUserCreated = onDocumentCreated(
  { document: "users/{userId}" },
  async (event) => {
    const userId = event.params.userId;
    const batch = db.batch();

    // Incrementar contador global
    const countersRef = db.collection("metadata").doc("counters");
    batch.set(countersRef, {
      'users.total': FieldValue.increment(1)
    }, { merge: true });

    // Inicializar contadores del usuario
    const userRef = db.collection("users").doc(userId);
    if (!data.counters) {
      batch.update(userRef, {
        'counters.purchases': 0
      });
    }

    await batch.commit();
  }
);
```

**Ejemplo de flujo:**

**Antes (usuario recién creado):**
```json
{
  "uid": "user123",
  "firstName": "María",
  "lastName": "García",
  "email": "maria@example.com",
  "createdAt": "2025-10-08T10:00:00Z"
}
```

**Después (trigger ejecutado):**
```json
{
  "uid": "user123",
  "firstName": "María",
  "lastName": "García",
  "email": "maria@example.com",
  "createdAt": "2025-10-08T10:00:00Z",
  "counters": {
    "purchases": 0  // ← Inicializado automáticamente
  }
}
```

**Y en `metadata/counters`:**
```json
{
  "users": {
    "total": 5421  // ← Incrementado de 5420 a 5421
  }
}
```

---

### **2. `onUserDeleted`**

**Se ejecuta cuando:** Se elimina un documento de la colección `users`

**Acciones automáticas:**
1. ✅ Decrementa `metadata/counters/users.total` en 1

**Código:**
```typescript
export const onUserDeleted = onDocumentDeleted(
  { document: "users/{userId}" },
  async (event) => {
    const userId = event.params.userId;

    // Decrementar contador global
    const countersRef = db.collection("metadata").doc("counters");
    await countersRef.set({
      'users.total': FieldValue.increment(-1)
    }, { merge: true });

    console.log(`[Users] Deleted user ${userId}, decremented global counter`);
  }
);
```

**Ejemplo:**
```
Usuario eliminado → metadata/counters/users.total: 5421 → 5420
```

---

## 📊 Estructura de Contadores

### **Contador Global** (`metadata/counters`)
```json
{
  "users": {
    "total": 5420  // Total de usuarios registrados
  },
  "orders": 1250,
  "sales": {
    "total": 1250,
    "byDeliveryMethod": { ... }
  }
}
```

### **Contadores por Usuario** (`users/{userId}`)
```json
{
  "uid": "user123",
  "firstName": "María",
  "lastName": "García",
  "email": "maria@example.com",
  "counters": {
    "purchases": 8  // Total de compras realizadas
  }
}
```

---

## 🔄 Flujo Completo de un Usuario

### **1. Registro de Usuario**
```
Auth.createUser() 
  → Firestore.collection('users').doc(uid).set({...})
  → Trigger onUserCreated se ejecuta
  → Incrementa metadata/counters/users.total
  → Inicializa counters.purchases = 0
```

### **2. Primera Compra**
```
POST /orders/createOrder
  → Crea orden en collection('orders')
  → Incrementa users/{uid}/counters.purchases
  → Trigger onOrderCreated actualiza contadores globales
```

### **3. Eliminación de Usuario**
```
Firestore.collection('users').doc(uid).delete()
  → Trigger onUserDeleted se ejecuta
  → Decrementa metadata/counters/users.total
```

---

## 🎯 Casos de Uso

### **Dashboard de Administración**
```typescript
// Obtener total de usuarios
const counters = await db.collection('metadata').doc('counters').get();
const totalUsers = counters.data()?.users?.total || 0;

console.log(`Total de usuarios registrados: ${totalUsers}`);
```

### **Reportes de Crecimiento**
```typescript
// Obtener usuarios activos (con al menos una compra)
const usersSnapshot = await db.collection('users')
  .where('counters.purchases', '>', 0)
  .get();

const activeUsers = usersSnapshot.size;
const totalUsers = counters.data()?.users?.total || 0;
const conversionRate = (activeUsers / totalUsers) * 100;

console.log(`Tasa de conversión: ${conversionRate.toFixed(2)}%`);
```

### **Estadísticas por Usuario**
```typescript
// Obtener usuario con más compras
const topBuyer = await db.collection('users')
  .orderBy('counters.purchases', 'desc')
  .limit(1)
  .get();

const user = topBuyer.docs[0].data();
console.log(`Top buyer: ${user.firstName} ${user.lastName} - ${user.counters.purchases} compras`);
```

---

## ⚠️ Consideraciones Importantes

### **Inicialización de Contadores**
- El trigger inicializa `counters.purchases` solo si NO existe
- Si creas usuarios desde diferentes lugares (Auth, Admin SDK, etc.), el trigger siempre inicializará los contadores
- Los contadores usan `FieldValue.increment()` para evitar condiciones de carrera

### **Atomicidad**
- Las operaciones usan `batch.commit()` para garantizar que todo se ejecute o nada
- Si falla el incremento del contador global, también falla la inicialización del usuario

### **Performance**
- Los triggers son ligeros y se ejecutan rápidamente
- No realizan operaciones costosas
- No hay llamadas externas (solo Firestore)

---

## 🧪 Testing

### **Crear Usuario de Prueba**
```typescript
// En el emulador o producción
await db.collection('users').doc('test123').set({
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

// Verificar que el trigger se ejecutó
const user = await db.collection('users').doc('test123').get();
console.log('Counters:', user.data()?.counters); // Debe mostrar { purchases: 0 }

const counters = await db.collection('metadata').doc('counters').get();
console.log('Total users:', counters.data()?.users?.total); // Debe haber incrementado
```

### **Eliminar Usuario de Prueba**
```typescript
await db.collection('users').doc('test123').delete();

// Verificar que el contador decrementó
const counters = await db.collection('metadata').doc('counters').get();
console.log('Total users:', counters.data()?.users?.total); // Debe haber decrementado
```

---

## 🚀 Despliegue

```bash
# Compilar
npm run build

# Desplegar solo triggers de users
firebase deploy --only functions:onUserCreated,functions:onUserDeleted

# O desplegar todas las functions
firebase deploy --only functions
```

---

## 📝 Logs y Debugging

### **Ver logs en tiempo real**
```bash
firebase functions:log --only onUserCreated,onUserDeleted
```

### **Logs importantes:**
- `[Users] Created user {userId}, incremented global counter`
- `[Users] Initialized counters for user {userId}`
- `[Users] Deleted user {userId}, decremented global counter`

### **Troubleshooting**

**Problema:** El contador `purchases` no se inicializa
```typescript
// Verificar si el campo counters ya existe
const user = await db.collection('users').doc(userId).get();
console.log('Has counters?', user.data()?.counters !== undefined);

// Si ya existe, el trigger no lo sobrescribe
// Puedes forzar la inicialización manualmente:
await db.collection('users').doc(userId).update({
  'counters.purchases': 0
});
```

**Problema:** El contador global no coincide
```typescript
// Contar usuarios manualmente
const usersSnapshot = await db.collection('users').get();
const actualCount = usersSnapshot.size;

// Comparar con contador
const counters = await db.collection('metadata').doc('counters').get();
const counterValue = counters.data()?.users?.total || 0;

console.log('Actual:', actualCount, 'Counter:', counterValue);

// Corregir si es necesario
if (actualCount !== counterValue) {
  await counters.ref.set({
    'users.total': actualCount
  }, { merge: true });
}
```

---

## ✅ Checklist de Implementación

- [x] Trigger `onUserCreated` creado y exportado
- [x] Trigger `onUserDeleted` creado y exportado
- [x] Contador global `metadata/counters/users.total` implementado
- [x] Inicialización automática de `counters.purchases`
- [x] Documentación completa
- [x] Integración con sistema de contadores existente
- [ ] Pruebas en emulador
- [ ] Despliegue a producción

---

## 📈 Beneficios

1. **Métricas en Tiempo Real**: Siempre tienes el total exacto de usuarios
2. **Onboarding Automático**: Los usuarios nuevos tienen sus contadores listos
3. **Consistencia**: Los contadores siempre están sincronizados
4. **Performance**: No necesitas contar todos los documentos cada vez
5. **Escalabilidad**: Los triggers escalan automáticamente con Firebase

---

## 🔗 Relación con Otros Triggers

```
users/
  └── onUserCreated
      └── Inicializa counters.purchases

orders/
  └── onOrderCreated
      └── Incrementa counters.purchases del usuario
  └── onOrderDeleted
      └── Decrementa counters.purchases del usuario

metadata/counters
  ├── users.total (mantenido por users triggers)
  ├── orders (mantenido por orders triggers)
  └── sales.* (mantenido por orders triggers)
```

Todo el sistema de contadores trabaja en conjunto para mantener métricas precisas y en tiempo real.
