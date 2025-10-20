export interface CategoryImage {
  name?: string;
  path: string;
  processing: boolean;
  type: string;
  url: string;
}

export interface Category {
  id?: string;
  name: string;
  slug: string; // Para URLs amigables
  description?: string; // Descripción para SEO y para el usuario
  image?: CategoryImage; // Objeto completo de la imagen de la categoría
  parentId: string; // "root" para categorías principales, o ID de la categoría padre
  counters: {
    products: number;
  }
  path: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  children?: Category[]; // Para anidar las subcategorías
}
