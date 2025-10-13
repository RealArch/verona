import { Timestamp } from "@angular/fire/firestore";
import { ProductVariant } from "./products";

/**
 * Item individual del carrito de compras
 */
export interface CartItem {
  id: string;                    // ID único del item en el carrito
  productId: string;             // ID del producto
  variantId?: string;            // ID de la variante (opcional si no hay variantes)
  quantity: number;              // Cantidad seleccionada
  unitPrice: number;             // Precio unitario al momento de agregar
  totalPrice: number;            // Precio total (unitPrice * quantity)
  
  // Información del producto (snapshot para evitar inconsistencias)
  productName: string;
  productSku: string;
  productSlug: string;
  productImage: string;          // URL de la imagen principal
  
  // Información de la variante (si aplica)
  variantName?: string;
  variantSku?: string;
  variantColorHex?: string;
  
  // Disponibilidad
  available?: boolean;           // Si el producto/variante está disponible
  
  // Metadatos
  addedAt: Timestamp;           // Cuándo se agregó al carrito
  updatedAt: Timestamp;         // Última actualización
}

/**
 * Carrito de compras completo
 */
export interface ShoppingCart {
  id?: string;                   // ID del carrito (para usuarios autenticados)
  userId?: string;               // ID del usuario (null para invitados)
  sessionId?: string;            // ID de sesión para usuarios invitados
  
  items: CartItem[];             // Items en el carrito
  
  // Totales calculados
  subtotal: number;              // Suma de todos los items
  taxAmount: number;             // Impuestos calculados
  shippingCost: number;          // Costo de envío
  discountAmount: number;        // Descuentos aplicados
  total: number;                 // Total final
  
  // Información de descuentos
  appliedCoupons: AppliedCoupon[];
  
  // Metadatos
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;         // Para carritos de invitados
  
  // Estado
  status: CartStatus;
}

/**
 * Cupón aplicado al carrito
 */
export interface AppliedCoupon {
  code: string;                  // Código del cupón
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;         // Porcentaje (0-100) o cantidad fija
  appliedAmount: number;         // Descuento calculado aplicado
  appliedAt: Timestamp;
}

/**
 * Estados posibles del carrito
 */
export type CartStatus = 'active' | 'abandoned' | 'converted' | 'expired';

/**
 * Resumen del carrito (para mostrar en header/mini-cart)
 */
export interface CartSummary {
  itemCount: number;             // Número total de items (suma de quantities)
  uniqueItemCount: number;       // Número de productos únicos
  subtotal: number;
  total: number;
}

/**
 * Request para agregar item al carrito
 */
export interface AddToCartRequest {
  productId: string;
  variantId?: string;
  quantity: number;
}

/**
 * Request para actualizar cantidad de item
 */
export interface UpdateCartItemRequest {
  itemId: string;
  quantity: number;
}
