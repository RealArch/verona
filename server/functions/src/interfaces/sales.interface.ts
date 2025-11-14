// Interfaces para el servicio de ventas

export type DeliveryMethod = 'pickup' | 'homeDelivery' | 'shipping' | 'arrangeWithSeller';

// Estados de orden completos y profesionales
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

// Datos del usuario que se guardan en la orden (solo para almacenamiento interno)
export interface UserData {
  uid: string;        // ID único del usuario
  firstName: string;  // Nombre del usuario
  lastName: string;   // Apellido del usuario
  email: string;      // Email del usuario
}

export interface CreateOrderRequest {
  userId: string; // ID del usuario que realiza la orden (enviado por el frontend)
  items: OrderItem[];
  shippingAddress?: UserAddress | null; // Opcional cuando no se requiere dirección
  billingAddress: UserAddress | null; // Opcional cuando no se requiere dirección
  deliveryMethod: DeliveryMethod; // Método de entrega seleccionado
  paymentMethod: string; // Por ahora placeholder
  notes?: string;
  totals: OrderTotals;

}

export interface OrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName: string;
  variantName?: string;
  variantColorHex?: string;
  productImage?: string;
  sku?: string; // SKU del producto o variante (siempre incluido, puede estar vacío)
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  taxPercentage: number;  // Porcentaje de impuestos enviado por el frontend
  shippingCost: number;
  total: number;
  itemCount: number;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  message?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Definición de UserAddress (coincide con el frontend)
export interface UserAddress {
  id?: string;
  name: string;
  address_1: string;
  address_2?: string | null;
  description?: string | null;
  municipality?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault?: boolean;
}

