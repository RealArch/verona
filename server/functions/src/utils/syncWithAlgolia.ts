import { algoliasearch } from 'algoliasearch';
import { logger } from 'firebase-functions';

/**
 * Prepara los datos del producto para sincronizar con Algolia
 * Define explícitamente qué campos se envían a Algolia para búsqueda
 * @param productData - Datos completos del producto desde Firestore
 * @param productId - ID del producto
 * @returns Objeto con solo los campos necesarios para Algolia
 */
export function prepareProductDataForAlgolia(productData: any, productId: string) {
    return {
        objectID: productId,
        
        // Información básica del producto
        id: productData.id || productId,
        name: productData.name,
        slug: productData.slug,
        
        // Descripciones
        // description: productData.description,
        // plain_description: productData.plain_description,
        
        // Precios y stock
        price: productData.price,
        stock: productData.stock,
        sku: productData.sku,
        
        // Categorización
        categoryId: productData.categoryId,
        
        // Estado y disponibilidad
        status: productData.status,
        processing: productData.processing,
        
        // Imágenes (mantener estructura completa con todos los tamaños)
        photos: productData.photos?.map((photo: any) => ({
            thumbnail: photo.thumbnail ? {
                url: photo.thumbnail.url,
                // name: photo.thumbnail.name,
                // path: photo.thumbnail.path,
                // type: photo.thumbnail.type,
                // processing: photo.thumbnail.processing
            } : undefined,
            small: photo.small ? {
                url: photo.small.url,
                // name: photo.small.name,
                // path: photo.small.path,
                // type: photo.small.type,
                // processing: photo.small.processing
            } : undefined,
            medium: photo.medium ? {
                url: photo.medium.url,
                // name: photo.medium.name,
                // path: photo.medium.path,
                // type: photo.medium.type,
                // processing: photo.medium.processing
            } : undefined,
            large: photo.large ? {
                url: photo.large.url,
                // name: photo.large.name,
                // path: photo.large.path,
                // type: photo.large.type,
                // processing: photo.large.processing
            } : undefined,
            processing: photo.processing
        })) || [],
        
        // Variantes
        variationAttributes: productData.variationAttributes,
        variants: productData.variants?.map((variant: any) => ({
            id: variant.id,
            name: variant.name,
            price: variant.price,
            sku: variant.sku,
            status: variant.status,
            stock: variant.stock,
            colorHex: variant.colorHex,
            hasDynamicPricing: variant.hasDynamicPricing
        })) || [],
        pausedVariantsCount: productData.pausedVariantsCount,
        
        // Precios dinámicos
        hasDynamicPricing: productData.hasDynamicPricing,
        dynamicPrices: productData.dynamicPrices?.map((priceRange: any) => ({
            id: priceRange.id,
            minQuantity: priceRange.minQuantity,
            price: priceRange.price
        })) || [],
        
        // Timestamps para ordenamiento
        createdAt: productData.createdAt,
        updatedAt: productData.updatedAt,
        
        // Campos calculados para búsqueda
        _tags: [
            productData.status,
            ...(productData.variants?.map((v: any) => v.status) || []),
            productData.hasDynamicPricing ? 'dynamic-pricing' : 'fixed-pricing'
        ]
    };
}

export async function syncDocumentAlgolia(indexName: string, uid: string, data: any, algoliaAdminKey: string, algoliaAppId: string) {
    try {
        // Inicializar cliente de Algolia
        const client = algoliasearch(algoliaAppId, algoliaAdminKey);

        // Preparar los datos para Algolia según el tipo de índice
        let algoliaData;
        
        if (indexName.includes('products')) {
            // Para productos, usar la función de preparación específica
            algoliaData = prepareProductDataForAlgolia(data, uid);
        } else {
            // Para otros índices, usar todos los datos
            algoliaData = {
                objectID: uid,
                ...data
            };
        }

        // Sincronizar documento con Algolia
        await client.saveObject({
            indexName,
            body: algoliaData
        });
        
        logger.info(`Document successfully synced to Algolia index "${indexName}" with ID: ${uid}`);
        
    } catch (error) {
        // Loggear el error pero no detener la ejecución
        logger.error(`Error syncing document to Algolia index "${indexName}" with ID: ${uid}`, {
            error: error instanceof Error ? error.message : String(error),
            indexName,
            uid,
            algoliaAppIdAvailable: !!algoliaAppId,
            algoliaAdminKeyAvailable: !!algoliaAdminKey
        });
        
        // No hacer throw del error para no interrumpir otros procesos
        console.warn(`⚠️ Algolia sync failed for ${uid}, but execution continues`);
    }
}

export async function removeDocumentAlgolia(indexName: string, uid: string, algoliaAdminKey: string, algoliaAppId: string) {
    try {
        // Inicializar cliente de Algolia
        const client = algoliasearch(algoliaAppId, algoliaAdminKey);

        // Eliminar documento de Algolia
        await client.deleteObject({
            indexName,
            objectID: uid
        });
        
        logger.info(`Document successfully removed from Algolia index "${indexName}" with ID: ${uid}`);
        
    } catch (error) {
        // Loggear el error pero no detener la ejecución
        logger.error(`Error removing document from Algolia index "${indexName}" with ID: ${uid}`, {
            error: error instanceof Error ? error.message : String(error),
            indexName,
            uid,
            algoliaAppIdAvailable: !!algoliaAppId,
            algoliaAdminKeyAvailable: !!algoliaAdminKey
        });
        
        // No hacer throw del error para no interrumpir otros procesos
        console.warn(`⚠️ Algolia removal failed for ${uid}, but execution continues`);
    }
}