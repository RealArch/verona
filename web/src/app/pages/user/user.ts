import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MainFooterComponent } from '../../components/main-footer/main-footer.component';

@Component({
  selector: 'app-user',
  imports: [RouterOutlet, RouterLink, MainFooterComponent],
  templateUrl: './user.html',
  styleUrl: './user.scss'
})
export class User {

}
