import { Component } from '@angular/core';

// Interfaces del producto (según tu especificación)
export interface ProductPhoto {
  id?: string;
  url: string;
  alt?: string;
  isMain?: boolean;
}

export interface Price {
  regular_price: number;
  sale_price?: number;
  sale_price_dates?: {
    start: Date;
    end: Date;
  };
  tax_status: string;
  tax_class: string;
}

export interface VariationAttribute {
  name: string;
  type?: 'color' | 'size' | 'material' | 'custom';
  options: VariationOption[];
}

export interface VariationOption {
  id: string;
  label: string;
  colorHex?: string;
}

export interface ProductVariant {
  id?: string;
  attributes: { [attributeId: string]: string };
  sku?: string;
  stock: number;
  price?: Price;
  photos?: ProductPhoto[];
  status?: 'active' | 'paused' | 'archived';
}

export interface ProductInterface {
  id?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  sku?: string;
  categoryId: string;
  status: string;
  photos: ProductPhoto[];
  processing?: boolean;
  variationAttributes?: VariationAttribute[];
  variants?: ProductVariant[];
}

@Component({
  selector: 'app-product',
  imports: [],
  templateUrl: './product.html',
  styleUrl: './product.scss'
})
export class Product {
  
  // Producto ejemplo usando la interface
  currentProduct: ProductInterface = {
    id: 'ver-sof-001',
    name: 'Sofá Mediterráneo',
    description: 'Elegante sofá de 3 plazas tapizado en lino natural, perfecto para crear un ambiente acogedor y sofisticado.',
    price: 2890,
    stock: 5,
    sku: 'VER-SOF-001',
    categoryId: 'sofas',
    status: 'active',
    photos: [
      { id: '1', url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80', alt: 'Sofá Principal', isMain: true },
      { id: '2', url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=200&q=80', alt: 'Vista Lateral' },
      { id: '3', url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=200&q=80', alt: 'Detalle Tapizado' },
      { id: '4', url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=200&q=80', alt: 'Vista Completa' }
    ],
    variationAttributes: [
      {
        name: 'Color',
        type: 'color',
        options: [
          { id: 'beige', label: 'Beige Natural', colorHex: '#f5f5dc' },
          { id: 'brown', label: 'Café Oscuro', colorHex: '#8b7355' },
          { id: 'olive', label: 'Verde Oliva', colorHex: '#2f4f4f' }
        ]
      },
      {
        name: 'Tamaño',
        type: 'size',
        options: [
          { id: '2-seats', label: '2 Plazas' },
          { id: '3-seats', label: '3 Plazas' },
          { id: '4-seats', label: '4 Plazas' }
        ]
      }
    ],
    variants: [
      {
        id: 'var-1',
        attributes: { color: 'beige', size: '3-seats' },
        sku: 'VER-SOF-001-BG-3',
        stock: 5,
        status: 'active'
      },
      {
        id: 'var-2', 
        attributes: { color: 'brown', size: '3-seats' },
        sku: 'VER-SOF-001-BR-3',
        stock: 3,
        status: 'active'
      }
    ]
  };

  // Estados del componente
  selectedVariant: ProductVariant | null = null;
  selectedQuantity: number = 1;
  activeTab: string = 'description';
  currentImageIndex: number = 0;

  constructor() {
    // Seleccionar la primera variante por defecto
    if (this.currentProduct.variants && this.currentProduct.variants.length > 0) {
      this.selectedVariant = this.currentProduct.variants[0];
    }
  }

  // Métodos para manejar la funcionalidad
  selectVariant(variant: ProductVariant) {
    this.selectedVariant = variant;
  }

  selectImage(index: number) {
    this.currentImageIndex = index;
  }

  increaseQuantity() {
    if (this.selectedVariant && this.selectedQuantity < this.selectedVariant.stock) {
      this.selectedQuantity++;
    } else if (!this.selectedVariant && this.selectedQuantity < this.currentProduct.stock) {
      this.selectedQuantity++;
    }
  }

  decreaseQuantity() {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }

  addToCart() {
    console.log('Agregando al carrito:', {
      product: this.currentProduct,
      variant: this.selectedVariant,
      quantity: this.selectedQuantity
    });
    // Aquí iría la lógica para agregar al carrito
  }

  addToWishlist() {
    console.log('Agregando a favoritos:', this.currentProduct);
    // Aquí iría la lógica para agregar a favoritos
  }

  switchTab(tab: string) {
    this.activeTab = tab;
  }

  // Getters para facilitar el uso en el template
  get mainImage() {
    return this.currentProduct.photos[this.currentImageIndex];
  }

  get currentPrice() {
    return this.selectedVariant?.price?.regular_price || this.currentProduct.price;
  }

  get currentStock() {
    return this.selectedVariant?.stock || this.currentProduct.stock;
  }

  get isInStock() {
    return this.currentStock > 0;
  }
}
