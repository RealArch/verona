import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShoppingCartService } from '../../services/shopping-cart/shopping-cart';

@Component({
  selector: 'app-header-component',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  shoppingCartService = inject(ShoppingCartService);
  cartItemsCount = this.shoppingCartService.cartSummary;

  
}
