import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-user',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './user.html',
  styleUrl: './user.scss'
})
export class User {

}
