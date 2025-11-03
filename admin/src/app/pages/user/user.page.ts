import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonRouterOutlet, IonApp, IonSplitPane, IonIcon, IonMenu, IonMenuToggle } from '@ionic/angular/standalone';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { cube, layers, logOut, speedometer, card, settings, receipt, chevronForward, gridOutline, cubeOutline, receiptOutline, settingsOutline, logOutOutline } from 'ionicons/icons';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
  standalone: true,
  imports: [IonIcon, IonSplitPane, IonApp, IonRouterOutlet, IonContent, CommonModule, FormsModule, IonMenu, IonMenuToggle, RouterLink, RouterLinkActive]
})
export class UserPage implements OnInit {
  private authService = inject(AuthService);
  user: any = null;
  subscription?: Subscription;
  version = environment.version;

  constructor(private router: Router) {
    addIcons({gridOutline,cubeOutline,receiptOutline,settingsOutline,logOutOutline,speedometer,chevronForward,cube,receipt,layers,settings,logOut,card});

    // Monitorea el estado de autenticación y redirige si no está logueado
    effect(() => {
      if (!this.authService.isLoggedIn()) {
        this.router.navigate(['/auth/login']);
      }
    });
  }



  ngOnInit(): void {
    this.loadAdminUser();
  }

  loadAdminUser() {
    this.subscription = this.authService.getAdminUserData$().subscribe(user => {
      this.user = user;
      console.log('Admin user data:', this.user);
    });
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
    // El effect se encargará de redirigir automáticamente
  }
}
