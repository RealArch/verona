import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonToggle, IonButtons, IonMenuButton, IonListHeader, IonGrid, IonIcon, IonPopover, IonButton, IonInput, IonSpinner, IonImg, ModalController, IonAvatar, IonChip, IonModal } from '@ionic/angular/standalone';
import { SettingsService } from 'src/app/services/settings.service';
import { Popups } from 'src/app/services/popups';
import { AuthService } from 'src/app/services/auth.service';
import { addIcons } from 'ionicons';
import { home, bicycle, airplane, chatbubbles, calculator, createOutline, imageOutline, trashOutline, personAddOutline, closeOutline, checkmarkOutline } from 'ionicons/icons';
import { MainHeaderImagesPage } from './main-header-images/main-header-images.page';
import { AdminUser } from 'src/app/interfaces/users';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonInput, IonButton, IonPopover, IonLabel, IonIcon, IonGrid, IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonList, IonToggle, IonButtons, IonMenuButton, IonAvatar, IonChip, IonModal, CommonModule, FormsModule, ReactiveFormsModule]
})
export class SettingsPage implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);
  private popups = inject(Popups);
  private modalController = inject(ModalController);
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);

  // Signals para todos los settings
  storeEnabled = computed(() => this.settingsService.storeEnabled());
  pickupEnabled = computed(() => this.settingsService.pickupEnabled());
  deliveryEnabled = computed(() => this.settingsService.deliveryEnabled());
  shippingEnabled = computed(() => this.settingsService.shippingEnabled());
  arrangeWithSellerEnabled = computed(() => this.settingsService.arrangeWithSellerEnabled());
  taxPercentage = computed(() => this.settingsService.taxPercentage());

  // Popover state
  isTaxPopoverOpen = false;
  tempTaxPercentage: number = 0;

  // Admin users management
  adminUsers = signal<AdminUser[]>([]);
  currentUserUid: string = '';
  private adminUsersSubscription: Subscription | null = null;
  private currentUserSubscription: Subscription | null = null;

  // Modal state for creating new admin user
  isCreateUserModalOpen = false;
  newUserForm!: FormGroup;

  constructor() {
    addIcons({ home, bicycle, airplane, chatbubbles, calculator, createOutline, imageOutline, trashOutline, personAddOutline, closeOutline, checkmarkOutline });
  }

  ngOnInit() {
    this.loadCurrentUser();
    this.loadAdminUsers();
    this.initNewUserForm();
    this.subscribeToCurrentUser();
  }

  initNewUserForm() {
    this.newUserForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnDestroy() {
    if (this.adminUsersSubscription) {
      this.adminUsersSubscription.unsubscribe();
    }
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
  }

  async loadCurrentUser() {
    const user = await this.authService.getAdminUserData();
    if (user) {
      this.currentUserUid = user.uid;
    }
  }

  subscribeToCurrentUser() {
    this.currentUserSubscription = this.authService.user$.subscribe(async () => {
      await this.loadCurrentUser();
    });
  }

  loadAdminUsers() {
    this.adminUsersSubscription = this.authService.getAllAdminUsers().subscribe(users => {
      this.adminUsers.set(users);
    });
  }

  openTaxPopover(event: any) {
    this.tempTaxPercentage = this.taxPercentage();
    this.isTaxPopoverOpen = true;
  }

  closeTaxPopover() {
    this.isTaxPopoverOpen = false;
  }

  async saveTaxPercentage() {
    if (this.tempTaxPercentage < 0 || this.tempTaxPercentage > 100) {
      await this.popups.presentToast('bottom', 'warning', 'El porcentaje debe estar entre 0 y 100');
      return;
    }

    try {
      await this.settingsService.setTaxPercentage(this.tempTaxPercentage);
      await this.popups.presentToast('bottom', 'success', 'Porcentaje de impuesto actualizado correctamente');
      this.closeTaxPopover();
    } catch (error) {
      await this.popups.presentToast('bottom', 'danger', 'Error al guardar el porcentaje de impuesto');
    }
  }

  async onToggleChange(event: any) {
    const enabled = event.detail.checked;
    const action = enabled ? 'habilitar' : 'deshabilitar';
    const consequence = enabled
      ? 'Los clientes podrán comprar productos directamente usando los métodos de pago registrados.'
      : 'Los clientes solo podrán solicitar cotizaciones. No podrán comprar directamente.';

    const confirmed = await this.popups.confirm(
      `¿${action.charAt(0).toUpperCase() + action.slice(1)} ventas en tienda?`,
      `Al ${action} las ventas, ${consequence}`,
      'Sí, confirmar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.settingsService.setStoreEnabled(enabled);
      } catch (error) {
        await this.popups.presentToast('bottom', 'danger', 'Error al guardar la configuración');
        event.target.checked = !enabled;
      }
    } else {
      event.target.checked = !enabled;
    }
  }

  async onPickupToggleChange(event: any) {
    const enabled = event.detail.checked;
    const confirmed = await this.popups.confirm(
      `¿${enabled ? 'Habilitar' : 'Deshabilitar'} retiro en persona?`,
      enabled
        ? 'Los clientes podrán seleccionar retiro en persona como método de entrega.'
        : 'Los clientes no podrán seleccionar retiro en persona.',
      'Sí, confirmar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.settingsService.setPickupEnabled(enabled);
      } catch (error) {
        await this.popups.presentToast('bottom', 'danger', 'Error al guardar la configuración');
        event.target.checked = !enabled;
      }
    } else {
      event.target.checked = !enabled;
    }
  }

  async onDeliveryToggleChange(event: any) {
    const enabled = event.detail.checked;
    const confirmed = await this.popups.confirm(
      `¿${enabled ? 'Habilitar' : 'Deshabilitar'} delivery?`,
      enabled
        ? 'Los clientes podrán seleccionar delivery como método de entrega.'
        : 'Los clientes no podrán seleccionar delivery.',
      'Sí, confirmar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.settingsService.setDeliveryEnabled(enabled);
      } catch (error) {
        await this.popups.presentToast('bottom', 'danger', 'Error al guardar la configuración');
        event.target.checked = !enabled;
      }
    } else {
      event.target.checked = !enabled;
    }
  }

  async onShippingToggleChange(event: any) {
    const enabled = event.detail.checked;
    const confirmed = await this.popups.confirm(
      `¿${enabled ? 'Habilitar' : 'Deshabilitar'} envío?`,
      enabled
        ? 'Los clientes podrán seleccionar envío como método de entrega.'
        : 'Los clientes no podrán seleccionar envío.',
      'Sí, confirmar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.settingsService.setShippingEnabled(enabled);
      } catch (error) {
        await this.popups.presentToast('bottom', 'danger', 'Error al guardar la configuración');
        event.target.checked = !enabled;
      }
    } else {
      event.target.checked = !enabled;
    }
  }

  async onArrangeWithSellerToggleChange(event: any) {
    const enabled = event.detail.checked;
    const confirmed = await this.popups.confirm(
      `¿${enabled ? 'Habilitar' : 'Deshabilitar'} acordar con el vendedor?`,
      enabled
        ? 'Los clientes podrán seleccionar acordar los detalles de entrega directamente con el vendedor.'
        : 'Los clientes no podrán seleccionar esta opción.',
      'Sí, confirmar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.settingsService.setArrangeWithSellerEnabled(enabled);
      } catch (error) {
        await this.popups.presentToast('bottom', 'danger', 'Error al guardar la configuración');
        event.target.checked = !enabled;
      }
    } else {
      event.target.checked = !enabled;
    }
  }

  async openHeaderImagesModal() {
    const modal = await this.modalController.create({
      component: MainHeaderImagesPage
    });
    await modal.present();
  }

  // Admin users management functions
  openCreateUserModal() {
    this.isCreateUserModalOpen = true;
    this.newUserForm.reset();
  }

  closeCreateUserModal() {
    this.isCreateUserModalOpen = false;
    this.newUserForm.reset();
  }

  async createAdminUser() {
    if (this.newUserForm.invalid) {
      this.markFormGroupTouched(this.newUserForm);
      await this.popups.presentToast('bottom', 'warning', 'Por favor completa correctamente todos los campos');
      return;
    }

    const formValue = this.newUserForm.value;

    try {
      await this.authService.createAdminUser(formValue);
      await this.popups.presentToast('bottom', 'success', 'Usuario admin creado correctamente');
      this.closeCreateUserModal();
    } catch (error) {
      console.error('Error creating admin user:', error);
      await this.popups.presentToast('bottom', 'danger', 'Error al crear el usuario admin');
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.newUserForm.get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es requerido';
    }
    if (control.errors['email']) {
      return 'Email inválido';
    }
    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength'].requiredLength;
      if (controlName === 'firstName' || controlName === 'lastName') {
        return `Debe tener al menos ${requiredLength} caracteres`;
      }
      if (controlName === 'password') {
        return `La contraseña debe tener al menos ${requiredLength} caracteres`;
      }
    }

    return 'Campo inválido';
  }

  async deleteAdminUser(user: AdminUser) {
    const confirmed = await this.popups.confirm(
      'Eliminar usuario admin',
      `¿Estás seguro que deseas eliminar a ${user.firstName} ${user.lastName}?`,
      'Sí, eliminar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await this.authService.deleteAdminUser(user.uid);
        await this.popups.presentToast('bottom', 'success', 'Usuario admin eliminado correctamente');
      } catch (error) {
        console.error('Error deleting admin user:', error);
        await this.popups.presentToast('bottom', 'danger', 'Error al eliminar el usuario admin');
      }
    }
  }

  isCurrentUser(userUid: string): boolean {
    return userUid === this.currentUserUid;
  }

}