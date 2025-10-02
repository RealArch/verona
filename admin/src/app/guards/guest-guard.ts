import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map, take } from 'rxjs/operators';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.user$.pipe(
    filter(user => user !== undefined), // Espera a que Firebase Auth se inicialice
    take(1), // Toma solo el primer valor después de la inicialización
    map(user => {
      if (!!user) {
        router.navigate(['/dashboard']);
        return false;
      }
      return true;
    })
  );
};