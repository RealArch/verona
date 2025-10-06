import { Component, inject, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Auth } from '../../../services/auth/auth.services';
import { UserAddress } from '../../../interfaces/auth';

@Component({
  selector: 'app-add-address',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-address.html',
  styleUrl: './add-address.scss'
})
export class AddAddress implements OnInit {
  private auth = inject(Auth);
  private fb = inject(FormBuilder);

  // Input para recibir una dirección a editar (opcional)
  @Input() editAddress: UserAddress | null = null;

  // Reactive Form
  addressForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address_1: ['', [Validators.required, Validators.minLength(5)]],
    address_2: [''],
    instructions: [''], // Campo opcional para instrucciones/detalles adicionales
    municipality: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    country: ['Venezuela', [Validators.required]],
    phone: ['', [Validators.pattern(/^[\+]?[0-9\-\(\)\s]+$/)]],
    isDefault: [false] // Este campo ya no se usa, pero se mantiene por compatibilidad
  });

  // Loading state
  isLoading = false;

  // Error handling
  errorMessage = '';

  // Close modal event emitter (will be handled by parent)
  @Output() onClose = new EventEmitter<void>();

  ngOnInit(): void {
    // Si hay una dirección para editar, llenar el formulario
    if (this.editAddress) {
      this.addressForm.patchValue({
        name: this.editAddress.name,
        address_1: this.editAddress.address_1,
        address_2: this.editAddress.address_2 || '',
        instructions: this.editAddress.description || '', // description se mapea a instructions
        municipality: this.editAddress.municipality,
        city: this.editAddress.city,
        state: this.editAddress.state,
        postalCode: this.editAddress.postalCode,
        country: this.editAddress.country,
        phone: this.editAddress.phone || '',
        isDefault: this.isDefaultAddress() // Marcar como principal si es la primera dirección
      });
    }
  }

  // Getter para controlar si el botón debe estar habilitado
  get isFormValid(): boolean {
    return this.addressForm.valid;
  }

  // Computed property para saber si estamos editando
  get isEditing(): boolean {
    return !!this.editAddress;
  }

  // Método para verificar si la dirección en edición es la principal (primera en el array)
  private isDefaultAddress(): boolean {
    if (!this.editAddress) return false;
    const userProfile = this.auth.userProfile();
    const addresses = userProfile?.addresses || [];
    return addresses.length > 0 && addresses[0].id === this.editAddress!.id;
  }

  // Submit form
  async onSubmit() {
    if (this.isLoading || this.addressForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Prepare address data
      const formValue = this.addressForm.value;
      const addressData: Omit<UserAddress, 'id'> = {
        name: formValue.name,
        address_1: formValue.address_1,
        address_2: formValue.address_2 || null,
        description: formValue.instructions || null, // Usar instructions como description (opcional)
        municipality: formValue.municipality,
        city: formValue.city,
        state: formValue.state,
        postalCode: formValue.postalCode,
        country: formValue.country,
        phone: formValue.phone || null,
      };

      if (this.isEditing && this.editAddress) {
        // Editar dirección existente
        await this.auth.updateUserAddress(this.editAddress.id, addressData, formValue.isDefault);
      } else {
        // Crear nueva dirección
        await this.auth.addUserAddress(addressData, formValue.isDefault);
      }

      // Close modal on success
      this.onClose.emit();
    } catch (error: any) {
      this.errorMessage = error.message || (this.isEditing ? 'Error al actualizar la dirección' : 'Error al guardar la dirección');
    } finally {
      this.isLoading = false;
    }
  }

  // Cancel and close modal
  cancel() {
    this.onClose.emit();
  }

  // Handle backdrop click to close modal
  onBackdropClick(event: MouseEvent) {
    // Close modal only if clicked on the backdrop (not on the modal content)
    if (event.target === event.currentTarget) {
      this.onClose.emit();
    }
  }

  // Helper methods for template
  get formControls() {
    return this.addressForm.controls;
  }

  hasError(controlName: string): boolean {
    const control = this.addressForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getErrorMessage(controlName: string): string {
    const control = this.addressForm.get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es requerido';
    }
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['pattern']) {
      if (controlName === 'postalCode') {
        return 'Código postal debe tener 4 dígitos';
      }
      if (controlName === 'phone') {
        return 'Formato de teléfono inválido';
      }
    }
    return 'Campo inválido';
  }
}
