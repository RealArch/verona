import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { doc, Firestore, setDoc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface AdminUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

@Injectable({
  providedIn: 'root'
})

export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private http = inject(HttpClient);

  user$ = user(this.auth);

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async createAdminUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<void> {
    // Llamar a la función de Firebase para crear usuario admin de forma segura
    // Esta función debe estar implementada en tu backend
    await firstValueFrom(this.http.post('/api/createAdminUser', userData));
  }

  async hasAdminUsers(): Promise<boolean> {
    // Verificar si ya existen usuarios administradores
    const adminUsersRef = doc(this.firestore, 'metadata/adminUsers');
    const snapshot = await getDoc(adminUsersRef);
    return snapshot.exists() && snapshot.data()['count'] > 0;
  }

  async getCurrentUserData(): Promise<AdminUser | null> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return null;

    const userDoc = await getDoc(doc(this.firestore, `users/${currentUser.uid}`));
    return userDoc.exists() ? userDoc.data() as AdminUser : null;
  }
}