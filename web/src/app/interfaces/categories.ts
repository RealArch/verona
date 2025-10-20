import { Timestamp } from "@angular/fire/firestore";

export interface Category {
    objectID?: string;
    id?: string;
    createdAt?: string;
    image: CategoryPhoto | null;
    name: string;
    order: number;
    parentId: string; // 'root' or category id
    path: string[];
    processing: boolean;
    slug: string;
    updatedAt: Timestamp | null | string;
}

export interface CategoryPhoto {
    name?: string;
    path: string;
    processing: boolean;
    type: string;
    url: string;
}