import { Component, OnInit, inject, signal, CUSTOM_ELEMENTS_SCHEMA, ElementRef, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CategoriesService } from '../../services/categories/categories.service';
import { Category } from '../../interfaces/categories';
import { register } from 'swiper/element/bundle';
import { Router } from '@angular/router';

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
  private readonly categoriesService = inject(CategoriesService);
  private readonly elementRef = inject(ElementRef);

  swiperVisible = signal(false);
  renderSwiper = signal(false);
  swiperReady = signal(false);
  
  allCategories = this.categoriesService.categories;
  loading = this.categoriesService.categoriesLoading;

  private swiperElement: any = null;
  private navigationInitialized = false;



  get mainCategories(): Category[] {
    const allCats = this.allCategories();
    return allCats?.filter(cat => cat.parentId === 'root') || [];
  }

  get shouldShowNav(): boolean {
    return this.mainCategories.length > this.getVisibleSlides();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.renderSwiper.set(true);
      requestAnimationFrame(() => this.swiperVisible.set(true));
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupSwiper();
    }
  }

  private setupSwiper(attempt = 0): void {
    const maxAttempts = 10;
    const swiperEl = this.elementRef.nativeElement.querySelector('swiper-container') as any;

    if (!swiperEl) {
      if (attempt < maxAttempts) {
        setTimeout(() => this.setupSwiper(attempt + 1), 100);
      }
      return;
    }

    // Esperar a que el swiper esté completamente inicializado
    if (!swiperEl.swiper) {
      if (attempt < maxAttempts) {
        setTimeout(() => this.setupSwiper(attempt + 1), 100);
      }
      return;
    }

    this.swiperElement = swiperEl;
    this.swiperReady.set(true);
    this.setupCustomNavigation();

    // Escuchar eventos del swiper para actualizar los botones
    swiperEl.swiper.on('slideChange', () => {
      this.updateButtonStates();
    });

    swiperEl.swiper.on('progress', () => {
      this.updateButtonStates();
    });

    // Actualizar estados iniciales
    setTimeout(() => this.updateButtonStates(), 100);
  }

  private setupCustomNavigation(): void {
    if (this.navigationInitialized) return;

    const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
    const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

    if (this.swiperElement && prevButton && nextButton) {
      prevButton.addEventListener('click', () => {
        this.swiperElement.swiper?.slidePrev();
        setTimeout(() => this.updateButtonStates(), 50);
      });
      
      nextButton.addEventListener('click', () => {
        this.swiperElement.swiper?.slideNext();
        setTimeout(() => this.updateButtonStates(), 50);
      });

      this.navigationInitialized = true;
    }
  }

  private updateButtonStates(): void {
    if (!this.swiperElement?.swiper) return;

    const swiper = this.swiperElement.swiper;
    const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
    const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

    if (prevButton && nextButton) {
      // Deshabilitar botón prev si estamos al inicio
      if (swiper.isBeginning) {
        prevButton.setAttribute('disabled', 'true');
      } else {
        prevButton.removeAttribute('disabled');
      }

      // Deshabilitar botón next si estamos al final
      if (swiper.isEnd) {
        nextButton.setAttribute('disabled', 'true');
      } else {
        nextButton.removeAttribute('disabled');
      }
    }
  }

  private getVisibleSlides(): number {
    if (!isPlatformBrowser(this.platformId)) return 6;
    const width = window.innerWidth;
    if (width >= 1280) return 10;
    if (width >= 1024) return 8;
    if (width >= 768) return 6;
    return width >= 640 ? 6 : 4;
  }

  goToCategorySearch(categoryId?: string): void {
    if (categoryId) {
      this.router.navigate(['/search'], { queryParams: { categoryIds: categoryId } });
    }
  }

  getImageUrl(category: Category): string {
    return category?.image?.url || '/img/no-image.svg';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/img/no-image.svg';
  }
}
