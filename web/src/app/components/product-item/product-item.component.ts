import { Component, inject, Input } from '@angular/core';
import { Product, ProductVariant } from '../../interfaces/products';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-product-item',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './product-item.component.html',
  styleUrl: './product-item.component.scss'
})
export class ProductItemComponent {
  //input
  @Input() product!: Product;
  //Injections
  router = inject(Router);

  ngOnInit(): void {
    // console.log(this.product);
  }
  
  navigateToProduct(product: Product): void {
 
  this.router.navigate(['/product', product.slug, product.objectID ?? product.id]);
  }

  toggleFavorite(productId: number): void {
    // console.log('Toggle favorite for product:', productId);
  }

  addToCart(productId: number): void {
    // console.log('Add to cart product:', productId);
  }
  getMinPrice(variants: ProductVariant[]): number {
    if (!variants || variants.length === 0) return 0;
    // Analiza todas las variantes y devuelve el precio mayor
    return Math.min(...variants.map(v => v.price ?? 0));
  }
}
