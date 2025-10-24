# Firebase Analytics - Guía de Uso

## Configuración Actual

Firebase Analytics está completamente configurado y funcionando en el proyecto. Los eventos se envían automáticamente a Firebase y puedes verlos en la consola de Firebase.

## Acceso al Panel de Analytics

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: **verona-ffbcd**
3. En el menú lateral, haz clic en **Analytics** → **Dashboard**
4. También puedes ver eventos en tiempo real en **Analytics** → **DebugView**

## Eventos Automáticos Configurados

### 1. **Screen Tracking (page_view)**
Se trackea automáticamente cada vez que el usuario navega a una nueva página.

**Configurado por:** `ScreenTrackingService` en `app.config.ts`

### 2. **User Tracking**
Trackea automáticamente información del usuario.

**Configurado por:** `UserTrackingService` en `app.config.ts`

## Eventos Personalizados Implementados

### Página de Producto (`/product`)

#### **Vista de Producto (view_item)**
Se dispara automáticamente cuando un usuario ve un producto.

```typescript
// Ejemplo del evento que se envía:
{
  currency: 'USD',
  value: 299.99,
  items: [{
    item_id: 'product-123',
    item_name: 'Nombre del Producto',
    item_category: 'Electrónicos',
    price: 299.99
  }]
}
```

#### **Añadir al Carrito (add_to_cart)**
Se dispara cuando un usuario añade un producto al carrito.

```typescript
// Ejemplo del evento que se envía:
{
  currency: 'USD',
  value: 299.99,
  items: [{
    item_id: 'product-123',
    item_name: 'Nombre del Producto',
    price: 299.99,
    quantity: 2
  }]
}
```

#### **Añadir a Wishlist (add_to_wishlist)**
Se dispara cuando un usuario añade un producto a su lista de deseos.

```typescript
// Ejemplo del evento que se envía:
{
  currency: 'USD',
  value: 299.99,
  items: [{
    item_id: 'product-123',
    item_name: 'Nombre del Producto',
    price: 299.99
  }]
}
```

### Página de Búsqueda (`/search`)

#### **Búsqueda (search)**
Se dispara cuando un usuario realiza una búsqueda.

```typescript
// Ejemplo del evento que se envía:
{
  search_term: 'laptop gaming'
}
```

## Servicio de Analytics

Hemos creado un servicio centralizado para facilitar el tracking de eventos: `AnalyticsService`

### Ubicación
`src/app/services/analytics/analytics.service.ts`

### Métodos Disponibles

#### 1. **logEvent(eventName, eventParams)**
Registra cualquier evento personalizado.

```typescript
this.analyticsService.logEvent('custom_event', {
  category: 'engagement',
  action: 'click',
  label: 'banner_home'
});
```

#### 2. **logProductView(productId, productName, price, category?)**
Trackea vista de producto.

```typescript
this.analyticsService.logProductView(
  'prod-123',
  'MacBook Pro',
  1999.99,
  'Computadoras'
);
```

#### 3. **logSearch(searchTerm)**
Trackea búsquedas.

```typescript
this.analyticsService.logSearch('iPhone 15');
```

#### 4. **logAddToCart(productId, productName, price, quantity)**
Trackea añadir al carrito.

```typescript
this.analyticsService.logAddToCart(
  'prod-123',
  'MacBook Pro',
  1999.99,
  1
);
```

#### 5. **logBeginCheckout(value, items)**
Trackea inicio del checkout.

```typescript
this.analyticsService.logBeginCheckout(2999.98, [
  {
    item_id: 'prod-123',
    item_name: 'MacBook Pro',
    price: 1999.99,
    quantity: 1
  },
  {
    item_id: 'prod-456',
    item_name: 'AirPods Pro',
    price: 249.99,
    quantity: 1
  }
]);
```

#### 6. **logPurchase(transactionId, value, items, tax?, shipping?)**
Trackea compra completada.

```typescript
this.analyticsService.logPurchase(
  'order-789',
  2999.98,
  [
    {
      item_id: 'prod-123',
      item_name: 'MacBook Pro',
      price: 1999.99,
      quantity: 1
    }
  ],
  240.00,  // tax
  50.00    // shipping
);
```

#### 7. **logAddToWishlist(productId, productName, price)**
Trackea añadir a wishlist.

```typescript
this.analyticsService.logAddToWishlist(
  'prod-123',
  'MacBook Pro',
  1999.99
);
```

#### 8. **setUserId(userId)**
Establece el ID del usuario autenticado.

```typescript
this.analyticsService.setUserId('user-123');
```

#### 9. **setUserProperties(properties)**
Establece propiedades del usuario.

```typescript
this.analyticsService.setUserProperties({
  account_type: 'premium',
  signup_date: '2024-01-15'
});
```

## Cómo Añadir Tracking a Nuevos Componentes

### Paso 1: Inyectar el Servicio

```typescript
import { AnalyticsService } from '../../../services/analytics/analytics.service';

export class MiComponente {
  private readonly analyticsService = inject(AnalyticsService);
  
  // ... tu código
}
```

### Paso 2: Llamar a los Métodos

```typescript
// Ejemplo: trackear cuando un usuario hace clic en un botón
onBotonClick() {
  this.analyticsService.logEvent('button_click', {
    button_name: 'subscribe_newsletter',
    page: 'home'
  });
  
  // ... resto de tu lógica
}
```

## Ver Analytics en Tiempo Real

### DebugView (Desarrollo)

Para ver eventos en tiempo real durante el desarrollo:

1. Ve a Firebase Console → Analytics → DebugView
2. Los eventos aparecerán inmediatamente cuando interactúes con tu app local
3. **Nota:** DebugView funciona automáticamente en localhost

### Dashboard (Producción)

Para ver estadísticas agregadas:

1. Ve a Firebase Console → Analytics → Dashboard
2. Aquí verás gráficos y métricas agregadas
3. **Nota:** Los datos pueden tardar 24-48 horas en aparecer

### Events Explorer

Para analizar eventos específicos:

1. Ve a Firebase Console → Analytics → Events
2. Puedes ver todos los eventos que se están disparando
3. Haz clic en cualquier evento para ver detalles y parámetros

## Eventos de E-commerce Recomendados

Para un sitio de e-commerce completo, considera implementar estos eventos adicionales:

- ✅ `view_item` - Vista de producto (IMPLEMENTADO)
- ✅ `add_to_cart` - Añadir al carrito (IMPLEMENTADO)
- ✅ `add_to_wishlist` - Añadir a wishlist (IMPLEMENTADO)
- ✅ `search` - Búsqueda (IMPLEMENTADO)
- ⏳ `view_item_list` - Ver lista de productos (categoría)
- ⏳ `select_item` - Click en producto desde lista
- ⏳ `begin_checkout` - Iniciar checkout
- ⏳ `add_payment_info` - Añadir info de pago
- ⏳ `add_shipping_info` - Añadir info de envío
- ⏳ `purchase` - Compra completada
- ⏳ `refund` - Reembolso

## Verificación de Configuración

### ✅ Checklist de Implementación

- [x] Firebase Analytics configurado en `app.config.ts`
- [x] `ScreenTrackingService` activo para trackeo de páginas
- [x] `UserTrackingService` activo para trackeo de usuarios
- [x] Analytics solo se ejecuta en el navegador (no en SSR)
- [x] `AnalyticsService` creado y documentado
- [x] Tracking implementado en página de producto
- [x] Tracking implementado en página de búsqueda
- [x] `measurementId` configurado en environment (`G-V2H4JHJMXJ`)

### Verificar que Funciona

1. **Abre la consola del navegador** mientras navegas por tu sitio
2. **No deberías ver errores** relacionados con Analytics
3. **Ve a DebugView** en Firebase Console
4. **Interactúa con tu sitio** (busca productos, añade al carrito, etc.)
5. **Verifica que los eventos aparecen** en DebugView

## Solución de Problemas

### No veo eventos en Firebase

1. **Verifica que estás en DebugView**, no en Dashboard
2. **Asegúrate de que measurementId es correcto** en `environment.ts`
3. **Revisa la consola del navegador** para errores
4. **Espera unos segundos** - puede haber un pequeño delay
5. **Verifica que tienes conexión a internet**

### Eventos duplicados

- Analytics puede mostrar eventos duplicados en DebugView si tienes múltiples pestañas abiertas
- Esto es normal y no afecta a los datos de producción

### No funciona en producción

- Asegúrate de que `environment.ts` (producción) tiene el `measurementId` correcto
- Los datos de producción pueden tardar 24-48 horas en aparecer en Dashboard

## Recursos Adicionales

- [Documentación oficial de Firebase Analytics](https://firebase.google.com/docs/analytics)
- [Eventos de E-commerce recomendados](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [Angular Fire Analytics](https://github.com/angular/angularfire/blob/master/docs/analytics/getting-started.md)
