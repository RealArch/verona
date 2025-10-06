/**
 * Utilidades para validación y actualización de stock en órdenes
 */

import { Timestamp } from '@google-cloud/firestore';
import { calculateDynamicPrice } from './priceCalculations';

export interface StockUpdateResult {
  stockUpdateData: any;
  availableStock: number;
  correctPrice: number;
  error?: { field: string; message: string };
}

/**
 * Valida y prepara la actualización de stock para una variante de producto
 * @param product - Documento del producto completo
 * @param item - Item de la orden con información de compra
 * @param itemPrefix - Prefijo para identificar el item en errores (ej: "items[0]")
 * @param now - Timestamp de Firestore para la actualización
 * @returns Resultado con datos de actualización, stock disponible, precio correcto y posibles errores
 */
export function prepareVariantStockUpdate(
  product: any,
  item: any,
  itemPrefix: string,
  now: Timestamp
): StockUpdateResult {
  const variantIndex = product.variants?.findIndex((v: any) => v.id === item.variantId);
  
  // Validar que la variante existe
  if (variantIndex === -1 || variantIndex === undefined) {
    return {
      stockUpdateData: null,
      availableStock: 0,
      correctPrice: 0,
      error: {
        field: `${itemPrefix}.variantId`,
        message: `La variante seleccionada de '${item.productName}' no existe`
      }
    };
  }

  const variant = product.variants[variantIndex];

  // Validar que la variante está activa
  if (variant.status !== 'active') {
    return {
      stockUpdateData: null,
      availableStock: 0,
      correctPrice: 0,
      error: {
        field: `${itemPrefix}.variantId`,
        message: `La variante '${item.variantName || 'seleccionada'}' de '${item.productName}' no está disponible`
      }
    };
  }

  const availableStock = variant.stock || 0;
  const newStock = availableStock - item.quantity;
  
  // Calcular precio correcto considerando precios dinámicos
  const correctPrice = calculateDynamicPrice(
    variant.price,
    variant.hasDynamicPricing,
    variant.dynamicPrices,
    item.quantity
  );

  // Clonar el array de variantes y actualizar solo la variante específica
  // Esto preserva todos los campos de todas las variantes
  const updatedVariants = product.variants.map((v: any, idx: number) => {
    if (idx === variantIndex) {
      return { ...v, stock: newStock };
    }
    return v;
  });

  // Calcular el stock global como la suma de todas las variantes
  const totalStock = updatedVariants.reduce((sum: number, v: any) => {
    // Solo contar variantes activas y pausadas (no archivadas)
    if (v.status === 'active' || v.status === 'paused') {
      return sum + (v.stock || 0);
    }
    return sum;
  }, 0);

  return {
    stockUpdateData: {
      variants: updatedVariants,
      stock: totalStock, // Actualizar stock global del producto
      updatedAt: now
    },
    availableStock,
    correctPrice
  };
}

/**
 * Valida y prepara la actualización de stock para un producto simple (sin variantes)
 * @param product - Documento del producto completo
 * @param item - Item de la orden con información de compra
 * @param now - Timestamp de Firestore para la actualización
 * @returns Resultado con datos de actualización, stock disponible y precio correcto
 */
export function prepareSimpleProductStockUpdate(
  product: any,
  item: any,
  now: Timestamp
): StockUpdateResult {
  const availableStock = product.stock || 0;
  const newStock = availableStock - item.quantity;
  
  // Calcular precio correcto considerando precios dinámicos
  const correctPrice = calculateDynamicPrice(
    product.price,
    product.hasDynamicPricing,
    product.dynamicPrices,
    item.quantity
  );

  return {
    stockUpdateData: {
      stock: newStock,
      updatedAt: now
    },
    availableStock,
    correctPrice
  };
}
