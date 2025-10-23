import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, filter } from 'rxjs';
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
  updateDoc,
  arrayUnion,
  runTransaction
} from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';
import { UserProfile, UserAddress } from '../../interfaces/auth';

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

  // Signal para controlar si Firebase Auth ya se inicializó
  private authInitialized = signal(false);
  
  // Almacena la URL anterior para redirección después del login
  private previousUrl: string | null = null;

  // Signal computado para saber si está autenticado
  public isAuthenticated = computed(() => {
    // Si no se ha inicializado Firebase Auth, asumir que está autenticado temporalmente
    if (!this.authInitialized()) {
      return true;
    }
    // Una vez inicializado, usar el estado real del usuario
    return !!this.userSignal();
  });

  // Getters para acceder a los datos desde cualquier componente
  public user = this.userSignal.asReadonly();
  public userProfile = this.userProfileSignal.asReadonly();

  // Signal computado para las iniciales del usuario
  public userInitials = computed(() => {
    const profile = this.userProfileSignal();
    if (!profile) return '';
    const first = profile.firstName?.trim()[0] || '';
    const last = profile.lastName?.trim()[0] || '';
    return (first + last).toUpperCase();
  });

  // Listener de Firestore para el documento del usuario
  private unsubscribeUserProfile?: () => void;

  constructor() {
    // Inicializar el listener de cambios de autenticación
    this.initAuthListener();
    
    // Trackear la navegación para capturar la URL anterior
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const currentUrl = event.urlAfterRedirects;
      
      // Si el usuario navega a una página de auth, guardar la URL anterior
      // (a menos que la URL anterior también sea de auth)
      if (currentUrl.includes('/auth/')) {
        // Solo guardar si previousUrl no es null y no es de auth
        if (this.previousUrl && !this.previousUrl.includes('/auth/')) {
          // Ya está guardada, no hacer nada
        }
      } else {
        // Si no es una página de auth, actualizar previousUrl
        this.previousUrl = currentUrl;
      }
    });
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
      // Marcar como inicializado al recibir el primer evento
      this.authInitialized.set(true);
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
  async login(email: string, password: string, returnUrl?: string): Promise<UserCredential> {
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
      this.handlePostLoginRedirect(returnUrl);

      return credential;
    } catch (error) {
      console.error('Error durante el login:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo usuario a través de la API del servidor
   */
  async register(email: string, password: string, firstName: string, lastName: string, phoneNumber: string, returnUrl?: string): Promise<UserCredential> {
    try {
      // Datos para enviar al servidor
      const userData = {
        email,
        password,
        firstName,
        lastName,
        phoneNumber
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
      this.handlePostLoginRedirect(returnUrl);
      
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
   * Agrega una nueva dirección al perfil del usuario
   */
  async addUserAddress(addressData: Omit<UserAddress, 'id'>, isDefault: boolean = false): Promise<void> {
    const user = this.userSignal();
    if (!user) {
      throw new Error('No user is currently logged in');
    }

    // Generar ID único para la nueva dirección
    const addressId = `addr-${Date.now()}`;

    // Crear el objeto de dirección completa
    const newAddress: UserAddress = {
      id: addressId,
      ...addressData
    };

    const userDocRef = doc(this.firestore, 'users', user.uid);

    if (isDefault) {
      // Si debe ser dirección principal, obtener direcciones actuales e insertar al principio
      const userProfile = await this.getUserProfile();
      const currentAddresses = userProfile?.addresses || [];

      // Insertar la nueva dirección al principio del array
      const updatedAddresses = [newAddress, ...currentAddresses];

      // Actualizar todo el array de direcciones
      return updateDoc(userDocRef, {
        addresses: updatedAddresses,
        updatedAt: new Date()
      });
    } else {
      // Si no es principal, añadir al final usando arrayUnion
      return updateDoc(userDocRef, {
        addresses: arrayUnion(newAddress),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Actualiza una dirección existente del usuario
   */
  async updateUserAddress(addressId: string, addressData: Omit<UserAddress, 'id'>, isDefault: boolean = false): Promise<void> {
    const user = this.userSignal();
    if (!user) {
      throw new Error('No user is currently logged in');
    }

    const userDocRef = doc(this.firestore, 'users', user.uid);

    try {
      await runTransaction(this.firestore, async (transaction) => {
        // Obtener el documento actual
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) {
          throw new Error('User profile not found');
        }

        const userProfile = userDoc.data() as UserProfile;
        if (!userProfile.addresses) {
          throw new Error('No addresses found');
        }

        // Encontrar y actualizar la dirección
        const updatedAddresses = userProfile.addresses.map(address => {
          if (address.id === addressId) {
            return {
              ...address,
              ...addressData
            };
          }
          return address;
        });

        // Verificar que se encontró la dirección
        const addressFound = updatedAddresses.some(address => address.id === addressId);
        if (!addressFound) {
          throw new Error('Address not found');
        }

        // Si debe ser dirección principal, moverla al principio
        if (isDefault) {
          const addressIndex = updatedAddresses.findIndex(addr => addr.id === addressId);
          if (addressIndex > 0) {
            const [address] = updatedAddresses.splice(addressIndex, 1);
            updatedAddresses.unshift(address);
          }
        }

        // Actualizar el documento con las direcciones modificadas
        transaction.update(userDocRef, {
          addresses: updatedAddresses,
          updatedAt: new Date()
        });
      });
    } catch (error) {
      console.error('Error updating user address:', error);
      throw error;
    }
  }

  /**
   * Establece manualmente la URL de retorno para la redirección post-login
   */
  public setReturnUrl(url: string): void {
    this.previousUrl = url;
  }

  /**
   * Maneja la redirección después del login
   */
  private handlePostLoginRedirect(returnUrl?: string): void {
    // Prioridad de redirección:
    // 1. returnUrl proporcionado explícitamente
    // 2. returnUrl de query params
    // 3. URL anterior capturada automáticamente
    // 4. Home por defecto
    
    let redirectUrl = returnUrl;
    
    if (!redirectUrl) {
      const urlParams = new URLSearchParams(window.location.search);
      redirectUrl = urlParams.get('returnUrl') || undefined;
    }
    
    if (!redirectUrl && this.previousUrl) {
      redirectUrl = this.previousUrl;
      console.log('Usando URL anterior capturada:', redirectUrl);
    }
    
    if (!redirectUrl) {
      redirectUrl = '/';
    }

    // Limpiar la URL anterior después de usarla
    this.previousUrl = null;
    
    // Redirigir a la página correspondiente
    this.router.navigateByUrl(redirectUrl);
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
