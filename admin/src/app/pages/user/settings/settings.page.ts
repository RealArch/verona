import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonToggle, IonButtons, IonMenuButton, IonListHeader, IonGrid, IonIcon, IonPopover, IonButton, IonInput } from '@ionic/angular/standalone';
import { SettingsService } from 'src/app/services/settings.service';
import { Popups } from 'src/app/services/popups';
import { addIcons } from 'ionicons';
import { home, bicycle, airplane, chatbubbles, calculator, createOutline } from 'ionicons/icons';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonInput, IonButton, IonPopover, IonLabel, IonIcon, IonGrid, IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonToggle, IonButtons, IonMenuButton, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit {
  private settingsService = inject(SettingsService);
  private popups = inject(Popups);

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

  constructor() {
    addIcons({ home, bicycle, airplane, chatbubbles, calculator, createOutline });
  }

  ngOnInit() {
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

}

