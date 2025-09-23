import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShoppingCartService } from '../../services/shopping-cart/shopping-cart';

@Component({
  selector: 'app-header-component',
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly router = inject(Router);
  shoppingCartService = inject(ShoppingCartService);
  cartItemsCount = this.shoppingCartService.cartSummary;

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
  }

  /**
   * Navigate to search page (for mobile button)
   */
  navigateToSearch(): void {
    this.router.navigate(['/search']);
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
}
