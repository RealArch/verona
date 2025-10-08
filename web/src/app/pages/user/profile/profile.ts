import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../../services/auth/auth.services';
import { UserProfile, UserAddress } from '../../../interfaces/auth';
import { AddAddress } from '../../../components/user/add-address/add-address';

export interface UserActivity {
  id: string;
  type: 'order' | 'wishlist' | 'profile' | 'payment';
  title: string;
  description: string;
  date: Date;
  amount?: number;
  status?: 'success' | 'warning' | 'error';
}

export interface UserPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  newsletter: boolean;
  twoFactorAuth: boolean;
}

@Component({
  selector: 'app-profile',
  imports: [CommonModule, AddAddress],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile {

  private auth = inject(Auth);

  // Expose user initials from auth service
  userInitials = this.auth.userInitials;
  // Usuario actual desde auth service
  currentUser = computed(() => this.auth.userProfile() || {} as UserProfile);

  // Direcciones del usuario desde auth service
  userAddresses = computed(() => {
    const user = this.currentUser();
    return user.addresses || [];
  });

  // Actividad reciente
  recentActivity: UserActivity[] = [
    {
      id: 'act-001',
      type: 'order',
      title: 'Pedido completado',
      description: 'Sofá Mediterráneo - Pedido #VR-2024-001',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 días atrás
      amount: 2890,
      status: 'success'
    },
    {
      id: 'act-002',
      type: 'wishlist',
      title: 'Agregado a favoritos',
      description: 'Mesa de Centro Oslo',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás
      status: 'success'
    },
    {
      id: 'act-003',
      type: 'profile',
      title: 'Información actualizada',
      description: 'Datos personales modificados',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 semana atrás
      status: 'warning'
    }
  ];

  // Preferencias del usuario
  userPreferences: UserPreferences = {
    emailNotifications: true,
    smsNotifications: false,
    newsletter: true,
    twoFactorAuth: false
  };

  // Estados del componente
  activeSection: string = 'personal';
  isEditingProfile: boolean = false;
  showAddAddressModal: boolean = false;
  
  // Stats del usuario - calculados dinámicamente
  userStats = computed(() => {
    const user = this.currentUser();
    return {
      orders: user.counters?.purchases || 0,
      wishlist: user.counters?.wishlist || 0,
      addresses: this.userAddresses().length
    };
  });

  constructor() {
    // Inicialización del componente
  }

  // Métodos para manejar las acciones
  editProfile() {
    this.isEditingProfile = !this.isEditingProfile;
  }

  saveProfile() {
    // Lógica para guardar el perfil
    console.log('Guardando perfil:', this.currentUser);
    this.isEditingProfile = false;
    // Aquí iría la llamada al servicio para actualizar el perfil
  }

  addNewAddress() {
    this.showAddAddressModal = true;
  }

  closeAddAddressModal() {
    this.showAddAddressModal = false;
  }

  editAddress(addressId: string) {
    console.log('Editando dirección:', addressId);
    // Lógica para editar dirección
  }

  deleteAddress(addressId: string) {
    console.log('Eliminando dirección:', addressId);
    // TODO: Implementar eliminación de dirección en auth service
    // Por ahora solo log
  }

  setDefaultAddress(addressId: string) {
    // Con el nuevo sistema, la dirección principal es simplemente la primera del array
    alert('La dirección principal es la primera que registraste. Para cambiarla, elimina otras direcciones o registra una nueva.');
  }

  updatePreference(key: keyof UserPreferences, value: boolean) {
    this.userPreferences[key] = value;
    console.log('Actualizando preferencia:', key, value);
    // Aquí iría la lógica para guardar las preferencias
  }

  changePassword() {
    console.log('Cambiando contraseña');
    // Lógica para cambio de contraseña
  }

  setupTwoFactor() {
    console.log('Configurando autenticación en dos pasos');
    // Lógica para 2FA
  }

  deleteAccount() {
    console.log('Eliminando cuenta');
    // Lógica para eliminar cuenta (con confirmación)
    if (confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) {
      // Proceder con eliminación
    }
  }

  navigateToSection(section: string) {
    this.activeSection = section;
  }

  uploadAvatar() {
    console.log('Subiendo avatar');
    // Lógica para subir nueva imagen de avatar
  }

    // Getters para facilitar el uso en el template
  get fullName() {
    const user = this.currentUser();
    return user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
  }

  get memberDuration() {
    const now = new Date();
    const user = this.currentUser();
    const memberSince = user.createdAt ? new Date(user.createdAt) : now;
    const years = now.getFullYear() - memberSince.getFullYear();
    return years > 0 ? `${years} año${years > 1 ? 's' : ''}` : 'Menos de 1 año';
  }

  get defaultAddress() {
    const addresses = this.userAddresses();
    return addresses.length > 0 ? addresses[0] : null;
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.ceil(diffDays / 7)} semana${Math.ceil(diffDays / 7) > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-PE');
  }
}
