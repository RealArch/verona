export interface Order {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  items: OrderItem[];
  totals: OrderTotals;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  billingAddress?: BillingAddress;
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  notes?: string;
  createdAt: any; // Timestamp from Firestore
  updatedAt: any; // Timestamp from Firestore
}

export interface OrderItem {
  productId: string;
  productImage?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId?: string;
  variantName?: string;
  variantColorHex?: string;
}

export interface OrderTotals {
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  taxPercentage: number;
  shippingCost: number;
  total: number;
}

export interface BillingAddress {
  id: string;
  name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  municipality?: string;
  description?: string;
}

export interface ShippingAddress {
  id: string;
  name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  municipality?: string;
  description?: string;
}

export type OrderStatus = 
  | 'pending'      // Pendiente
  | 'confirmed'    // Confirmada
  | 'preparing'    // En preparación
  | 'ready'        // Lista para entrega/envío
  | 'shipped'      // Enviada
  | 'delivered'    // Entregada
  | 'cancelled'    // Cancelada
  | 'refunded';    // Reembolsada

export type DeliveryMethod = 
  | 'pickup'               // Retiro en persona
  | 'homeDelivery'         // Delivery a domicilio
  | 'shipping'             // Envío
  | 'arrangeWithSeller';   // Acordar con vendedor

export interface OrderSearchFilters {
  query?: string;                    // Búsqueda por texto (nombre cliente, email, ID)
  status?: OrderStatus[];            // Filtrar por uno o varios estados
  deliveryMethod?: DeliveryMethod[]; // Filtrar por uno o varios métodos de entrega
  dateFrom?: Date;                   // Fecha desde (createdAt)
  dateTo?: Date;                     // Fecha hasta (createdAt)
}

export interface OrderSearchParams extends OrderSearchFilters {
  page?: number;       // Página actual (default: 1)
  pageSize?: number;   // Resultados por página (default: 20)
}

export interface OrderSearchResult {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
