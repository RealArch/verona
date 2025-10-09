import { Component, OnInit, inject, signal, CUSTOM_ELEMENTS_SCHEMA, ElementRef, AfterViewInit } from '@angular/core';
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
  /**
   * Devuelve el número de slides visibles según el ancho de pantalla
   */
  getVisibleSlides(): number {
    const width = window.innerWidth;
    if (width >= 1280) return 10;
    if (width >= 1024) return 8;
    if (width >= 768) return 6;
    if (width >= 640) return 6;
    return 4;
  }

  /**
   * Determina si hay overflow y se deben mostrar los navegadores
   */
  shouldShowNav(): boolean {
    return this.mainCategories().length > this.getVisibleSlides();
  }
  // INJECTIONS
  private readonly categoriesService = inject(CategoriesService);
  private readonly elementRef = inject(ElementRef);

  // Signals
  mainCategories = signal<Category[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  private swiperElement?: any;

  ngOnInit(): void {
    this.loadMainCategories();
  }

  ngAfterViewInit(): void {
    // Setup custom navigation after view is initialized
    this.setupCustomNavigation();
  }

  /**
   * Setup custom navigation buttons for Swiper
   */
  private setupCustomNavigation(): void {
    setTimeout(() => {
      const swiperEl = this.elementRef.nativeElement.querySelector('swiper-container');
      const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
      const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

      if (swiperEl && prevButton && nextButton) {
        this.swiperElement = swiperEl;

        // Navigation handlers
        prevButton.addEventListener('click', () => {
          swiperEl.swiper.slidePrev();
        });

        nextButton.addEventListener('click', () => {
          swiperEl.swiper.slideNext();
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
    if (!this.swiperElement) return;

    const swiper = this.swiperElement.swiper;
    const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
    const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

    if (prevButton && nextButton) {
      prevButton.disabled = swiper.isBeginning;
      nextButton.disabled = swiper.isEnd;
    }
  }

  /**
   * Load all main categories from Algolia
   * Handles loading state and error management
   */
  async loadMainCategories(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const categories = await this.categoriesService.getAllMainCategories();
      this.mainCategories.set(categories);
      console.log(this.mainCategories())

    } catch (error) {
      this.error.set('Error al cargar las categorías principales');
      console.error('Failed to load main categories:', error);
      this.mainCategories.set([]);

    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refresh categories data
   * Can be called from template for manual refresh
   */
  async refreshCategories(): Promise<void> {
    await this.loadMainCategories();
  }
}
