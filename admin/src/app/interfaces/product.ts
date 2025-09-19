import { ProductPhoto } from './product-photo';

export interface Product {
    id?: string;
    name: string;
    slug: string; // URL-friendly version of the name
    description?: string;
    price: number;
    stock: number;
    sku?: string;
    categoryId: string;
    status: string;
    photos: ProductPhoto[];
    processing?: boolean;
    // Atributos de variación (p.ej., Color, Talla) y combinaciones (variants)
    variationAttributes?: VariationAttribute[];
    variants?: ProductVariant[]; // combinaciones generadas de atributos
    pausedVariantsCount: number; // Número de variantes en estado 'paused'
}


export interface newProduct {
    id?: string;
    name: string;
    description?: string;
    stock: number;
    sku?: string;
    categories: string[];
    status: string;
    photos: ProductPhoto[];
    processing: boolean;
    slug: string;
    tags?: string[];
    price: number;
    variationAttributes?: VariationAttribute[];
    variants?: ProductVariant[];
    pausedVariantsCount: number;
    

}



export interface VariationAttribute {
    // id: string;            // slug o id único: color, size
    name: string;          // Etiqueta visible: Color, Talla
    type?: 'color' | 'size' | 'material' | 'custom';
    // options: VariationOption[]; // Valores disponibles (Rojo, Azul, S, M, L)
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