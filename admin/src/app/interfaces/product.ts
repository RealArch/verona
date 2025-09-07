import { ProductPhoto } from './product-photo';

export interface Product {
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
    price: Price;

    // attributes?: { name: string; type: string[] }[];
    // variations?: {
    //     attributes: { [key: string]: string | number };
    //     price: Price;
    // }[];
    variations?: {
        type: 'color' | 'size' | 'material' | 'custom';
        products: {
            name: string;
            stock: number;
            sku?: string;
            price: Price;
        }[]

    }[];
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