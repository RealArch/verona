import { Product, ProductVariant } from '../interfaces/product.interface';

export interface PriceRange {
    minPrice: number;
    maxPrice: number;
}

export function getMinMaxPrice(product: Product | any): PriceRange {
    try {
        console.log('getMinMaxPrice called with:', JSON.stringify({
            price: product.price,
            hasVariants: Array.isArray(product.variants),
            variantsLength: product.variants?.length || 0,
            variants: product.variants || []
        }));

        // Si no hay variantes o el array de variantes está vacío
        if (!product.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
            // Usar el precio base del producto
            const basePrice = product.price || 0;
            console.log('No variants found, using base price:', basePrice);
            return {
                minPrice: basePrice,
                maxPrice: basePrice
            };
        }

        // Filtrar solo las variantes activas y pausadas (no archivadas)
        const activeVariants = product.variants.filter((variant: ProductVariant) => 
            variant.status === 'active' || variant.status === 'paused'
        );

        console.log('Active variants found:', activeVariants.length, activeVariants);

        // Si no hay variantes activas, usar el precio base
        if (activeVariants.length === 0) {
            const basePrice = product.price || 0;
            console.log('No active variants, using base price:', basePrice);
            return {
                minPrice: basePrice,
                maxPrice: basePrice
            };
        }

        // Obtener todos los precios de las variantes activas
        const prices = activeVariants.map((variant: ProductVariant) => variant.price || 0);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        console.log('Calculated from variants:', { minPrice, maxPrice, prices });

        // Validar que los precios sean números válidos
        if (isNaN(minPrice) || isNaN(maxPrice)) {
            console.error('Invalid prices calculated, falling back to base price');
            const basePrice = product.price || 0;
            return {
                minPrice: basePrice,
                maxPrice: basePrice
            };
        }

        return {
            minPrice,
            maxPrice
        };
    } catch (error) {
        console.error('Error in getMinMaxPrice:', error);
        const basePrice = product.price || 0;
        return {
            minPrice: basePrice,
            maxPrice: basePrice
        };
    }
}
