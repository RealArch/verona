import { Component, OnInit, inject, signal, CUSTOM_ELEMENTS_SCHEMA, ElementRef, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CategoriesService } from '../../services/categories/categories.service';
import { Category } from '../../interfaces/categories';
import { register } from 'swiper/element/bundle';
import { Router } from '@angular/router';

// Register Swiper web components
register();

@Component({
  selector: 'app-categories-show',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './categories-show.html',
  styleUrl: './categories-show.scss'
})
export class CategoriesShow implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  /**
   * Devuelve el número de slides visibles según el ancho de pantalla
   */
  getVisibleSlides(): number {
    // SSR-safe: no window on server
    if (!isPlatformBrowser(this.platformId)) {
      return 6; // sensible default for prerender
    }
    const width = window.innerWidth;
    if (width >= 1280) return 10;
    if (width >= 1024) return 8;
    if (width >= 768) return 6;
    if (width >= 640) return 6;
    return 4;
  }

  /**
   * Determina si hay overflow y se deben mostrar los navegadores
   * Usa el signal de forma segura
   */
  shouldShowNav(): boolean {
    const categories = this.mainCategories;
    return categories && categories.length > this.getVisibleSlides();
  }

  /**
   * Get main categories (parentId === 'root') from all categories
   */
  get mainCategories(): Category[] {
    const allCats = this.allCategories();
    if (!allCats) return [];
    return allCats.filter(cat => cat.parentId === 'root');
  }
  // INJECTIONS
  private readonly categoriesService = inject(CategoriesService);
  private readonly elementRef = inject(ElementRef);

  // Signals
  swiperVisible = signal(false);
  renderSwiper = signal(false);
  
  // Computed signals from service
  allCategories = this.categoriesService.categories;
  loading = this.categoriesService.categoriesLoading;
  categoriesLoaded = this.categoriesService.categoriesLoaded;

  private swiperElement?: any;

  ngOnInit(): void {
    // Categories are loaded automatically by the service
    // Only show swiper in browser environment
    if (isPlatformBrowser(this.platformId)) {
      this.renderSwiper.set(true);
      requestAnimationFrame(() => {
        this.swiperVisible.set(true);
      });
    }
  }

  ngAfterViewInit(): void {
    // Setup custom navigation after view is initialized - only in browser
    if (isPlatformBrowser(this.platformId)) {
      this.setupCustomNavigation();
    }
  }

  /**
   * Setup custom navigation buttons for Swiper
   */
  private setupCustomNavigation(): void {
    setTimeout(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      
      const swiperEl = this.elementRef.nativeElement.querySelector('swiper-container');
      const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
      const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

      if (swiperEl && prevButton && nextButton) {
        this.swiperElement = swiperEl;

        // Navigation handlers
        prevButton.addEventListener('click', () => {
          if (swiperEl.swiper) {
            swiperEl.swiper.slidePrev();
          }
        });

        nextButton.addEventListener('click', () => {
          if (swiperEl.swiper) {
            swiperEl.swiper.slideNext();
          }
        });

        // Update button states on slide change
        swiperEl.addEventListener('slidechange', () => {
          this.updateNavigationButtons();
        });

        // Initial button state
        this.updateNavigationButtons();
      }
    }, 100);
  }
  goToCategorySearch(categoryId?: string): void {
    if (!categoryId) {
      return;
    }

    this.router.navigate(['/search'], {
      queryParams: { categoryIds: categoryId }
    });
  }

  /**
   * Update navigation button states based on swiper position
   */
  private updateNavigationButtons(): void {
    if (!isPlatformBrowser(this.platformId) || !this.swiperElement) return;

    const swiper = this.swiperElement.swiper;
    if (!swiper) return;

    const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
    const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

    if (prevButton && nextButton) {
      prevButton.disabled = swiper.isBeginning;
      nextButton.disabled = swiper.isEnd;
    }
  }

  /**
   * Refresh categories data
   * Can be called from template for manual refresh
   */
  async refreshCategories(): Promise<void> {
    await this.categoriesService.loadCategories();
  }

  /**
   * Handle image loading errors
   * Sets a fallback image when the category image fails to load
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = '/img/no-image.svg';
    console.error('Failed to load category image:', imgElement.getAttribute('data-original-src'));
  }

  /**
   * Get image URL safely from category data using the signal
   * Returns the category image URL or a default placeholder
   */
  getImageUrl(category: Category): string {
    if (!category?.image?.url) {
      return '/img/no-image.svg';
    }
    return category.image.url;
  }

  /**
   * Check if categories are loaded and available
   */
  get hasCategories(): boolean {
    const categories = this.mainCategories;
    return categories && categories.length > 0;
  }

  /**
   * Get categories safely from signal
   */
  get categories(): Category[] {
    return this.mainCategories || [];
  }
}
