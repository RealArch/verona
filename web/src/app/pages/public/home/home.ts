import { Component, OnInit, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { MainHeroComponent } from '../../../components/main-hero.component/main-hero.component';
import { HotItemsComponent } from '../../../components/hot-items/hot-items.component';
import { MainFooterComponent } from '../../../components/main-footer/main-footer.component';
import { CategoriesShow } from '../../../components/categories-show/categories-show';
import { LatestAdditionsComponent } from '../../../components/latest-additions/latest-additions.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  imports: [MainHeroComponent, HotItemsComponent, CategoriesShow, LatestAdditionsComponent],

})
export class Home implements OnInit {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  ngOnInit(): void {
    this.setupSEO();
  }

  private setupSEO(): void {
    const title = 'Verona - Tu Tienda Online en Venezuela';
    const description = 'Descubre los mejores productos en Verona. Compra online con envío a toda Venezuela. Ofertas exclusivas, productos de calidad y la mejor atención.';
    const url = 'https://verona-ffbcd.web.app';
    const image = 'https://verona-ffbcd.web.app/logos/logo.png';

    // Title
    this.titleService.setTitle(title);

    // Standard Meta Tags
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: 'tienda online venezuela, compras online, productos venezuela, ofertas, e-commerce venezuela' });
    this.metaService.updateTag({ name: 'author', content: 'Verona' });

    // Open Graph
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:image', content: image });
    this.metaService.updateTag({ property: 'og:image:alt', content: 'Logo de Verona' });
    this.metaService.updateTag({ property: 'og:url', content: url });
    this.metaService.updateTag({ property: 'og:site_name', content: 'Verona' });
    this.metaService.updateTag({ property: 'og:locale', content: 'es_VE' });

    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: image });
    this.metaService.updateTag({ name: 'twitter:image:alt', content: 'Logo de Verona' });

    // SEO
    this.metaService.updateTag({ name: 'robots', content: 'index, follow' });
    this.metaService.updateTag({ name: 'googlebot', content: 'index, follow' });
  }
}
