import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CategoriesService } from './services/categories/categories.service';
import { ShoppingCartService } from './services/shopping-cart/shopping-cart';
import { Auth } from './services/auth/auth.services';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('web');
  categoryService = inject(CategoriesService);
  shoppingCartService = inject(ShoppingCartService);
  authService = inject(Auth);
  
  // Exponer el estado de inicialización de auth al template
  authInitialized = this.authService.authInitialized;
  
  constructor(){
    // Categories are now loaded automatically in the service constructor
    this.initializeShoppingCart();
  }
  
  /**
   * Inicializa el servicio de shopping cart para que esté disponible 
   * desde el inicio de la aplicación
   */
  initializeShoppingCart() {
    // El servicio ya se inicializa automáticamente en su constructor,
    // pero al inyectarlo aquí nos aseguramos de que esté disponible
    // desde el primer render de la aplicación
  }
}
