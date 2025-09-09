import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../components/header.component/header.component';

@Component({
  selector: 'app-public',
  templateUrl: './public.html',
  styleUrl: './public.scss',
  imports: [RouterOutlet, HeaderComponent],
})
export class Public {

}
