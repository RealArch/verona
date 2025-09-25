import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../../services/auth/auth.services';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private authService = inject(Auth);

  // Signals para el formulario
  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  /**
   * Maneja el envío del formulario de login
   */
  async onSubmit(): Promise<void> {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Por favor completa todos los campos');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.login(this.email(), this.password());
      // La redirección se maneja automáticamente en el servicio
    } catch (error: any) {
      this.handleLoginError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Maneja los errores de login
   */
  private handleLoginError(error: any): void {
    let message = 'Error al iniciar sesión';
    
    // Verificar si es el error personalizado de admin
    if (error.message === 'ADMIN_LOGIN_NOT_ALLOWED') {
      message = 'No puedes iniciar sesión con este email. Esta cuenta está reservada para administradores.';
      this.errorMessage.set(message);
      return;
    }
    
    switch (error.code) {
      case 'auth/invalid-email':
        message = 'El email no es válido';
        break;
      case 'auth/user-disabled':
        message = 'Esta cuenta ha sido deshabilitada';
        break;
      case 'auth/user-not-found':
        message = 'Usuario no encontrado';
        break;
      case 'auth/wrong-password':
        message = 'Contraseña incorrecta';
        break;
      case 'auth/invalid-credential':
        message = 'Credenciales inválidas';
        break;
      default:
        message = error.message || 'Error desconocido';
    }
    
    this.errorMessage.set(message);
  }

  /**
   * Actualiza el valor del email
   */
  onEmailChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.email.set(target.value);
  }

  /**
   * Actualiza el valor de la contraseña
   */
  onPasswordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.password.set(target.value);
  }
}
