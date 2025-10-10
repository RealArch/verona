import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../components/header.component/header.component';
import { MainFooterComponent } from '../../components/main-footer/main-footer.component';

@Component({
  selector: 'app-public',
  templateUrl: './public.html',
  styleUrl: './public.scss',
  imports: [RouterOutlet, HeaderComponent, MainFooterComponent],
})
export class Public {

}
