/**
 * Utilidades para cálculo de precios dinámicos
 */

export interface DynamicPriceRange {
  minQuantity: number;
  price: number;
}

/**
 * Calcula el precio aplicable según precios dinámicos y cantidad
 * @param basePrice - Precio base del producto o variante
 * @param hasDynamicPricing - Indica si tiene precios dinámicos habilitados
 * @param dynamicPrices - Array de rangos de precios dinámicos
 * @param quantity - Cantidad solicitada
 * @returns Precio aplicable según la cantidad
 */
export function calculateDynamicPrice(
  basePrice: number,
  hasDynamicPricing: boolean | undefined,
  dynamicPrices: DynamicPriceRange[] | undefined,
  quantity: number
): number {
  // Si no tiene precios dinámicos, retornar precio base
  if (!hasDynamicPricing || !dynamicPrices || dynamicPrices.length === 0) {
    return basePrice;
  }

  // Ordenar por minQuantity descendente y encontrar el rango aplicable
  const sortedPrices = [...dynamicPrices].sort((a, b) => b.minQuantity - a.minQuantity);
  const applicablePrice = sortedPrices.find(dp => quantity >= dp.minQuantity);
  
  return applicablePrice ? applicablePrice.price : basePrice;
}
