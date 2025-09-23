export interface Product {
    id?: string;
    objectID?: string;
    categoryId: string;
    description: string;
    name: string;
    pausedVariantsCount: number;
    photos: PhotosArray[];
    price: number;
    processing: boolean;
    sku: string;
    status: string;
    stock: string;
    totalSales: number;
    variants: ProductVariant[];
    slug: string;
    minPrice: number; 
    maxPrice: number; 
}

export interface VariationAttribute {
    name: string;          // Etiqueta visible: Color, Talla
    type: 'color' | 'size' | 'material' | 'custom';
}


export interface ProductVariant {
    colorHex?: string;
    id: string;
    name: string;
    price: number;
    sku?: string;
    status: 'active' | 'paused' | 'archived';
    stock: number;

}

export type ProductStatus = 'active' | 'paused' | 'archived';

export interface PhotosArray {
    large: ProductPhoto;
    medium: ProductPhoto;
    small: ProductPhoto;
    thumbnail: ProductPhoto;
    processing: boolean;
}

export interface ProductPhoto {
    name: string;
    path: string;
    url: string;
    type: string;
    processing: boolean;
}