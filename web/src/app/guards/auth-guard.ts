import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth/auth.services';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Usar el signal computado para verificar autenticación
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
