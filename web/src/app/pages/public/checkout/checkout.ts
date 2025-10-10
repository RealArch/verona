import { Component, inject, signal, computed, OnInit, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Location, CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CartItem } from '../../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../../interfaces/products';
import { Auth } from '../../../services/auth/auth.services';
import { UserAddress } from '../../../interfaces/auth';
import { AddAddress } from '../../../components/user/add-address/add-address';
import { Sales } from '../../../services/sales/sales';
import { CreateOrderRequest, DeliveryMethod } from '../../../interfaces/sales';
import { SiteConfig } from '../../../services/site-config/site-config';
import { ShoppingCartService } from '../../../services/shopping-cart/shopping-cart';

// Tipo para los items del checkout
type CheckoutItem = CartItem & { 
  currentProduct?: Product; 
  currentVariant?: ProductVariant; 
};

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, AddAddress, ReactiveFormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss'
})
export class Checkout implements OnInit {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly auth = inject(Auth);
  private readonly sales = inject(Sales);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly siteConfig = inject(SiteConfig);
  private readonly fb = inject(FormBuilder);
  private readonly cartService = inject(ShoppingCartService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // State signals
  checkoutItems = signal<CheckoutItem[]>([]);
  loading = signal<boolean>(false);
  error = signal<{ message?: string; errors?: string[] } | null>(null);
  showAddAddressModal = signal<boolean>(false);
  showSelectAddressModal = signal<boolean>(false);
  selectedAddress = signal<UserAddress | null>(null);
  editingAddress = signal<UserAddress | null>(null);
  addressCountBeforeAdd = signal<number>(0);
  processingOrder = signal<boolean>(false);
  selectedDeliveryMethod = signal<DeliveryMethod | null>(null);
  showSelectBillingAddressModal = signal<boolean>(false);
  
  // Reactive Form for Billing Address - Manual entry with optional copy from saved addresses
  billingAddressForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    address_1: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    address_2: ['', [Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(500)]],
    municipality: ['', [Validators.minLength(2), Validators.maxLength(100)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    postalCode: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(15)]],
    phone: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(20)]]
  });

  // Getter para facilitar acceso a controles del formulario
  get billingFormControls() {
    return this.billingAddressForm.controls;
  }

  // User profile and addresses
  userProfile = this.auth.userProfile;
  isAuthenticated = this.auth.isAuthenticated;

  // Store settings - capturados una sola vez al inicializar
  private initialTaxPercentage = signal<number>(0);
  private initialDeliveryMethods = signal<{ key: DeliveryMethod; label: string; enabled: boolean }[]>([]);
  private settingsCaptured = signal<boolean>(false);

  // Computed for available delivery methods - usa los valores iniciales capturados
  availableDeliveryMethods = computed(() => {
    return this.initialDeliveryMethods();
  });

  // Computed to check if delivery address is required
  isDeliveryAddressRequired = computed(() => {
    const selectedMethod = this.selectedDeliveryMethod();
    return selectedMethod === 'shipping' || selectedMethod === 'homeDelivery';
  });

  // Computed to check if shipping address is valid for billing (has valid phone)
  isShippingAddressValidForBilling = computed(() => {
    const shippingAddr = this.currentAddress();
    return shippingAddr && shippingAddr.phone && shippingAddr.phone.trim().length >= 7;
  });

  // Computed for user addresses
  userAddresses = computed(() => this.userProfile()?.addresses || []);
  
  // Computed for default address (first address)
  defaultAddress = computed(() => {
    const addresses = this.userAddresses();
    return addresses.length > 0 ? addresses[0] : null;
  });

  // Current selected address (defaults to first address)
  currentAddress = computed(() => {
    return this.selectedAddress() || this.defaultAddress();
  });

  // Current billing address from form - always returns the form values if valid
  currentBillingAddress = computed(() => {
    const form = this.billingAddressForm.value;
    
    // Check if all required fields are filled
    const hasRequiredFields = form.name?.trim() && 
                             form.address_1?.trim() && 
                             form.city?.trim() && 
                             form.state?.trim() && 
                             form.postalCode?.trim() && 
                             form.phone?.trim();

    if (!hasRequiredFields) {
      return null;
    }

    // Return billing address object with country default to Venezuela
    return {
      id: '',
      name: form.name.trim(),
      address_1: form.address_1.trim(),
      address_2: form.address_2?.trim() || null,
      description: form.description?.trim() || null,
      municipality: form.municipality?.trim() || '',
      city: form.city.trim(),
      state: form.state.trim(),
      country: 'Venezuela', // Default country
      postalCode: form.postalCode.trim(),
      phone: form.phone.trim()
    } as UserAddress;
  });

  // Computed totals - usa el taxPercentage inicial capturado
  checkoutTotals = computed(() => {
    const items = this.checkoutItems();
    if (!items.length) return { subtotal: 0, taxAmount: 0, shippingCost: 0, total: 0, itemCount: 0, taxPercentage: 0 };
    
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxPercentage = this.initialTaxPercentage();
    const taxAmount = subtotal * (taxPercentage / 100);
    const shippingCost = 0; // Por defecto cero, se calculará después basado en método de delivery
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = subtotal + taxAmount + shippingCost;
    
    return { subtotal, taxAmount, shippingCost, total, itemCount, taxPercentage };
  });

  ngOnInit(): void {
    this.setupSEO();
    this.loadCheckoutItems();
    // No seleccionar método por defecto inicialmente
    // this.selectedDeliveryMethod.set(methods[0].key);
  }

  private setupSEO(): void {
    this.titleService.setTitle('Checkout | Verona');
    this.metaService.updateTag({ name: 'description', content: 'Finaliza tu compra en Verona de forma segura.' });
    this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  constructor() {
    // Effect para capturar los valores de configuración una sola vez cuando estén disponibles
    effect(() => {
      const settings = this.siteConfig.storeSettings();
      
      // Solo capturar una vez cuando los settings estén disponibles y no se hayan capturado antes
      if (settings && !this.settingsCaptured()) {
        this.initialTaxPercentage.set(settings.taxPercentage || 0);
        this.initialDeliveryMethods.set(this.siteConfig.getEnabledDeliveryMethods());
        this.settingsCaptured.set(true);
        // console.log('Settings captured:', { 
        //   taxPercentage: settings.taxPercentage, 
        //   deliveryMethods: this.siteConfig.getEnabledDeliveryMethods() 
        // });
      }
    });
  }

  private loadCheckoutItems(): void {
    // Only access history in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      // console.log('SSR: Skipping checkout items load');
      return;
    }

    try {
      // Obtener los items del estado de navegación
      const navigation = this.router.getCurrentNavigation();
      const state = navigation?.extras?.state || history.state;
      
      if (state?.selectedItems && Array.isArray(state.selectedItems)) {
        this.checkoutItems.set(state.selectedItems);
        // console.log('Checkout items loaded:', state.selectedItems);
      } else {
        // Si no hay items seleccionados, redirigir al carrito
        console.warn('No checkout items found, redirecting to cart');
        this.router.navigate(['/shopping-cart']);
      }
    } catch (error) {
      console.error('Error loading checkout items:', error);
      this.error.set({ message: 'Error al cargar los items del checkout' });
    }
  }

  // Métodos para manejo de direcciones
  openAddAddressModal(): void {
    this.addressCountBeforeAdd.set(this.userAddresses().length);
    this.editingAddress.set(null); // Limpiar dirección en edición
    this.showAddAddressModal.set(true);
  }

  // Método para seleccionar método de entrega
  selectDeliveryMethod(method: DeliveryMethod): void {
    this.selectedDeliveryMethod.set(method);
  }

  openEditAddressModal(address: UserAddress): void {
    this.editingAddress.set(address); // Establecer dirección a editar
    this.showAddAddressModal.set(true);
  }

  closeAddAddressModal(): void {
    this.showAddAddressModal.set(false);
    this.editingAddress.set(null); // Limpiar dirección en edición
    
    // Si se agregó una nueva dirección, seleccionarla automáticamente
    const currentAddresses = this.userAddresses();
    if (currentAddresses.length > this.addressCountBeforeAdd()) {
      const newAddress = currentAddresses[currentAddresses.length - 1];
      this.selectedAddress.set(newAddress);
    }
  }

  openSelectAddressModal(): void {
    this.showSelectAddressModal.set(true);
  }

  closeSelectAddressModal(): void {
    this.showSelectAddressModal.set(false);
  }

  selectAddress(address: UserAddress): void {
    this.selectedAddress.set(address);
    this.closeSelectAddressModal();
  }

  // Métodos para dirección de facturación
  openSelectBillingAddressModal(): void {
    this.showSelectBillingAddressModal.set(true);
  }

  closeSelectBillingAddressModal(): void {
    this.showSelectBillingAddressModal.set(false);
  }

  // Copy address from saved addresses to billing form
  copyAddressToBillingForm(address: UserAddress): void {
    this.billingAddressForm.patchValue({
      name: address.name,
      address_1: address.address_1,
      address_2: address.address_2 || '',
      description: address.description || '',
      municipality: address.municipality || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      phone: address.phone || ''
    });
    this.closeSelectBillingAddressModal();
  }

  // Método para volver al carrito
  goBackToCart(): void {
    this.location.back();
  }

  // Método para procesar el pedido
  async processOrder(): Promise<void> {
    const items = this.checkoutItems();
    const totals = this.checkoutTotals();
    const address = this.currentAddress();
    const user = this.auth.user();
    const deliveryMethod = this.selectedDeliveryMethod();

    // Validar que se haya seleccionado un método de entrega
    if (!deliveryMethod) {
      this.error.set({ message: 'Debe seleccionar un método de entrega' });
      return;
    }

    // Validar dirección solo si es requerida
    if (this.isDeliveryAddressRequired() && !address) {
      this.error.set({ message: 'Debe seleccionar una dirección de entrega' });
      return;
    }

    // Validar que haya una dirección de facturación
    const billingAddress = this.currentBillingAddress();
    if (!billingAddress) {
      this.error.set({ message: 'Debe completar el formulario de facturación' });
      return;
    }

    // Validar que el teléfono esté presente
    if (!billingAddress.phone || !billingAddress.phone.trim()) {
      this.error.set({ message: 'El teléfono de facturación es requerido' });
      return;
    }

    // Validar formulario de facturación
    if (this.billingAddressForm.invalid) {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(this.billingAddressForm.controls).forEach(key => {
        this.billingAddressForm.get(key)?.markAsTouched();
      });
      this.error.set({ message: 'Debe completar correctamente el formulario de facturación' });
      return;
    }

    if (!user) {
      this.error.set({ message: 'Debe estar autenticado para procesar el pedido' });
      return;
    }

    this.processingOrder.set(true);
    this.error.set(null);

    try {
      // Preparar los items para la orden
      const orderItems = items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productName: item.productName,
        variantName: item.variantName,
        variantColorHex: item.variantColorHex,
        productImage: item.productImage
      }));

      // Preparar la data de la orden
      const orderData: CreateOrderRequest = {
        userId: user?.uid || 'guest',
        items: orderItems,
        shippingAddress: this.isDeliveryAddressRequired() ? address : null,
        billingAddress: billingAddress,
        deliveryMethod: deliveryMethod,
        paymentMethod: 'pending', // Placeholder, se implementará después
        totals: totals
      };

      // console.log('Order data being sent:', orderData);
      // console.log('Billing address phone:', billingAddress.phone, 'Type:', typeof billingAddress.phone); // Debug phone

      // Enviar la orden al backend
      const response = await this.sales.createOrder(orderData);

      if (response.success && response.orderId) {
        // console.log('Order created successfully:', response.orderId);
        
        // Eliminar los items comprados del carrito
        try {
          const itemIds = items.map(item => item.id).filter(id => id);
          await Promise.all(itemIds.map(itemId => this.cartService.removeFromCart(itemId)));
        } catch (cartError) {
          console.error('Error removing items from cart:', cartError);
          // No fallar la orden por esto, solo loguear el error
        }

        // Redirigir a la página de éxito con información de la orden
        this.router.navigate(['/success-sale'], {
          state: {
            orderId: response.orderId,
            deliveryMethod: deliveryMethod,
            total: totals.total
          }
        });
      } else {
        throw new Error(response.message || 'Error al procesar el pedido');
      }

    } catch (error: any) {
      console.error('Error processing order:', error);
      
      // Extraer mensaje y errores del error HTTP
      let message = 'Error al procesar el pedido. Intente nuevamente.';
      let errors: string[] | undefined;
      
      if (error.error) {
        // Si el error viene del servidor con estructura { message, errors }
        if (error.error.message) {
          message = error.error.message;
        }
        if (error.error.errors && Array.isArray(error.error.errors)) {
          // Convertir los errores a strings, manejando tanto objetos como strings
          errors = error.error.errors.map((err: any) => {
            if (typeof err === 'string') {
              return err;
            } else if (err && typeof err === 'object') {
              // Si es un objeto, intentar extraer el mensaje
              return err.message || err.msg || err.error || JSON.stringify(err);
            }
            return String(err);
          });
        }
      } else if (error.message) {
        message = error.message;
      }
      
      this.error.set({ message, errors });
    } finally {
      this.processingOrder.set(false);
    }
  }
}
