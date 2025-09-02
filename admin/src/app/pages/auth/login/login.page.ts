import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
// Importa los módulos necesarios para Reactive Forms
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonCol, IonRow, IonCard, IonCardHeader, IonCardTitle, IonIcon, IonCardSubtitle, IonCardContent, IonItem, IonLabel, IonButton, IonText, IonInput } from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { lockClosed, warning } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonText, IonButton, IonLabel, IonItem, IonCardContent, IonCardSubtitle,
    IonIcon, IonCardTitle, IonCardHeader, IonCard, IonRow, IonCol, IonGrid,
    IonContent, IonHeader, IonTitle, IonToolbar, CommonModule,
    // Añade ReactiveFormsModule y quita FormsModule si ya no se usa en otro lugar del template
    ReactiveFormsModule,
    // IonInput no estaba en la lista de imports, pero es necesario para los inputs del formulario
    IonInput
  ]
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  // Inyecta FormBuilder
  private fb = inject(FormBuilder);

  // Define la propiedad del FormGroup
  loginForm!: FormGroup;
  errorMessage = '';

  constructor() {
    addIcons({ warning, lockClosed });

  }

  ngOnInit() {
    // Inicializa el formulario en ngOnInit
    this.loginForm = this.fb.group({
      // Define los form controls con su valor inicial y validadores
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  async login() {
    // Verifica si el formulario es inválido antes de continuar
    if (this.loginForm.invalid) {
      // Opcional: marcar todos los campos como "touched" para mostrar errores
      this.loginForm.markAllAsTouched();
      return;
    }

    try {
      // Obtiene los valores directamente desde el formulario
      const { email, password } = this.loginForm.value;
      await this.authService.login(email, password);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = 'Error al iniciar sesión. Verifique sus credenciales.';
    }
  }
}