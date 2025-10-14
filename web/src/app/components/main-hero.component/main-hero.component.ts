import { Component, inject, computed } from '@angular/core';
import { SiteConfig } from '../../services/site-config/site-config';

@Component({
  selector: 'app-main-hero-component',
  imports: [],
  templateUrl: './main-hero.component.html',
  styleUrl: './main-hero.component.scss'
})
export class MainHeroComponent {
  private siteConfig = inject(SiteConfig);
  settingsSignal = this.siteConfig.storeSettings;

  heroImageLarge = computed(() => this.settingsSignal()?.headerImages?.largeScreen?.url || '/img/header_verona_1.webp');
  heroImageSmall = computed(() => this.settingsSignal()?.headerImages?.smallScreen?.url || '/img/header_verona_1_sm.webp');
}
