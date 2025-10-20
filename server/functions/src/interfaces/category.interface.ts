export interface CategoryImage {
  name?: string;
  path: string;
  processing: boolean;
  type: string;
  url: string;
}

export interface Category {
    objectID?: string;
    id?: string;
    createdAt?: string;
    image: CategoryImage | null;
    name: string;
    order: number;
    parentId: string; // 'root' or category id
    counters:{
      products: number;
    }
    path: string[];
    processing: boolean;
    slug: string;
    updatedAt: Date;
}