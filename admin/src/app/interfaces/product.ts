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
    // Atributos de variación (p.ej., Color, Talla) y combinaciones (variants)
    variationAttributes?: VariationAttribute[];
    variants?: ProductVariant[]; // combinaciones generadas de atributos
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
    variationAttributes?: VariationAttribute[];
    variants?: ProductVariant[];


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

// Atributo de variación (ej. Color, Talla)
export interface VariationAttribute {
    // id: string;            // slug o id único: color, size
    name: string;          // Etiqueta visible: Color, Talla
    type?: 'color' | 'size' | 'material' | 'custom';
    options: VariationOption[]; // Valores disponibles (Rojo, Azul, S, M, L)
}

export interface VariationOption {
    id: string;            // slug del valor: rojo, azul, s, m, l
    label: string;         // etiqueta visible
    // Para tipos especiales (color, imagen, etc.)
    colorHex?: string;     // si type === 'color'
}

// Una combinación concreta de atributos (p.ej., Color=Rojo + Talla=M)
export interface ProductVariant {
    id?: string; // id de variante (opcional si se genera al guardar)
    attributes: { [attributeId: string]: string }; // { color: 'rojo', size: 'm' }
    sku?: string;
    stock: number;
    price?: Price; // si no se define, usar el Price del producto
    photos?: ProductPhoto[]; // imágenes específicas de la variante
    status?: 'active' | 'paused' | 'archived';
}