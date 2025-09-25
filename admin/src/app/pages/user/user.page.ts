import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonRouterOutlet, IonApp,
   IonSplitPane, IonList, IonItem, IonIcon, IonLabel,IonMenu, IonMenuToggle, IonText } from '@ionic/angular/standalone';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { cube, layers, logOut, speedometer, card } from 'ionicons/icons';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
  standalone: true,
  imports: [IonText, IonLabel, IonIcon, IonItem, IonList, IonSplitPane, IonApp,
     IonRouterOutlet, IonContent, IonHeader, IonTitle, IonToolbar,
      CommonModule, FormsModule, IonMenu, IonMenuToggle, RouterLink, RouterLinkActive
    ]
})
export class UserPage implements OnInit {
  private authService = inject(AuthService);
  user: any = null;
  subscription?: Subscription;

  constructor(private router: Router) {
    addIcons({speedometer,cube,layers,card,logOut});
  }



  ngOnInit(): void {
    this.loadAdminUser();
  }

  async loadAdminUser() {
    this.user = await this.authService.getAdminUserData();
    console.log('Admin user data:', this.user);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getInitials(firstName?: string, lastName?: string): string {
    if (!firstName && !lastName) return '';
    const f = firstName ? firstName[0] : '';
    const l = lastName ? lastName[0] : '';
    return (f + l).toUpperCase();
  }

  async logout() {
    await this.authService.logout();
  }
}
