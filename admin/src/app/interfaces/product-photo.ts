export interface NewPhoto {
    name: string;
    path: string;
    url: string;
    type: string;
    processing: boolean;
}

export interface ProductPhoto {
    large: {
        path: string;
        url: string;
        type: string;
        processing: boolean;
    };
    medium: {
        path: string;
        url: string;
        type: string;
        processing: boolean;
    };
    small: {
        path: string;
        url: string;
        type: string;
        processing: boolean;
    };
    thumbnail: {
        path: string;
        url: string;
        type: string;
        processing: boolean;
    };
    processing: boolean;
}
