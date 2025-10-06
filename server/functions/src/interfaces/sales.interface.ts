// Interfaces para el servicio de ventas

export interface CreateOrderRequest {
  userId: string;
  items: OrderItem[];
  shippingAddress: UserAddress;
  billingAddress?: UserAddress; // Opcional, por ahora usaremos la misma dirección
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

