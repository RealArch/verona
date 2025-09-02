import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel, IonList, IonItemSliding, IonItem,
  IonThumbnail, IonNote, IonItemOptions, IonItemOption, IonIcon, IonFab,
  IonFabButton, IonSpinner, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, add, trash } from 'ionicons/icons';
import { Observable } from 'rxjs';
import { Product, ProductsService } from '../../../services/products.service';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, CurrencyPipe,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonList, IonItemSliding, IonItem,
    IonThumbnail, IonNote, IonItemOptions, IonItemOption, IonIcon, IonFab,
    IonFabButton, IonSpinner
  ]
})
export class ProductsPage implements OnInit {
  private productsService = inject(ProductsService);
  private alertCtrl = inject(AlertController);

  products$!: Observable<Product[]>;
  filterStatus: 'all' | 'active' | 'paused' = 'all';

  constructor() {
    addIcons({ cubeOutline, add, trash });
  }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.products$ = this.productsService.getProductsByStatus(this.filterStatus);
    console.log(this.products$)
  }

  segmentChanged(event: any) {
    this.loadProducts();
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
