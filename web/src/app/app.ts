import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CategoriesService } from './services/categories/categories.service';
import { ShoppingCartService } from './services/shopping-cart/shopping-cart';

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
  
  constructor(){
    this.loadCategories();
    this.initializeShoppingCart();
  }
  
  loadCategories() {
    this.categoryService.loadCategories();
  }
  
  /**
   * Inicializa el servicio de shopping cart para que esté disponible 
   * desde el inicio de la aplicación
   */
  initializeShoppingCart() {
    // El servicio ya se inicializa automáticamente en su constructor,
    // pero al inyectarlo aquí nos aseguramos de que esté disponible
    // desde el primer render de la aplicación
    console.log('Shopping cart service initialized');
  }
}
