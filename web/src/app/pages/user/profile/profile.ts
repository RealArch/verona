import { Component } from '@angular/core';

// Interfaces para el perfil de usuario
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: Date;
  dni?: string;
  avatar?: string;
  memberSince: Date;
  isPremium: boolean;
}

export interface UserAddress {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

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
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile {

  // Usuario actual
  currentUser: UserProfile = {
    id: 'user-001',
    firstName: 'Rafael',
    lastName: 'Álvarez',
    email: 'rafael.alvarez@email.com',
    phone: '+51 987 654 321',
    birthDate: new Date('1990-05-15'),
    dni: '12345678',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    memberSince: new Date('2024-01-15'),
    isPremium: true
  };

  // Direcciones del usuario
  userAddresses: UserAddress[] = [
    {
      id: 'addr-001',
      label: 'Casa',
      name: 'Rafael Álvarez',
      street: 'Av. Larco 123, Miraflores',
      city: 'Lima',
      state: 'Lima',
      postalCode: '15074',
      country: 'Perú',
      phone: '+51 987 654 321',
      isDefault: true
    },
    {
      id: 'addr-002',
      label: 'Trabajo',
      name: 'Rafael Álvarez',
      street: 'Jr. De la Unión 456, Cercado de Lima',
      city: 'Lima',
      state: 'Lima',
      postalCode: '15001',
      country: 'Perú',
      phone: '+51 987 654 321',
      isDefault: false
    }
  ];

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
  
  // Stats del usuario
  userStats = {
    orders: 12,
    wishlist: 8,
    addresses: 3
  };

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
    console.log('Agregando nueva dirección');
    // Lógica para abrir modal de nueva dirección
  }

  editAddress(addressId: string) {
    console.log('Editando dirección:', addressId);
    // Lógica para editar dirección
  }

  deleteAddress(addressId: string) {
    console.log('Eliminando dirección:', addressId);
    // Lógica para eliminar dirección
    this.userAddresses = this.userAddresses.filter(addr => addr.id !== addressId);
  }

  setDefaultAddress(addressId: string) {
    // Cambiar dirección principal
    this.userAddresses.forEach(addr => {
      addr.isDefault = addr.id === addressId;
    });
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
    return `${this.currentUser.firstName} ${this.currentUser.lastName}`;
  }

  get memberDuration() {
    const now = new Date();
    const memberSince = new Date(this.currentUser.memberSince);
    const years = now.getFullYear() - memberSince.getFullYear();
    return years > 0 ? `${years} año${years > 1 ? 's' : ''}` : 'Menos de 1 año';
  }

  get defaultAddress() {
    return this.userAddresses.find(addr => addr.isDefault);
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
