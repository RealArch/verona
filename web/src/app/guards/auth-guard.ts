import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth/auth.services';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Esperar a que Firebase Auth se inicialice
  await new Promise<void>((resolve) => {
    // Si ya está inicializado, resolver inmediatamente
    if (authService.authInitialized()) {
      resolve();
      return;
    }

    // Si no, esperar hasta que se inicialice (máximo 5 segundos)
    const timeout = setTimeout(() => {
      console.warn('Auth initialization timeout');
      resolve();
    }, 5000);

    const checkInterval = setInterval(() => {
      if (authService.authInitialized()) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve();
      }
    }, 50);
  });

  // Ahora verificar autenticación con el estado real
  if (authService.isAuthenticated()) {
    return true;
  }

  // Guardar la URL actual para redirigir después del login
  const returnUrl = state.url;
  
  // Redirigir al login con el parámetro returnUrl
  router.navigate(['/auth/login'], { 
    queryParams: { returnUrl: returnUrl } 
  });
  
  return false;
};
