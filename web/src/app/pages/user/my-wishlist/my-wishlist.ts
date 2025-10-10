import { Component, OnInit, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-my-wishlist',
  imports: [],
  templateUrl: './my-wishlist.html',
  styleUrl: './my-wishlist.scss'
})
export class MyWishlist implements OnInit {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  ngOnInit(): void {
    this.setupSEO();
  }

  private setupSEO(): void {
    this.titleService.setTitle('Mi Lista de Deseos | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Consulta tus productos favoritos en Verona.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }
}
