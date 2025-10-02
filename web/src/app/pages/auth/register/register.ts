import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../../services/auth/auth.services';

@Component({
  selector: 'app-register',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  private authService = inject(Auth);
  private router = inject(Router);

  // Signals para el formulario
  firstName = signal('');
  lastName = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  acceptTerms = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Signals computados para validaciones
  passwordsMatch = computed(() => {
    const pass = this.password();
    const confirm = this.confirmPassword();
    return pass === confirm && pass.length > 0;
  });

  passwordStrength = computed(() => {
    const password = this.password();
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    return Math.min(strength, 4);
  });

  formIsValid = computed(() => {
    return this.firstName().trim() !== '' &&
           this.lastName().trim() !== '' &&
           this.email().trim() !== '' &&
           this.password().length >= 6 &&
           this.passwordsMatch() &&
           this.acceptTerms();
  });

  /**
   * Maneja el envío del formulario de registro
   */
  async onSubmit(): Promise<void> {
    if (!this.formIsValid()) {
      this.errorMessage.set('Por favor completa todos los campos correctamente');
      return;
    }

    if (!this.passwordsMatch()) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const credential = await this.authService.register(this.email(), this.password(), this.firstName(), this.lastName());
      
      // Opcional: Actualizar el perfil del usuario con nombre y apellido
      // await updateProfile(credential.user, {
      //   displayName: `${this.firstName()} ${this.lastName()}`
      // });

      this.successMessage.set('¡Cuenta creada exitosamente! Redirigiendo...');
      
      // Redirigir después de un breve delay
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);

    } catch (error: any) {
      this.handleRegisterError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Maneja los errores de registro
   */
  private handleRegisterError(error: any): void {
    // Normaliza el error a un mensaje amigable priorizando backend -> firebase -> genérico
    const backendMessage = error?.error?.message;
    const httpStatus = error?.status;
    const httpText = error?.statusText;
    const firebaseCode = error?.errorCode || error?.code;
    const genericMessage = error?.message;

    let message = 'Error al crear la cuenta';

    if (backendMessage) {
      message = backendMessage;
    } else if (httpStatus === 409 || httpText === 'Conflict') {
      message = 'Ya existe un usuario con este email';
    } else if (firebaseCode) {
      switch (firebaseCode) {
        case 'auth/email-already-in-use':
        case 'auth/email-already-exists':
          message = 'Este email ya está registrado. Intenta iniciar sesión en su lugar.';
          break;
        case 'auth/invalid-email':
          message = 'El email no es válido';
          break;
        case 'auth/operation-not-allowed':
          message = 'El registro con email/contraseña no está habilitado';
          break;
        case 'auth/weak-password':
          message = 'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
          break;
        default:
          message = genericMessage || 'Error desconocido al crear la cuenta';
      }
    } else if (genericMessage) {
      message = genericMessage;
    }

    this.errorMessage.set(message);
  }

  // Métodos para actualizar los signals
  onFirstNameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.firstName.set(target.value);
  }

  onLastNameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.lastName.set(target.value);
  }

  onEmailChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.email.set(target.value);
  }

  onPasswordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.password.set(target.value);
  }

  onConfirmPasswordChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.confirmPassword.set(target.value);
  }

  onTermsChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.acceptTerms.set(target.checked);
  }

  /**
   * Obtiene el color del indicador de fuerza de contraseña
   */
  getPasswordStrengthColor(index: number): string {
    const strength = this.passwordStrength();
    if (index < strength) {
      switch (strength) {
        case 1: return 'bg-red-500';
        case 2: return 'bg-orange-500';
        case 3: return 'bg-yellow-500';
        case 4: return 'bg-green-500';
        default: return 'bg-base-300';
      }
    }
    return 'bg-base-300';
  }


}
