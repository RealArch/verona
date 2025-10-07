// Interfaces para el servicio de ventas

export type DeliveryMethod = 'pickup' | 'homeDelivery' | 'shipping' | 'arrangeWithSeller';


export interface CreateOrderRequest {
  userId: string;
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

