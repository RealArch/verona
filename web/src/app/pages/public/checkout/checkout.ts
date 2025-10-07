import { Component, inject, signal, computed, OnInit, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Location, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartItem } from '../../../interfaces/shopping-cart';
import { Product, ProductVariant } from '../../../interfaces/products';
import { Auth } from '../../../services/auth/auth.services';
import { UserAddress } from '../../../interfaces/auth';
import { AddAddress } from '../../../components/user/add-address/add-address';
import { Sales } from '../../../services/sales/sales';
import { CreateOrderRequest, DeliveryMethod } from '../../../interfaces/sales';
import { SiteConfig } from '../../../services/site-config/site-config';

// Tipo para los items del checkout
type CheckoutItem = CartItem & { 
  currentProduct?: Product; 
  currentVariant?: ProductVariant; 
};

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, AddAddress, FormsModule],
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

  // State signals
  checkoutItems = signal<CheckoutItem[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  showAddAddressModal = signal<boolean>(false);
  showSelectAddressModal = signal<boolean>(false);
  selectedAddress = signal<UserAddress | null>(null);
  editingAddress = signal<UserAddress | null>(null);
  addressCountBeforeAdd = signal<number>(0);
  processingOrder = signal<boolean>(false);
  selectedDeliveryMethod = signal<DeliveryMethod | null>(null);
  selectedBillingAddress = signal<UserAddress | null>(null);
  showSelectBillingAddressModal = signal<boolean>(false);
  useSameAsShipping = signal<boolean>(false);
  
  // Billing address form fields
  billingForm = signal({
    name: '',
    address_1: '',
    address_2: '',
    municipality: '',
    city: '',
    state: '',
    country: 'Venezuela',
    postalCode: '',
    phone: '',
    description: ''
  });

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

  // Current selected billing address (defaults to shipping address if not set)
  currentBillingAddress = computed(() => {
    // Si está marcado "usar misma dirección de envío"
    if (this.useSameAsShipping() && this.isDeliveryAddressRequired()) {
      return this.currentAddress();
    }
    
    // Si hay un formulario con datos
    const form = this.billingForm();
    if (form.name && form.address_1 && form.city && form.state && form.country && form.postalCode) {
      return form as UserAddress;
    }
    
    return null;
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
    this.loadCheckoutItems();
    // No seleccionar método por defecto inicialmente
    // this.selectedDeliveryMethod.set(methods[0].key);
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
        console.log('Settings captured:', { 
          taxPercentage: settings.taxPercentage, 
          deliveryMethods: this.siteConfig.getEnabledDeliveryMethods() 
        });
      }
    });
  }

  private loadCheckoutItems(): void {
    // Only access history in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('SSR: Skipping checkout items load');
      return;
    }

    try {
      // Obtener los items del estado de navegación
      const navigation = this.router.getCurrentNavigation();
      const state = navigation?.extras?.state || history.state;
      
      if (state?.selectedItems && Array.isArray(state.selectedItems)) {
        this.checkoutItems.set(state.selectedItems);
        console.log('Checkout items loaded:', state.selectedItems);
      } else {
        // Si no hay items seleccionados, redirigir al carrito
        console.warn('No checkout items found, redirecting to cart');
        this.router.navigate(['/shopping-cart']);
      }
    } catch (error) {
      console.error('Error loading checkout items:', error);
      this.error.set('Error al cargar los items del checkout');
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

  selectBillingAddress(address: UserAddress): void {
    this.selectedBillingAddress.set(address);
    // Copiar los valores al formulario
    this.billingForm.set({
      name: address.name,
      address_1: address.address_1,
      address_2: address.address_2 || '',
      municipality: address.municipality,
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      phone: address.phone || '',
      description: address.description || ''
    });
    this.useSameAsShipping.set(false);
    this.closeSelectBillingAddressModal();
  }

  // Usar misma dirección de envío para facturación
  toggleUseSameAsShipping(): void {
    const newValue = !this.useSameAsShipping();
    this.useSameAsShipping.set(newValue);
    
    if (newValue && this.currentAddress()) {
      // Copiar dirección de envío al formulario
      const shippingAddr = this.currentAddress()!;
      this.billingForm.set({
        name: shippingAddr.name,
        address_1: shippingAddr.address_1,
        address_2: shippingAddr.address_2 || '',
        municipality: shippingAddr.municipality,
        city: shippingAddr.city,
        state: shippingAddr.state,
        country: shippingAddr.country,
        postalCode: shippingAddr.postalCode,
        phone: shippingAddr.phone || '',
        description: shippingAddr.description || ''
      });
    }
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
      this.error.set('Debe seleccionar un método de entrega');
      return;
    }

    // Validar dirección solo si es requerida
    if (this.isDeliveryAddressRequired() && !address) {
      this.error.set('Debe seleccionar una dirección de entrega');
      return;
    }

    // Validar que haya dirección de facturación
    if (!this.currentBillingAddress()) {
      this.error.set('Debe seleccionar una dirección de facturación');
      return;
    }

    if (!user) {
      this.error.set('Debe estar autenticado para procesar el pedido');
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
        userId: user.uid,
        items: orderItems,
        shippingAddress: this.isDeliveryAddressRequired() ? address : null,
        billingAddress: this.currentBillingAddress(),
        deliveryMethod: deliveryMethod,
        paymentMethod: 'pending', // Placeholder, se implementará después
        totals: totals
      };

      // Enviar la orden al backend
      const response = await this.sales.createOrder(orderData);

      if (response.success && response.orderId) {
        console.log('Order created successfully:', response.orderId);
        // Aquí podrías redirigir a una página de confirmación
        // this.router.navigate(['/order-confirmation', response.orderId]);
        alert(`Pedido procesado exitosamente. ID de orden: ${response.orderId}`);
      } else {
        throw new Error(response.message || 'Error al procesar el pedido');
      }

    } catch (error: any) {
      console.error('Error processing order:', error);
      this.error.set(error.message || 'Error al procesar el pedido. Intente nuevamente.');
    } finally {
      this.processingOrder.set(false);
    }
  }
}
