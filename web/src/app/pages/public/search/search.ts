import { Component, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../../../services/products/products.service';
import { Product } from '../../../interfaces/products';
import { Subject, takeUntil } from 'rxjs';
import { ProductItemComponent } from '../../../components/product-item/product-item.component';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SearchParams {
  q?: string;        // query text
  minPrice?: number; // minimum price
  maxPrice?: number; // maximum price
  page?: number;     // pagination
}

@Component({
  selector: 'app-search',
  imports: [ProductItemComponent, CurrencyPipe, FormsModule],
  templateUrl: './search.html',
  styleUrl: './search.scss'
})
export class Search implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsService = inject(ProductsService);
  private readonly destroy$ = new Subject<void>();

  // Signals for reactive state
  searchParams = signal<SearchParams>({});
  allProducts = signal<Product[]>([]);
  loading = signal<boolean>(false);
  loadingMore = signal<boolean>(false);
  error = signal<string | null>(null);
  hasMoreResults = signal<boolean>(true);
  totalResults = signal<number>(0);
  currentPage = signal<number>(0);

  // Filter form values
  tempMinPrice = signal<number>(0);
  tempMaxPrice = signal<number>(10000);

  // Default values
  private readonly defaultParams: Required<SearchParams> = {
    q: '',
    minPrice: 0,
    maxPrice: 10000,
    page: 0
  };

  ngOnInit(): void {
    // Listen to query params changes in real time
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const searchParams = this.parseSearchParams(params);
        this.searchParams.set(searchParams);
        this.resetAndSearch(searchParams);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Listen for scroll events for infinite scrolling
   */
  @HostListener('window:scroll')
  onScroll(): void {
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    // Load more when user is 200px from bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      this.loadMore();
    }
  }

  /**
   * Parse URL query parameters and apply defaults
   */
  private parseSearchParams(params: any): SearchParams {
    const parsedParams: SearchParams = {};

    // Parse query text
    if (params['q'] && typeof params['q'] === 'string') {
      parsedParams.q = params['q'].trim();
    }

    // Parse minimum price
    if (params['minPrice']) {
      const minPrice = parseFloat(params['minPrice']);
      if (!isNaN(minPrice) && minPrice >= 0) {
        parsedParams.minPrice = minPrice;
      }
    }

    // Parse maximum price
    if (params['maxPrice']) {
      const maxPrice = parseFloat(params['maxPrice']);
      if (!isNaN(maxPrice) && maxPrice > 0) {
        parsedParams.maxPrice = maxPrice;
      }
    }

    return parsedParams;
  }

  /**
   * Reset products and perform initial search
   */
  private async resetAndSearch(params: SearchParams): Promise<void> {
    this.allProducts.set([]);
    this.currentPage.set(0);
    this.hasMoreResults.set(true);
    
    // Update temp filter values
    this.tempMinPrice.set(params.minPrice ?? this.defaultParams.minPrice);
    this.tempMaxPrice.set(params.maxPrice ?? this.defaultParams.maxPrice);
    
    await this.performSearch(params, 0);
  }

  /**
   * Perform search with given parameters
   */
  private async performSearch(params: SearchParams, page: number = 0, append: boolean = false): Promise<void> {
    try {
      if (page === 0) {
        this.loading.set(true);
      } else {
        this.loadingMore.set(true);
      }
      
      this.error.set(null);

      // Use parsed params or defaults
      const searchQuery = params.q ?? this.defaultParams.q;
      const minPrice = params.minPrice ?? this.defaultParams.minPrice;
      const maxPrice = params.maxPrice ?? this.defaultParams.maxPrice;

      // Call the search service
      const results = await this.productsService.search(
        searchQuery,
        minPrice > 0 ? minPrice : undefined,
        maxPrice < this.defaultParams.maxPrice ? maxPrice : undefined,
        20, // hitsPerPage
        page
      );

      if (append && results.hits.length > 0) {
        // Append new results for infinite scroll, ensuring unique IDs
        const existingIds = new Set(this.allProducts().map(p => p.objectID || p.id));
        const newProducts = results.hits.filter(p => !existingIds.has(p.objectID || p.id));
        this.allProducts.set([...this.allProducts(), ...newProducts]);
      } else {
        // Replace all results for new search
        this.allProducts.set(results.hits);
      }

      this.totalResults.set(results.nbHits);
      this.currentPage.set(results.page);
      this.hasMoreResults.set(results.page < results.nbPages - 1);

    } catch (error) {
      console.error('Search error:', error);
      this.error.set('Error al realizar la búsqueda. Por favor intenta nuevamente.');
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  /**
   * Load more results for infinite scroll
   */
  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMoreResults() || this.loading()) {
      return;
    }

    const nextPage = this.currentPage() + 1;
    await this.performSearch(this.searchParams(), nextPage, true);
  }

  /**
   * Update URL with new search parameters
   */
  updateSearchParams(newParams: Partial<SearchParams>): void {
    const currentParams = this.searchParams();
    const updatedParams = { ...currentParams, ...newParams };

    // Remove empty or default values to keep URL clean
    const queryParams: any = {};

    if (updatedParams.q && updatedParams.q.trim()) {
      queryParams.q = updatedParams.q.trim();
    }

    if (updatedParams.minPrice && updatedParams.minPrice > 0) {
      queryParams.minPrice = updatedParams.minPrice;
    }

    if (updatedParams.maxPrice && updatedParams.maxPrice < this.defaultParams.maxPrice) {
      queryParams.maxPrice = updatedParams.maxPrice;
    }

    // Update URL which will trigger the search automatically
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'replace'
    });
  }

  /**
   * Apply price filter
   */
  applyPriceFilter(): void {
    this.updateSearchParams({ 
      minPrice: this.tempMinPrice(), 
      maxPrice: this.tempMaxPrice() 
    });
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.tempMinPrice.set(this.defaultParams.minPrice);
    this.tempMaxPrice.set(this.defaultParams.maxPrice);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: 'replace'
    });
  }

  /**
   * Update search query from input
   */
  updateSearchQuery(query: string): void {
    this.updateSearchParams({ q: query });
  }

  /**
   * Get current search query for display
   */
  getCurrentSearchQuery(): string {
    return this.searchParams().q || '';
  }
}
