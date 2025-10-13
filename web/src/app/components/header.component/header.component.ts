import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ShoppingCartService } from '../../services/shopping-cart/shopping-cart';
import { Auth } from '../../services/auth/auth.services';

@Component({
  selector: 'app-header-component',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(Auth);
  shoppingCartService = inject(ShoppingCartService);
  cartItemsCount = this.shoppingCartService.cartSummary;
  isMobileSearchActive = signal(false);

  @ViewChild('mobileSearchInput') mobileSearchInput?: ElementRef<HTMLInputElement>;

  // Auth signals - accessible throughout the component
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.user;
  userProfile = this.authService.userProfile

  // Search functionality
  searchQuery = signal<string>('');

  /**
   * Navigate to search page with query parameter
   */
  performSearch(): void {
    const query = this.searchQuery().trim();
    if (query) {
      this.router.navigate(['/search'], {
        queryParams: { q: query }
      });
    } else {
      // Navigate to search page without query (show all products)
      this.router.navigate(['/search']);
    }

    if (this.isMobileSearchActive()) {
      this.closeMobileSearch();
    }
  }

  /**
   * Handle search form submission
   */
  onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.performSearch();
  }

  /**
   * Handle search input changes
   */
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  /**
   * Handle Enter key press in search input
   */
  onSearchKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.performSearch();
    }
  }

  openMobileSearch(): void {
    this.isMobileSearchActive.set(true);
    setTimeout(() => {
      this.mobileSearchInput?.nativeElement.focus();
    }, 0);
  }

  closeMobileSearch(): void {
    this.isMobileSearchActive.set(false);
  }

  /**
   * Close dropdown by removing focus from element
   */
  closeDropdown(event: Event): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.dropdown');
    if (dropdown) {
      const trigger = dropdown.querySelector('[tabindex="0"]') as HTMLElement;
      if (trigger) {
        trigger.blur();
      }
    }
  }

  /**
   * Close dropdown and navigate (for cart buttons)
   */
  closeDropdownAndNavigate(route: string): void {
    // Close dropdown first
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.blur();
      }
    }, 100);
    
    // Then navigate
    this.router.navigate([route]);
  }

  /**
   * Close dropdown and perform action (for user menu)
   */
  closeDropdownAndAction(action?: () => void): void {
    // Close dropdown first
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.blur();
      }
    }, 100);
    
    // Then perform action if provided
    if (action) {
      action();
    }
  }

  /**
   * Handle user logout
   */
  async logout(): Promise<void> {
    try {
      
      await this.authService.logout();
      this.closeDropdownAndAction()
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Navigate to login page
   */
  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /**
   * Navigate to register page
   */
  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  /**
   * Get user display name or email
   */
  getUserDisplayName(): string {
    const user = this.currentUser();
    if (!user) return '';
    return user.displayName || user.email || 'Usuario';
  }
}
