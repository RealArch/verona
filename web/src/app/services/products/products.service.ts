import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, query, orderBy, limit, collectionData, doc, docData, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { algoliasearch, SearchClient } from 'algoliasearch';
import { environment } from '../../../environments/environment.development';
import { Product } from '../../interfaces/products';
import { CategoriesService } from '../categories/categories.service';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private injector = inject(Injector);
  private firestore = inject(Firestore);
  private categoriesService = inject(CategoriesService);
  readonly productsRef = collection(this.firestore, 'products');
  private client: SearchClient;
  private readonly indexName = environment.algolia.indexes.products;


  constructor() {
    this.client = algoliasearch(
      environment.algolia.appId,
      environment.algolia.apiKey
    );
  }
  /**
   * Get best sellers products in real-time from Firestore`
   * @param limitCount Number of products to retrieve
   * @returns Observable with real-time best sellers data
   */

  getProduct(uid: string) {
    return runInInjectionContext(this.injector, async () => {
      const productDocRef = doc(this.firestore, 'products', uid);
      return docData(productDocRef, { idField: 'id' }) as Observable<Product | null>;

    });
  }

  getBestSellers(limitCount: number): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const firestore = inject(Firestore);

      const bestSellersQuery = query(
        this.productsRef,
        orderBy('totalSales', 'desc'),
        where('status', '==', 'active'),
        limit(limitCount)
      );

      return collectionData(bestSellersQuery, {
        idField: 'id'
      }) as Observable<Product[]>;
    });
  }

  getLatestAdditions(limitCount: number): Observable<Product[]> {
    return runInInjectionContext(this.injector, () => {
      const firestore = inject(Firestore);

      const latestQuery = query(
        this.productsRef,
        orderBy('createdAt', 'desc'),
        where('status', '==', 'active'),
        limit(limitCount)
      );

      return collectionData(latestQuery, {
        idField: 'id'
      }) as Observable<Product[]>;
    });
  }
  /**
   * Search products in Algolia with filters
   * @param searchQuery String to search for in product names and descriptions
   * @param minPrice Minimum price filter (optional)
   * @param maxPrice Maximum price filter (optional)
   * @param hitsPerPage Number of results per page (default: 20)
   * @param page Page number for pagination (default: 0)
   * @returns Promise with search results
   */
  async search(
    searchQuery: string = '',
    minPrice?: number,
    maxPrice?: number,
    categoryIds?: string[],
    hitsPerPage: number = 20,
    page: number = 0
  ): Promise<{ 
    hits: Product[]; 
    nbHits: number; 
    page: number; 
    nbPages: number;
    categoryFacets?: Record<string, number>;
  }> {
    try {
      // Build filters array
      const filters: string[] = [];
      
      // Expand categoryIds to include all descendants
      let expandedCategoryIds: string[] = [];
      if (categoryIds && categoryIds.length > 0) {
        // For each provided category, get all its descendants
        const allDescendants = categoryIds.flatMap(categoryId => 
          this.categoriesService.getAllDescendantIds(categoryId)
        );
        // Remove duplicates
        expandedCategoryIds = [...new Set(allDescendants)];
      }
      
      
      // Add price range filters if provided
      if (minPrice !== undefined && maxPrice !== undefined) {
        filters.push(`minPrice:${minPrice} TO ${maxPrice}`);
      } else if (minPrice !== undefined) {
        filters.push(`minPrice >= ${minPrice}`);
      } else if (maxPrice !== undefined) {
        filters.push(`minPrice <= ${maxPrice}`);
      }

      // Add status filter to only show active products
      filters.push('status:active');

      // Add categoryId filter if provided (using expanded list)
      if (expandedCategoryIds && expandedCategoryIds.length > 0) {
        const categoriesFilter = expandedCategoryIds.map(id => `categoryId:'${id}'`).join(' OR ');
        filters.push(`(${categoriesFilter})`);
      }

      const index = this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query: searchQuery,
          hitsPerPage: hitsPerPage,
          page: page,
          filters: filters.length > 0 ? filters.join(' AND ') : undefined,
          // Solicitar facets para categorías
          facets: ['categoryId'],
          maxValuesPerFacet: 100,
          // attributesToRetrieve: [
          //   'objectID',
          //   'name',
          //   'description',
          //   'price',
          //   'images',
          //   'category',
          //   'categoryId',
          //   'status',
          //   'stock',
          //   'sku',
          //   'variants',
          //   'slug',
          //   'totalSales'
          // ],
          // // Configure search settings
          // typoTolerance: true,
          // ignorePlurals: true,
          // removeStopWords: true,
          // // Highlight matching terms
          // attributesToHighlight: ['name', 'description'],
          // highlightPreTag: '<mark>',
          // highlightPostTag: '</mark>'
        }
      });

      const response = await index;

      return {
        hits: response.hits as Product[],
        nbHits: response.nbHits ?? 0,
        page: response.page ?? 0,
        nbPages: response.nbPages ?? 0,
        categoryFacets: response.facets?.['categoryId'] as Record<string, number> | undefined
      };

    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
}



