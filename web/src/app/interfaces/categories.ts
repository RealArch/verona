import { Timestamp } from "@angular/fire/firestore";

export interface Category {
    objectID?: string;
    id?: string;
    createdAt?: string;
    image: CategoryPhoto | null;
    name: string;
    order: number;
    parentId: string;
    path: string[];
    processing: boolean;
    slug: string;
    updatedAt: Timestamp | null
}

export interface CategoryPhoto {
    name?: string;
    path: string;
    processing: boolean;
    type: string;
    url: string;
}