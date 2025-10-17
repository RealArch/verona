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
  
  allCategories = this.categoriesService.categories;
  loading = this.categoriesService.categoriesLoading;



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
      this.setupCustomNavigation();
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

  private setupCustomNavigation(): void {
    setTimeout(() => {
      const swiperEl = this.elementRef.nativeElement.querySelector('swiper-container') as any;
      const prevButton = this.elementRef.nativeElement.querySelector('.swiper-button-prev-custom');
      const nextButton = this.elementRef.nativeElement.querySelector('.swiper-button-next-custom');

      if (swiperEl && prevButton && nextButton) {
        prevButton.addEventListener('click', () => swiperEl.swiper?.slidePrev());
        nextButton.addEventListener('click', () => swiperEl.swiper?.slideNext());
      }
    }, 100);
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
