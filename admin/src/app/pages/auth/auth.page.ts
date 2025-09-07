import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: true,
  imports: [IonRouterOutlet, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class AuthPage implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  private authSubscription!: Subscription;
  hasAdminUsers = false;
  isCheckingAdmin = true;
  constructor() { }

  async ngOnInit() {
    console.log('UserPage initialized');
    // Verificar si hay usuarios administradores
    try {
      this.hasAdminUsers = await this.authService.hasAdminUsers();
      console.log('Has admin users:', this.hasAdminUsers);
      this.isCheckingAdmin = false;

      // Suscribirse a cambios de autenticación
      this.authSubscription = this.authService.user$.subscribe(user => {
        const currentUrl = this.router.url;
        if (user) {
          console.log(user)
          // Usuario autenticado
          if (currentUrl === '/login' || currentUrl === '/admin-setup' || currentUrl === '/') {
            this.router.navigate(['/dashboard']);
          }
        } else {
          // Usuario no autenticado
          if (this.hasAdminUsers) {
            this.router.navigate(['auth/login']);
          } else {
            this.router.navigate(['/auth/admin-setup']);
          }
        }
      });
    } catch (error) {
      console.error('Error checking admin users:', error);
      this.isCheckingAdmin = false;
    }
  }
  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}
