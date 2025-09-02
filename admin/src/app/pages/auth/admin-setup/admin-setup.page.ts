import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
// Importa los módulos necesarios para Reactive Forms
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonIcon, IonItem, IonLabel, IonButton } from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { personAdd, warning } from 'ionicons/icons';

@Component({
  selector: 'app-admin-setup',
  templateUrl: './admin-setup.page.html',
  styleUrls: ['./admin-setup.page.scss'],
  standalone: true,
  // Añade ReactiveFormsModule y quita FormsModule
  imports: [IonButton, IonLabel, IonItem, IonIcon, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, ReactiveFormsModule]
})
export class AdminSetupPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  // Inyecta FormBuilder
  private fb = inject(FormBuilder);

  // Define la propiedad del FormGroup
  adminSetupForm!: FormGroup;
  errorMessage = '';

  constructor() { 
    addIcons({personAdd,warning});
  }

  ngOnInit() {
    // Inicializa el formulario y sus controles con validadores
    this.adminSetupForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      // El placeholder sugería un mínimo de 6 caracteres, así que se añade el validador
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async createAdmin() {
    // Si el formulario es inválido, no se continúa
    if (this.adminSetupForm.invalid) {
      return;
    }

    try {
      // Obtenemos los valores directamente del formulario reactivo
      const userData = this.adminSetupForm.value;
      await this.authService.createAdminUser(userData);
      await this.authService.login(userData.email, userData.password);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = 'Error al crear usuario administrador';
    }
  }
}