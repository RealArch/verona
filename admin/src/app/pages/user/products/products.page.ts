import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel, IonList, IonItemSliding, IonItem,
  IonThumbnail, IonNote, IonItemOptions, IonItemOption, IonIcon, IonFab,
  IonFabButton, IonSpinner, AlertController, IonImg, IonCol, IonRow, IonText, IonButton, IonPopover,
  PopoverController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, add, trash, ellipsisVertical } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductsService } from '../../../services/products.service';
import { Popups } from '../../../services/popups';
import { Product } from 'src/app/interfaces/product';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: true,
  imports: [IonPopover, IonButton, IonText, IonRow, IonCol, IonImg,
    CommonModule, FormsModule, RouterLink, CurrencyPipe,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonList, IonItemSliding, IonItem,
    IonThumbnail, IonNote, IonItemOptions, IonItemOption, IonIcon, IonFab,
    IonFabButton, IonSpinner
  ]
})
export class ProductsPage implements OnInit {

  trackProduct(index: number, product: Product) {
    return product.id;
  }
  private productsService = inject(ProductsService);
  private alertCtrl = inject(AlertController);
  private popups = inject(Popups);
  private popoverCtrl = inject(PopoverController);
  private cdr = inject(ChangeDetectorRef);
  products: Product[] = [];
  private destroy$ = new Subject<void>();
  filterStatus: 'all' | 'active' | 'paused' = 'all';

  constructor() {
    addIcons({ cubeOutline, add, trash, ellipsisVertical });
  }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.productsService.getProductsByStatus(this.filterStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products;
      });
  }

  segmentChanged(event: any) {
    this.loadProducts();
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  async changeStatus(productId: string) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    const newStatus = product.status === 'active' ? 'paused' : 'active';
    try {
      await this.popoverCtrl.dismiss(); // Cerrar el popover si está abierto
      await this.productsService.updateStatus(productId, newStatus);
      await this.popups.presentToast('bottom', 'success', `Status actualizado con éxito`);
      this.cdr.detectChanges();

    } catch (error) {
      await this.popups.presentToast('bottom', 'danger', 'Error al cambiar el status del artículo. Intenta nuevamente');
    }
  }
  stopPropagation(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }
  async deleteProduct(productId: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar borrado',
      message: '¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await this.productsService.deleteProduct(productId);
              // La lista se actualizará automáticamente gracias a los observables en tiempo real
            } catch (error) {
              console.error('Error deleting product', error);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  onImgError(event: any) {
    event.target.src = 'assets/placeholder.png';
  }
}
