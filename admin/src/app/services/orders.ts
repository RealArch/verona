import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { algoliasearch } from 'algoliasearch';
import { environment } from 'src/environments/environment';
import { Order, OrderSearchFilters, OrderSearchResult, OrderStatus } from '../interfaces/order';

@Injectable({
  providedIn: 'root'
})
export class Orders {
  private algoliaClient: any;
  private firestore: Firestore = inject(Firestore);
  private injector: Injector = inject(Injector);

  constructor() {
    this.algoliaClient = algoliasearch(
      environment.algolia.appId,
      environment.algolia.apiKey
    );
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      try {
        const orderDoc = doc(this.firestore, `orders/${orderId}`);
        await updateDoc(orderDoc, {
          status,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
    });
  }

  /**
   * Busca órdenes en Algolia con filtros y paginación
   * @param page - Número de página (0-indexed)
   * @param hitsPerPage - Cantidad de resultados por página
   * @param filters - Filtros de búsqueda opcionales
   * @returns Promise con los resultados de la búsqueda
   */
  async searchOrders(
    page: number = 0,
    hitsPerPage: number = 20,
    filters?: OrderSearchFilters
  ): Promise<OrderSearchResult> {
    try {
      // Construir el string de filtros para Algolia
      const filterStrings: string[] = [];
      console.log(filters);
      // Filtro por fecha desde (createdAt >= dateFrom)
      if (filters?.dateFrom) {
        const timestamp = filters.dateFrom.getTime(); // Usar milliseconds directamente
        console.log('Date from filter:', filters.dateFrom, 'timestamp (ms):', timestamp);
        filterStrings.push(`createdAt >= ${timestamp}`);
      }

      // Filtro por fecha hasta (createdAt <= dateTo)
      if (filters?.dateTo) {
        // Para fecha "hasta", incluir todo el día (23:59:59.999)
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        const timestamp = endOfDay.getTime(); // Usar milliseconds directamente
        console.log('Date to filter:', filters.dateTo, 'end of day:', endOfDay, 'timestamp (ms):', timestamp);
        filterStrings.push(`createdAt <= ${timestamp}`);
      }

      // Filtro por status (puede ser uno o varios)
      if (filters?.status && filters.status.length > 0) {
        const statusFilters = filters.status.map(s => `status:${s}`).join(' OR ');
        filterStrings.push(`(${statusFilters})`);
      }

      // Filtro por método de entrega (puede ser uno o varios)
      if (filters?.deliveryMethod && filters.deliveryMethod.length > 0) {
        const deliveryFilters = filters.deliveryMethod.map(d => `deliveryMethod:${d}`).join(' OR ');
        filterStrings.push(`(${deliveryFilters})`);
      }

      // Combinar todos los filtros con AND
      const filtersString = filterStrings.length > 0 
        ? filterStrings.join(' AND ') 
        : '';

      console.log('Algolia filters string:', filtersString);

      // Realizar la búsqueda en Algolia
      const { results } = await this.algoliaClient.search({
        requests: [
          {
            indexName: environment.algolia.indexes.orders,
            query: filters?.query || '',
            page,
            hitsPerPage,
            filters: filtersString,
          }
        ]
      });

      const searchResults = results[0];
      const totalPages = Math.ceil(searchResults.nbHits / hitsPerPage);

      // Mapear los hits de Algolia a objetos Order válidos
      const orders: Order[] = searchResults.hits.map((hit: any) => ({
        id: hit.objectID || hit.id || '', // Usar objectID de Algolia si no hay id
        userId: hit.userId || '',
        userName: hit.userName || '',
        userEmail: hit.userEmail || '',
        items: hit.items || [],
        totals: {
          itemCount: hit.totals?.itemCount || 0,
          subtotal: hit.totals?.subtotal || 0,
          taxAmount: hit.totals?.taxAmount || 0,
          taxPercentage: hit.totals?.taxPercentage || 0,
          shippingCost: hit.totals?.shippingCost || 0,
          total: hit.totals?.total || 0
        },
        status: hit.status || 'pending',
        deliveryMethod: hit.deliveryMethod || 'pickup',
        billingAddress: hit.billingAddress,
        shippingAddress: hit.shippingAddress,
        paymentMethod: hit.paymentMethod || '',
        notes: hit.notes || '',
        createdAt: hit.createdAt,
        updatedAt: hit.updatedAt
      }));

      return {
        orders,
        total: searchResults.nbHits,
        page: searchResults.page + 1, // Algolia usa 0-indexed, convertimos a 1-indexed
        pageSize: hitsPerPage,
        totalPages,
        hasMore: searchResults.page < searchResults.nbPages - 1
      };
    } catch (error) {
      console.error('Error searching orders in Algolia:', error);
      throw error;
    }
  }
}
