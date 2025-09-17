declare namespace Express {
    interface Request {
        secrets?: {
            algoliaAdminKey: string;
            algoliaAppId: string;
        };
    }
}