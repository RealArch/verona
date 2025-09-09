import { Component } from '@angular/core';
import { MainHeroComponent } from '../../../components/main-hero.component/main-hero.component';
import { HotItemsComponent } from '../../../components/hot-items/hot-items.component';
import { MainFooterComponent } from '../../../components/main-footer/main-footer.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  imports: [MainHeroComponent, HotItemsComponent, MainFooterComponent],

})
export class Home {

}
