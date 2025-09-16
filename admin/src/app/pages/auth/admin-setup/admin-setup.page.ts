import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonLabel, IonButton, IonInput, IonSpinner, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { personAddOutline, warningOutline } from 'ionicons/icons';

@Component({
  selector: 'app-admin-setup',
  templateUrl: './admin-setup.page.html',
  styleUrls: ['./admin-setup.page.scss'],
  standalone: true,
  imports: [IonToolbar, IonTitle, IonHeader, 
    IonSpinner, IonInput, IonButton, IonLabel, IonIcon,
    IonContent, CommonModule, ReactiveFormsModule,
  ]
})
export class AdminSetupPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  adminSetupForm!: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  constructor() {
    addIcons({ personAddOutline, warningOutline });
  }

  ngOnInit() {
    this.adminSetupForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async createAdmin() {
    if (this.adminSetupForm.invalid) {
      this.adminSetupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const userData = this.adminSetupForm.value;
      await this.authService.createAdminUser(userData);
      // Login after creating user to establish session
      await this.authService.login(userData.email, userData.password);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('Admin creation error:', error);
      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'Este email ya está registrado.';
      } else {
        this.errorMessage = 'Ocurrió un error al crear el usuario.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}