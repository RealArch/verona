export interface CategoryImage {
  path: string;
  url: string;
  type: string;
  processing: boolean;
}

export interface Category {
  id?: string;
  name: string;
  slug: string; // Para URLs amigables
  description?: string; // Descripción para SEO y para el usuario
  image?: CategoryImage; // Objeto completo de la imagen de la categoría
  parentId?: string | null;
  path?: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  children?: Category[]; // Para anidar las subcategorías
}