// Interfaces para el servicio de ventas

// Tipo para métodos de entrega disponibles
export type DeliveryMethod = 'pickup' | 'homeDelivery' | 'shipping' | 'arrangeWithSeller';

export interface CreateOrderRequest {
  userId: string;
  items: OrderItem[];
  shippingAddress?: UserAddress | null; // Opcional cuando no se requiere dirección
  billingAddress?: UserAddress | null; // Opcional cuando no se requiere dirección
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
  taxPercentage: number;
  shippingCost: number;
  total: number;
  itemCount: number;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  message?: string;
}

// Interfaz para una orden completa (desde Firestore)
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  shippingAddress?: UserAddress | null;
  billingAddress?: UserAddress | null;
  deliveryMethod: DeliveryMethod;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  totals: OrderTotals;
  createdAt: Date;
  updatedAt: Date;
}

// Importar UserAddress desde auth interfaces
import { UserAddress } from './auth';