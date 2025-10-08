# Order Status Guide

## Estados de Orden Recomendados

Basado en tus métodos de entrega (`pickup`, `homeDelivery`, `shipping`, `arrangeWithSeller`), he diseñado un sistema de estados completo y profesional.

### 📋 **Estados Definidos**

```typescript
export type OrderStatus =
  // Estados iniciales
  | 'pending'           // Orden creada, esperando confirmación/pago
  | 'payment_pending'   // Pago iniciado pero no completado
  | 'confirmed'         // Orden confirmada y pagada

  // Estados de preparación
  | 'processing'        // Preparando/empaquetando productos
  | 'ready_for_pickup'  // Lista para recoger (solo pickup)
  | 'ready_for_delivery' // Lista para entregar (homeDelivery/shipping)

  // Estados de envío/entrega
  | 'out_for_delivery'  // En camino hacia el cliente (homeDelivery)
  | 'shipped'          // Enviado por correo/paquetería (shipping)
  | 'delivered'        // Entregado exitosamente
  | 'picked_up'        // Recogido por el cliente (pickup)

  // Estados finales
  | 'completed'        // Orden completada exitosamente
  | 'cancelled'        // Cancelada por el cliente o tienda
  | 'refunded'         // Reembolsada
  | 'returned'         // Devuelta por el cliente

  // Estados especiales
  | 'on_hold'          // En espera (problemas de stock, pago, etc.)
  | 'disputed'         // En disputa/reclamo
  | 'partially_delivered'; // Entregado parcialmente
```

---

## 🔄 **Flujos por Método de Entrega**

### **1. Pickup (Recogida en tienda)**
```
pending → confirmed → processing → ready_for_pickup → picked_up → completed
   ↓         ↓           ↓             ↓                ↓          ↓
cancelled  cancelled   cancelled     cancelled       cancelled  (final)
```

### **2. Home Delivery (Entrega a domicilio)**
```
pending → confirmed → processing → ready_for_delivery → out_for_delivery → delivered → completed
   ↓         ↓           ↓              ↓                    ↓            ↓          ↓
cancelled  cancelled   cancelled      cancelled           cancelled   returned   (final)
```

### **3. Shipping (Envío tradicional)**
```
pending → confirmed → processing → ready_for_delivery → shipped → delivered → completed
   ↓         ↓           ↓              ↓                ↓         ↓          ↓
cancelled  cancelled   cancelled      cancelled       returned  returned   (final)
```

### **4. Arrange with Seller (Acordar con vendedor)**
```
pending → confirmed → processing → [estado personalizado según acuerdo] → completed
   ↓         ↓           ↓                        ↓                    ↓
cancelled  cancelled   cancelled              cancelled            (final)
```

---

## 📊 **Estados por Categoría**

### **Estados Iniciales** (Creación y pago)
- `pending`: Orden recién creada, esperando validación
- `payment_pending`: Pago en proceso (ej: transferencias bancarias)
- `confirmed`: Pago confirmado, orden validada

### **Estados de Preparación**
- `processing`: Preparando productos, empaquetando
- `ready_for_pickup`: Lista para que el cliente recoja
- `ready_for_delivery`: Lista para envío/entrega

### **Estados de Envío/Entrega**
- `out_for_delivery`: Repartidor en camino (solo homeDelivery)
- `shipped`: Enviado por paquetería (solo shipping)
- `delivered`: Entregado al cliente
- `picked_up`: Cliente recogió en tienda

### **Estados Finales**
- `completed`: Orden exitosa y finalizada
- `cancelled`: Cancelada antes de completarse
- `refunded`: Dinero devuelto al cliente
- `returned`: Producto devuelto

### **Estados Especiales**
- `on_hold`: Pausada por algún problema
- `disputed`: Cliente reportó problema/reclamo
- `partially_delivered`: Solo algunos items entregados

---

## 🎯 **Recomendaciones de Uso**

### **Transiciones Automáticas**
- `pending` → `confirmed`: Después de validación y pago exitoso
- `confirmed` → `processing`: Inicia preparación automática
- `processing` → `ready_for_*`: Cuando empaquetado termina
- `ready_for_*` → `out_for_delivery`/`shipped`: Al asignar envío
- `out_for_delivery`/`shipped` → `delivered`: Confirmación de entrega
- `delivered` → `completed`: Después de período de reclamaciones

### **Transiciones Manuales** (Admin)
- Cualquier estado → `cancelled`: Cancelación por admin/cliente
- `delivered` → `returned`: Cliente devuelve producto
- `returned` → `refunded`: Después de procesar devolución
- Cualquier estado → `on_hold`: Pausar por problemas
- `on_hold` → estado anterior: Reanudar proceso

### **Estados por Método de Entrega**

| Método | Estados Específicos | Estados Finales |
|--------|-------------------|-----------------|
| **pickup** | `ready_for_pickup`, `picked_up` | `completed`, `cancelled` |
| **homeDelivery** | `ready_for_delivery`, `out_for_delivery`, `delivered` | `completed`, `returned`, `refunded` |
| **shipping** | `ready_for_delivery`, `shipped`, `delivered` | `completed`, `returned`, `refunded` |
| **arrangeWithSeller** | Estados flexibles según acuerdo | `completed`, `cancelled` |

---

## 💡 **Beneficios de Este Sistema**

### **✅ Cobertura Completa**
- Maneja todos los métodos de entrega
- Estados para cada etapa del proceso
- Casos especiales (devoluciones, disputas, etc.)

### **✅ Claridad para Clientes**
- Estados descriptivos y comprensibles
- Seguimiento claro del progreso
- Expectativas realistas de entrega

### **✅ Eficiencia Operativa**
- Estados específicos facilitan automatización
- Fácil filtrado y búsqueda
- Reportes detallados por estado

### **✅ Flexibilidad**
- Estados especiales para casos excepcionales
- Transiciones lógicas pero flexibles
- Adaptable a diferentes métodos de entrega

---

## 🔧 **Implementación en Código**

### **Validación de Transiciones**
```typescript
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  'pending': ['confirmed', 'cancelled', 'payment_pending'],
  'payment_pending': ['confirmed', 'cancelled', 'pending'],
  'confirmed': ['processing', 'cancelled', 'on_hold'],
  'processing': ['ready_for_pickup', 'ready_for_delivery', 'cancelled', 'on_hold'],
  'ready_for_pickup': ['picked_up', 'cancelled'],
  'ready_for_delivery': ['out_for_delivery', 'shipped', 'cancelled'],
  'out_for_delivery': ['delivered', 'cancelled', 'partially_delivered'],
  'shipped': ['delivered', 'returned', 'cancelled', 'partially_delivered'],
  'delivered': ['completed', 'returned', 'disputed'],
  'picked_up': ['completed', 'returned', 'disputed'],
  'completed': [], // Estado final
  'cancelled': ['refunded'], // Solo puede ir a reembolsado
  'refunded': [], // Estado final
  'returned': ['refunded', 'processing'], // Reembolsar o reprocesar
  'on_hold': ['processing', 'ready_for_pickup', 'ready_for_delivery', 'cancelled'],
  'disputed': ['refunded', 'completed', 'cancelled'],
  'partially_delivered': ['completed', 'returned', 'disputed']
};
```

### **Estados por Método de Entrega**
```typescript
const statusByDeliveryMethod: Record<DeliveryMethod, OrderStatus[]> = {
  'pickup': ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'picked_up', 'completed', 'cancelled', 'on_hold'],
  'homeDelivery': ['pending', 'confirmed', 'processing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'refunded', 'on_hold', 'disputed', 'partially_delivered'],
  'shipping': ['pending', 'confirmed', 'processing', 'ready_for_delivery', 'shipped', 'delivered', 'completed', 'cancelled', 'returned', 'refunded', 'on_hold', 'disputed', 'partially_delivered'],
  'arrangeWithSeller': ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'shipped', 'delivered', 'picked_up', 'completed', 'cancelled', 'on_hold', 'disputed']
};
```

---

## 🚀 **Próximos Pasos**

1. **Actualizar triggers** para manejar los nuevos estados
2. **Crear validaciones** de transiciones de estado
3. **Actualizar frontend** para mostrar estados descriptivos
4. **Configurar notificaciones** por cambio de estado
5. **Crear reportes** basados en estados

¿Te gustaría que implemente alguna de estas funcionalidades adicionales?</content>
<parameter name="filePath">/Users/rafaalva/Desktop/Git Rafa/verona/server/functions/src/interfaces/ORDER_STATUS_GUIDE.md