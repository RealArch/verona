import { Component, inject, OnInit } from '@angular/core';
import {
  IonApp, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle,
  IonContent, IonList, IonItem, IonLabel, IonIcon, IonMenu, IonMenuToggle
} from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { speedometer, layers, logOut, cube } from 'ionicons/icons';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonIcon, IonLabel, IonItem, IonList, IonContent, IonTitle, IonToolbar,
    IonHeader, IonSplitPane, IonApp, IonRouterOutlet, IonMenu, IonMenuToggle,
    RouterLink
  ],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  private authSubscription!: Subscription;
  hasAdminUsers = false;
  isCheckingAdmin = true;
  constructor() {
    addIcons({ speedometer, layers, logOut, cube });
  }

  async ngOnInit() {
    // Verificar si hay usuarios administradores
    // try {
    //   this.hasAdminUsers = await this.authService.hasAdminUsers();
    //   this.isCheckingAdmin = false;

    //   // Suscribirse a cambios de autenticación
    //   this.authSubscription = this.authService.user$.subscribe(user => {
    //     const currentUrl = this.router.url;
    //     if (user) {
    //       // Usuario autenticado
    //       if (currentUrl === '/login' || currentUrl === '/admin-setup' || currentUrl === '/') {
    //         this.router.navigate(['/dashboard']);
    //       }
    //     } else {
    //       // Usuario no autenticado
    //       if (this.hasAdminUsers) { 
    //         this.router.navigate(['/login']);
    //       } else {
    //         this.router.navigate(['/admin-setup']);
    //       }
    //     }
    //   });
    // } catch (error) {
    //   console.error('Error checking admin users:', error);
    //   this.isCheckingAdmin = false;
    // }
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  async logout() {
    await this.authService.logout();
  }

}
