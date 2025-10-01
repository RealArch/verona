import { Product, ProductVariant } from '../interfaces/product.interface';

export interface PriceRange {
    minPrice: number;
    maxPrice: number;
}

export function getMinMaxPrice(product: Product | any): PriceRange {
    try {
        console.log('getMinMaxPrice called with:', JSON.stringify({
            price: product?.price,
            hasDynamicPricing: product?.hasDynamicPricing,
            dynamicPrices: product?.dynamicPrices,
            hasVariants: Array.isArray(product?.variants),
            variantsLength: product?.variants?.length || 0
        }));

        // Helper para leer el primer precio dinámico de un objeto que podría ser producto o variante
        const getFirstDynamicPrice = (obj: any): number | null => {
            try {
                if (obj?.hasDynamicPricing && Array.isArray(obj?.dynamicPrices) && obj.dynamicPrices.length > 0) {
                    const p = Number(obj.dynamicPrices[0]?.price);
                    return isNaN(p) ? 0 : p;
                }
                return null;
            } catch {
                return null;
            }
        };

        // Si no hay variantes o el array de variantes está vacío => producto simple
        if (!product?.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
            // Preferir precio dinámico si está habilitado y existe
            const dynPrice = getFirstDynamicPrice(product);
            if (dynPrice !== null) {
                console.log('Simple product with dynamic pricing. Using first dynamic price:', dynPrice);
                return { minPrice: dynPrice, maxPrice: dynPrice };
            }

            // Fallback a precio base
            const basePrice = Number(product?.price) || 0;
            console.log('Simple product with static pricing. Using base price:', basePrice);
            return { minPrice: basePrice, maxPrice: basePrice };
        }

        // Filtrar solo las variantes activas y pausadas (no archivadas)
        const activeVariants = product.variants.filter((variant: ProductVariant) => 
            variant.status === 'active' || variant.status === 'paused'
        );

        console.log('Active variants found:', activeVariants.length);

        // Si no hay variantes activas, usar el precio base
        if (activeVariants.length === 0) {
            // Preferir precio dinámico del producto
            const dynPrice = getFirstDynamicPrice(product);
            if (dynPrice !== null) {
                console.log('No active variants. Using product dynamic price:', dynPrice);
                return { minPrice: dynPrice, maxPrice: dynPrice };
            }
            const basePrice = Number(product?.price) || 0;
            console.log('No active variants. Using product base price:', basePrice);
            return { minPrice: basePrice, maxPrice: basePrice };
        }

        // Obtener todos los precios de las variantes activas
        const prices = activeVariants.map((variant: ProductVariant) => {
            // Si la variante tiene precios dinámicos, usar el primer precio dinámico
            const vDyn = getFirstDynamicPrice(variant as any);
            if (vDyn !== null) return vDyn;
            // Fallback al precio estático de la variante
            const vPrice = Number((variant as any)?.price);
            return isNaN(vPrice) ? 0 : vPrice;
        });
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        console.log('Calculated from variants:', { minPrice, maxPrice, prices });

        // Validar que los precios sean números válidos
        if (isNaN(minPrice) || isNaN(maxPrice)) {
            console.error('Invalid prices calculated, falling back to product price');
            const dynPrice = getFirstDynamicPrice(product);
            if (dynPrice !== null) {
                return { minPrice: dynPrice, maxPrice: dynPrice };
            }
            const basePrice = Number(product?.price) || 0;
            return { minPrice: basePrice, maxPrice: basePrice };
        }

        return {
            minPrice,
            maxPrice
        };
    } catch (error) {
        console.error('Error in getMinMaxPrice:', error);
        // Fallback al precio del producto (dinámico si disponible)
        const getSafeDyn = (): number | null => {
            try {
                if (product?.hasDynamicPricing && Array.isArray(product?.dynamicPrices) && product.dynamicPrices.length > 0) {
                    const p = Number(product.dynamicPrices[0]?.price);
                    return isNaN(p) ? 0 : p;
                }
                return null;
            } catch {
                return null;
            }
        };
        const dynPrice = getSafeDyn();
        if (dynPrice !== null) {
            return { minPrice: dynPrice, maxPrice: dynPrice };
        }
        const basePrice = Number(product?.price) || 0;
        return { minPrice: basePrice, maxPrice: basePrice };
    }
}
