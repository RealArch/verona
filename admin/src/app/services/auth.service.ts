import { Injectable, inject, Injector, runInInjectionContext, signal, computed } from '@angular/core';
import { Auth, authState, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { doc, Firestore, setDoc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom, map, Observable, take, filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AdminUser } from '../interfaces/users';



@Injectable({
  providedIn: 'root'
})

export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private http = inject(HttpClient);
  private injector = inject(Injector);
  private router = inject(Router);

  private _user$ = new BehaviorSubject<User | null | undefined>(undefined); // undefined = no inicializado
  user$ = this._user$.asObservable();

  // Signal para estado de autenticación
  private _isLoggedIn = signal<boolean>(false);
  isLoggedIn = this._isLoggedIn.asReadonly();

  constructor() {
    // Subscribe to the authState to keep the user$ BehaviorSubject updated
    authState(this.auth).subscribe(user => {
      this._user$.next(user); // user puede ser null (sin autenticar) o User (autenticado)
      this._isLoggedIn.set(!!user); // Actualiza el signal
    });
  }

  /**
   * Obtiene la data del AdminUser en Firestore usando el UID del usuario actualmente logueado.
   * @returns Promise<AdminUser | null>
   */
  getAdminUserData(): Promise<AdminUser | null> {
    return runInInjectionContext(this.injector, async () => {
      const user = this._user$.value;
      if (user) {
        const userDocRef = doc(this.firestore, `adminUsers/${user.uid}`);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          return userDocSnap.data() as AdminUser;
        }
      }
      return null;
    });
  }

  login(email: string, password: string): Promise<any> {
    return runInInjectionContext(this.injector, () =>
      signInWithEmailAndPassword(this.auth, email, password)
    );
  }

  logout(): Promise<void> {
    return runInInjectionContext(this.injector, () => signOut(this.auth));
  }

  createAdminUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      // Llamar a la función de Firebase para crear usuario admin de forma segura
      // Esta función debe estar implementada en tu backend
      await firstValueFrom(
        this.http.post(`${environment.api}/admin/createAdminUser`, userData)
      );
    });
  }

  async hasAdminUsers(): Promise<boolean> {
    return runInInjectionContext(this.injector, async () => {

      // Verificar si ya existen usuarios administradores
      const adminUsersRef = doc(this.firestore, 'metadata/counters');
      const snapshot = await getDoc(adminUsersRef);
      return snapshot.exists() && snapshot.data()['adminUsers'] > 0;
    })
  }

  async getCurrentUserData(): Promise<AdminUser | null> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return null;

    const userDoc = await getDoc(doc(this.firestore, `users/${currentUser.uid}`));
    return userDoc.exists() ? userDoc.data() as AdminUser : null;
  }
  isAuthenticated(): Observable<boolean> {
    return this.user$.pipe(
      filter(user => user !== undefined), // Espera a que se inicialice
      take(1), // Toma el primer valor válido
      map(user => !!user) // Convierte el objeto de usuario (o null) en un booleano
    );
  }
}