import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-hot-items',
  imports: [],
  templateUrl: './hot-items.component.html',
  styleUrl: './hot-items.component.scss'
})
export class HotItemsComponent {

  constructor(private router: Router) {}

  navigateToProduct(productId: number): void {
    // Navegar a la página del producto
    this.router.navigate(['/product', productId]);
  }

  toggleFavorite(productId: number): void {
    // Lógica para agregar/quitar de favoritos
    console.log('Toggle favorite for product:', productId);
  }

  addToCart(productId: number): void {
    // Lógica para agregar al carrito
    console.log('Add to cart product:', productId);
  }

  viewAllProducts(): void {
    // Navegar a la página de todos los productos
    this.router.navigate(['/products']);
  }
}
