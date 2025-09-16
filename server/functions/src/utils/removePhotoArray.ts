import { logger } from "firebase-functions";
import { storage } from "../firebase-init";

export async function removePhotoArrayImages(photos: any) {
    for (const photo of photos) {

        try {
            await storage.bucket().file(photo.large.path).delete();
            await storage.bucket().file(photo.small.path).delete();
            await storage.bucket().file(photo.thumbnail.path).delete();
            await storage.bucket().file(photo.medium.path).delete();

        } catch (err) {
            // Puedes loggear el error si lo deseas con un logger.error
            logger.error(`Error deleting file ${photo.path}:`, err);
        }

    }
}