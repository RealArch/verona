import { algoliasearch } from 'algoliasearch';
import { logger } from 'firebase-functions';

export async function syncDocumentAlgolia(indexName: string, uid: string, data: any, algoliaAdminKey: string, algoliaAppId: string) {
    try {
        // Inicializar cliente de Algolia
        const client = algoliasearch(algoliaAppId, algoliaAdminKey);

        // Preparar los datos para Algolia (agregar objectID)
        const algoliaData = {
            objectID: uid,
            ...data
        };

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