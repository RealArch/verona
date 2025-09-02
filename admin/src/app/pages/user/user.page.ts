import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonRouterOutlet, IonApp,
   IonSplitPane, IonList, IonItem, IonIcon, IonLabel,IonMenu, IonMenuToggle
   } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { cube, layers, logOut, speedometer } from 'ionicons/icons';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
  standalone: true,
  imports: [IonLabel, IonIcon, IonItem, IonList, IonSplitPane, IonApp,
     IonRouterOutlet, IonContent, IonHeader, IonTitle, IonToolbar,
      CommonModule, FormsModule, IonMenu, IonMenuToggle, RouterLink
    ]
})
export class UserPage implements OnInit {
  private authService = inject(AuthService);

  constructor() {
    addIcons({ speedometer, layers, logOut, cube });
  }

  async ngOnInit() {

  }


    async logout() {
    await this.authService.logout();
  }
}
