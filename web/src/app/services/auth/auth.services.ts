import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Auth as FirebaseAuth,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  UserCredential
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  DocumentData
} from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../../interfaces/auth';

// Interface para los datos del usuario en Firestore


@Injectable({
  providedIn: 'root'
})
export class Auth {
  private firebaseAuth = inject(FirebaseAuth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private http = inject(HttpClient);

  // Signal que mantiene el estado del usuario de Firebase Auth
  private userSignal = signal<User | null>(null);

  // Signal que mantiene los datos del usuario desde Firestore
  private userProfileSignal = signal<UserProfile | null>(null);

  // Signal computado para saber si está autenticado
  public isAuthenticated = computed(() => !!this.userSignal());

  // Getters para acceder a los datos desde cualquier componente
  public user = this.userSignal.asReadonly();
  public userProfile = this.userProfileSignal.asReadonly();

  // Listener de Firestore para el documento del usuario
  private unsubscribeUserProfile?: () => void;

  constructor() {
    // Inicializar el listener de cambios de autenticación
    this.initAuthListener();
  }

  /**
   * Limpia los listeners cuando el servicio se destruye
   */
  ngOnDestroy(): void {
    if (this.unsubscribeUserProfile) {
      this.unsubscribeUserProfile();
    }
  }

  /**
   * Inicializa el listener de Firebase Auth para mantener el signal actualizado
   */
  private initAuthListener(): void {
    onAuthStateChanged(this.firebaseAuth, (user) => {
      this.userSignal.set(user);

      if (user) {
        // Usuario logueado: escuchar cambios en su documento de Firestore
        this.listenToUserProfile(user.uid);
      } else {
        // Usuario deslogueado: limpiar datos y detener listener
        this.userProfileSignal.set(null);
        if (this.unsubscribeUserProfile) {
          this.unsubscribeUserProfile();
          this.unsubscribeUserProfile = undefined;
        }
      }
    });
  }

  /**
   * Escucha cambios en tiempo real del documento del usuario en Firestore
   */
  private listenToUserProfile(uid: string): void {
    // Detener listener anterior si existe
    if (this.unsubscribeUserProfile) {
      this.unsubscribeUserProfile();
    }

    const userDocRef = doc(this.firestore, 'users', uid);

    this.unsubscribeUserProfile = onSnapshot(userDocRef, (docSnapshot) => {
        const userData = docSnapshot.data() as UserProfile;
        this.userProfileSignal.set(userData);
   
    }, (error) => {
      console.error('Error listening to user profile:', error);
      this.userProfileSignal.set(null);
    });
  }

  /**
   * Crea un perfil del usuario con datos adicionales
   */


  /**
   * Actualiza el perfil del usuario en Firestore
   */
  async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
    const user = this.userSignal();
    if (!user) {
      throw new Error('No user is currently logged in');
    }

    try {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const updateData: Partial<UserProfile> = {
        ...updates,
        updatedAt: new Date()
      };
      await setDoc(userDocRef, updateData, { merge: true });
      console.log('User profile updated successfully');
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Obtiene el perfil del usuario actual desde Firestore (una sola vez)
   */
  async getUserProfile(): Promise<UserProfile | null> {
    const user = this.userSignal();
    if (!user) return null;

    try {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const docSnapshot = await getDoc(userDocRef);
      if (docSnapshot.exists()) {
        return docSnapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Inicia sesión with email y contraseña
   */
  async login(email: string, password: string): Promise<UserCredential> {
    try {
      const credential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);

      // Verificar si el usuario es admin
      const tokenResult = await credential.user.getIdTokenResult();
      const isAdmin = tokenResult.claims['admin'] === true;

      if (isAdmin) {
        // Si es admin, cerrar sesión inmediatamente y lanzar error
        await signOut(this.firebaseAuth);
        throw new Error('ADMIN_LOGIN_NOT_ALLOWED');
      }

      // Manejar redirección después del login
      this.handlePostLoginRedirect();

      return credential;
    } catch (error) {
      console.error('Error durante el login:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario a través de la API del servidor
   */
  async register(email: string, password: string, firstName: string, lastName: string): Promise<UserCredential> {
    try {
      // Datos para enviar al servidor
      const userData = {
        email,
        password,
        firstName,
        lastName,
      };

      // Llamar a la API del servidor para crear el usuario
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message?: string; uid?: string }>(
          `${environment.api}/auth/createUser`,
          userData
        )
      );

      if (!response?.success) {
        // Propagar el mensaje del backend si vino en la respuesta (caso poco común en 200 con success=false)
        throw { error: { message: response?.message || 'Error creating user on server' } };
      }

      // Una vez creado en el servidor, hacer login con Firebase Auth
      const credential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);

      // Manejar redirección después del login
      this.handlePostLoginRedirect();
      
      return credential;
    } catch (error: any) {
      console.error('Error durante el registro:', error);
      // No transformar el error: propágalo tal cual para que el componente pueda leer status y error.message
      throw error;
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.firebaseAuth);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error durante el logout:', error);
      throw error;
    }
  }

  /**
   * Verifica si el usuario actual es administrador
   */
  async isUserAdmin(): Promise<boolean> {
    const user = this.userSignal();
    if (!user) return false;

    try {
      const tokenResult = await user.getIdTokenResult();
      return tokenResult.claims['admin'] === true;
    } catch (error) {
      console.error('Error verificando claims de admin:', error);
      return false;
    }
  }

  /**
   * Maneja la redirección después del login
   */
  private handlePostLoginRedirect(): void {
    // Obtener la URL de retorno de los query params
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl') || '/';

    // Redirigir a la página original o al home
    this.router.navigateByUrl(returnUrl);
  }

  // /**
  //  * Observable para casos donde necesites usar RxJS
  //  */
  // loginObservable(email: string, password: string): Observable<UserCredential> {
  //   return from(this.login(email, password));
  // }

  // /**
  //  * Observable para logout
  //  */
  // logoutObservable(): Observable<void> {
  //   return from(this.logout());
  // }
}
