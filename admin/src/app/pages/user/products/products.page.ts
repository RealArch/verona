import { ChangeDetectorRef, Component, OnInit, inject, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
  IonLabel, IonList, IonItemSliding, IonItem,
  IonThumbnail, IonItemOptions, IonItemOption, IonIcon, IonFab,
  IonFabButton, IonSpinner, AlertController, IonImg, IonCol, IonRow, IonButton, IonPopover,
  PopoverController, IonGrid, IonSkeletonText, IonSearchbar, IonSelect, IonSelectOption,
  IonInfiniteScroll, IonInfiniteScrollContent, ActionSheetController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cubeOutline, add, trash, ellipsisVertical, imageOutline, trashOutline, chevronDownOutline, refreshOutline, searchOutline, closeOutline, createOutline, pauseOutline, playOutline } from 'ionicons/icons';
import { Subject, takeUntil, firstValueFrom, filter, take, timeout, tap } from 'rxjs';
import { ProductsService } from '../../../services/products.service';
import { Popups } from '../../../services/popups';
import { Product, ProductStatus, ProductSearchFilters } from 'src/app/interfaces/product';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: true,
  imports: [IonGrid, IonPopover, IonButton, IonRow, IonCol, IonImg,
    CommonModule, FormsModule, RouterLink, CurrencyPipe,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent,
    IonLabel, IonList, IonItemSliding, IonItem,
    IonThumbnail, IonItemOptions, IonItemOption, IonIcon, IonFab,
    IonFabButton, IonSpinner, IonSkeletonText, IonSearchbar, IonSelect, IonSelectOption,
    IonInfiniteScroll, IonInfiniteScrollContent
  ]
})
export class ProductsPage implements OnInit, OnDestroy {
  private productsService = inject(ProductsService);
  private alertCtrl = inject(AlertController);
  private actionSheetCtrl = inject(ActionSheetController);
  private popups = inject(Popups);
  private popoverCtrl = inject(PopoverController);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  products: Product[] = [];
  loading = false;
  hasMore = true;
  searchQuery = '';
  lastLoadedQuery = '';
  lastLoadedStatus = '';
  currentPage = 0;
  pageSize = 30;
  isSearchActive = false;

  // Filter properties
  selectedStatus: ProductStatus | '' = '';
  statusOptions: { value: ProductStatus | '', label: string }[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'paused', label: 'Pausados' },
    // { value: 'archived', label: 'Archivados' }
  ];

  trackProduct(index: number, product: Product) {
    return product.id;
  }

  navigateToProduct(productId: string) {
    this.router.navigate(['/products', productId, 'edit']);
  }

  constructor() {
    addIcons({chevronDownOutline,refreshOutline,cubeOutline,trash,ellipsisVertical,add,imageOutline,trashOutline,searchOutline,closeOutline,createOutline,pauseOutline,playOutline});
  }

  async ngOnInit() {
    // Initialize query params subscription
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const newQuery = params['q'] || '';
        const newStatus = params['status'] || '';
        
        // Si los parámetros no han cambiado respecto a lo último cargado y ya tenemos productos, no recargar
        // Esto evita que al volver de una página de detalle se pierda el scroll y la lista
        if (this.lastLoadedQuery === newQuery && this.lastLoadedStatus === newStatus && this.products.length > 0) {
          return;
        }

        this.searchQuery = newQuery;
        this.selectedStatus = newStatus;
        
        this.loadProducts(true);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProducts(reset: boolean = false) {
    if (reset) {
      this.currentPage = 0;
      this.products = [];
      this.hasMore = true;
      this.loading = true;
      // Reactivar infinite scroll si estaba desactivado
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = false;
      }
    }

    if (!this.hasMore && !reset) return;

    try {
      // Guardar los parámetros usados para esta carga
      this.lastLoadedQuery = this.searchQuery;
      this.lastLoadedStatus = this.selectedStatus;

      const filters: ProductSearchFilters = {
        query: this.searchQuery,
        status: this.selectedStatus ? [this.selectedStatus as ProductStatus] : undefined
      };

      const result = await this.productsService.searchProducts(
        this.searchQuery,
        this.currentPage,
        this.pageSize,
        filters
      );

      if (reset) {
        this.products = result.products;
      } else {
        this.products = [...this.products, ...result.products];
      }

      this.hasMore = result.hasMore;
      this.currentPage++;
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      this.loading = false;
    }
  }

  async onSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    this.updateQueryParams();
  }

  async onStatusChange(event: any) {
    this.selectedStatus = event.detail.value;
    this.updateQueryParams();
  }

  updateQueryParams() {
    const queryParams: any = {};

    // Si hay texto de búsqueda, lo añadimos; si no, forzamos q=null para eliminarlo de la URL
    queryParams.q = this.searchQuery ? this.searchQuery : null;

    // Mismo comportamiento para el status
    queryParams.status = this.selectedStatus ? this.selectedStatus : null;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  // Maneja el evento de limpiar (x) del searchbar
  async onSearchClear() {
    // Asegurarnos de que el modelo esté vacío
    this.searchQuery = '';
    // Actualizar la URL (el q será removido) y recargar la lista
    this.updateQueryParams();
    await this.loadProducts(true);
  }

  closeSearch() {
    this.isSearchActive = false;
    this.onSearchClear();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedStatus);
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
  }

  async loadMoreProducts(event: any) {
    await this.loadProducts();
    event.target.complete();

    if (!this.hasMore) {
      event.target.disabled = true;
    }
  }

  // Precio a mostrar para producto (single)
  displayProductPrice(product: Product): number {
    const hasDynamic = (product as any).hasDynamicPricing as boolean | undefined;
    const dynamicPrices = (product as any).dynamicPrices as Array<{ price: number }> | undefined;
    if (hasDynamic && Array.isArray(dynamicPrices) && dynamicPrices.length > 0) {
      // Mostrar el primer item del array de precios dinámicos
      const first = dynamicPrices[0];
      return typeof first?.price === 'number' ? first.price : (product.price ?? 0);
    }
    return product.price ?? 0;
  }

  // Precio a mostrar para variante
  displayVariantPrice(variant: any): number {
    const hasDynamic = !!variant?.hasDynamicPricing;
    const dynamicPrices = variant?.dynamicPrices as Array<{ price: number }> | undefined;
    if (hasDynamic && Array.isArray(dynamicPrices) && dynamicPrices.length > 0) {
      const first = dynamicPrices[0];
      return typeof first?.price === 'number' ? first.price : (variant?.price ?? 0);
    }
    return variant?.price ?? 0;
  }

  async changeStatus(productId: string) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    const newStatus = product.status === 'active' ? 'paused' : 'active';
    const oldStatus = product.status;
    
    try {
      // Intentar cerrar el popover si está abierto, pero no fallar si no lo está
      try {
        await this.popoverCtrl.dismiss();
      } catch (e) {
        // Ignorar error si no hay popover
      }
      
      // Actualizar localmente primero (optimistic update)
      product.status = newStatus;
      this.cdr.detectChanges();
      
      // Luego actualizar en el servidor
      await this.productsService.updateStatus(productId, newStatus);
      await this.popups.presentToast('bottom', 'success', `Status actualizado con éxito`);

    } catch (error) {
      console.error('Error changing status:', error);
      // Revertir el cambio local si falla
      product.status = oldStatus;
      this.cdr.detectChanges();
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
              // Eliminar localmente primero (optimistic update)
              const productIndex = this.products.findIndex(p => p.id === productId);
              if (productIndex > -1) {
                this.products.splice(productIndex, 1);
                this.cdr.detectChanges();
              }

              // Luego eliminar del servidor
              await this.productsService.deleteProduct(productId);
              await this.popups.presentToast('bottom', 'success', 'Producto eliminado con éxito');
            } catch (error) {
              console.error('Error deleting product', error);
              // Si falla, recargar la lista para restaurar el estado
              await this.loadProducts(true);
              await this.popups.presentToast('bottom', 'danger', 'Error al eliminar el producto');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // Método para actualizar producto después de editar
  async ionViewWillEnter() {
    const state = history.state;
    
    // Si viene de editar un producto
    if (state?.editedProductId) {
      const productId = state.editedProductId;
      const hasImageChanges = state.hasImageChanges || false;
      
      // Limpiar el estado inmediatamente
      window.history.replaceState({}, '');
      
      if (hasImageChanges) {
        // Si hubo cambios de imagen, mostrar un indicador temporal y esperar el processing
        await this.reloadProductWithProcessing(productId);
      } else {
        // Si NO hubo cambios de imagen, recargar inmediatamente sin processing
        await this.reloadProductInstant(productId);
      }
    }
  }

  // Recarga instantánea para cambios sin imágenes
  private async reloadProductInstant(productId: string) {
    try {
      const updatedProduct = await firstValueFrom(this.productsService.getProduct(productId));
      
      const index = this.products.findIndex(p => p.id === productId);
      if (index > -1) {
        // Asegurar que processing esté en false para cambios simples
        this.products[index] = { 
          ...updatedProduct,
          processing: false 
        };
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error reloading product:', error);
    }
  }

  // Recarga optimizada usando suscripción en tiempo real (más rápido y eficiente que polling)
  private reloadProductWithProcessing(productId: string) {
    const index = this.products.findIndex(p => p.id === productId);
    if (index === -1) return;

    // 1. Marcar como processing visualmente
    this.products[index] = {
      ...this.products[index],
      processing: true
    };
    this.cdr.detectChanges();

    console.log(`🔄 Escuchando cambios en tiempo real para ${productId}...`);

    // 2. Suscribirse a cambios en tiempo real
    // Firestore enviará el nuevo valor automáticamente apenas cambie en el servidor
    this.productsService.getProduct(productId)
      .pipe(
        // Log para ver qué está llegando
        tap(p => console.log(`📡 Actualización recibida para ${p.name}: processing = ${p.processing}`)),
        // Filtrar: solo pasar cuando processing sea false (o undefined/null)
        filter(p => !p.processing),
        // Tomar solo el primer valor que cumpla (el resultado final)
        take(1),
        // Timeout de seguridad: si en 60s no termina, cancelar
        timeout(60000),
        // Limpiar si el componente se destruye
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (updatedProduct) => {
          console.log(`✅ Processing completado! Actualizando vista con datos finales.`);
          this.products[index] = { ...updatedProduct };
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('⚠️ Timeout o error esperando processing:', error);
          // En caso de error/timeout, quitamos el spinner para no bloquear la UI
          if (this.products[index]) {
            this.products[index].processing = false;
            this.cdr.detectChanges();
          }
        }
      });
  }

}
