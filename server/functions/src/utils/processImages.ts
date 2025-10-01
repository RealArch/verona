import { storage } from "../firebase-init";
import { ProductPhoto } from "../interfaces/productPhoto";
import { CategoryImage } from "../interfaces/category.interface";
import sharp from "sharp";


export async function processProductImages(productId: string, photos: ProductPhoto[]): Promise<ProductPhoto[]> {
    const processedPhotos: ProductPhoto[] = [];
    for (const photo of photos) {
        if (photo.processing === true && photo.path) {
            const fileName = photo.path.split('/').pop() || photo.name;
            const tempFile = storage.bucket().file(photo.path);
            const [buffer] = await tempFile.download();
            const metadata = await sharp(buffer).metadata();
            const allowedFormats = ["jpeg", "png", "webp"];
            if (!allowedFormats.includes(metadata.format || "")) {
                // Si el formato no es permitido, omite la foto
                continue;
            }
            // Definir tamaños y nombres
            const sizes = [
                { label: 'thumbnail', width: 100, height: 100 },
                { label: 'small', width: 400, height: 400 },
                { label: 'medium', width: 800, height: 800 },
                { label: 'large', width: 1600, height: 1600 }
            ];
            const photoVersions: any = {};
            for (const size of sizes) {
                let resizedBuffer: Buffer;
                let contentType = "";
                let ext = "";
                if (metadata.format === "jpeg") {
                    resizedBuffer = await sharp(buffer)
                        .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 80, mozjpeg: true })
                        .toBuffer();
                    contentType = "image/jpeg";
                    ext = "jpg";
                } else if (metadata.format === "png") {
                    resizedBuffer = await sharp(buffer)
                        .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
                        .png({ quality: 80, compressionLevel: 9 })
                        .toBuffer();
                    contentType = "image/png";
                    ext = "png";
                } else if (metadata.format === "webp") {
                    resizedBuffer = await sharp(buffer)
                        .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toBuffer();
                    contentType = "image/webp";
                    ext = "webp";
                } else {
                    throw new Error("Formato de imagen no soportado");
                }
                if (!resizedBuffer) throw new Error("No se pudo generar el buffer de la imagen");
                const versionPath = `img/products/${productId}/${size.label}_${fileName.replace(/\.[^.]+$/, '')}.${ext}`;
                await storage.bucket().file(versionPath).save(resizedBuffer, {
                    contentType,
                    public: true
                });
                // Hacer el archivo público
                // Detectar si estamos en emulador
                let url;
                if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
                    // URL local para el emulador
                    url = `http://localhost:9199/v0/b/${storage.bucket().name}/o/${encodeURIComponent(versionPath)}?alt=media`;
                } else {
                    // URL pública en producción
                    await storage.bucket().file(versionPath).makePublic();
                    url = `https://storage.googleapis.com/${storage.bucket().name}/${versionPath}`;
                }
                photoVersions[size.label] = {
                    name: `${size.label}_${fileName.replace(/\.[^.]+$/, '')}.${ext}`,
                    path: versionPath,
                    url,
                    type: contentType,
                    processing: false
                };
            }
            // Borrar imagen de temp
            await tempFile.delete();
            processedPhotos.push({
                // ...photo,
                ...photoVersions,
                processing: false
            });
        } else {
            processedPhotos.push(photo);
        }
    }
    return processedPhotos;
}

export async function processCategoriesImages(categoryId: string, photo: CategoryImage): Promise<CategoryImage> {
    if (!photo.processing || !photo.path) {
        return photo;
    }

    const fileName = photo.path.split('/').pop() || 'category_image';
    const tempFile = storage.bucket().file(photo.path);
    
    try {
        const [buffer] = await tempFile.download();
        const metadata = await sharp(buffer).metadata();
        
        const allowedFormats = ["jpeg", "png", "webp"];
        if (!allowedFormats.includes(metadata.format || "")) {
            throw new Error("Formato de imagen no soportado");
        }

        // Procesar imagen única de máximo 400px manteniendo relación de aspecto
        let resizedBuffer: Buffer;
        let contentType = "";
        let ext = "";

        if (metadata.format === "jpeg") {
            resizedBuffer = await sharp(buffer)
                .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, mozjpeg: true })
                .toBuffer();
            contentType = "image/jpeg";
            ext = "jpg";
        } else if (metadata.format === "png") {
            resizedBuffer = await sharp(buffer)
                .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                .png({ quality: 80, compressionLevel: 9 })
                .toBuffer();
            contentType = "image/png";
            ext = "png";
        } else if (metadata.format === "webp") {
            resizedBuffer = await sharp(buffer)
                .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();
            contentType = "image/webp";
            ext = "webp";
        } else {
            throw new Error("Formato de imagen no soportado");
        }

        if (!resizedBuffer) throw new Error("No se pudo generar el buffer de la imagen");

        // Guardar en img/categories/{categoryId}/
        const finalPath = `img/categories/${categoryId}/${fileName.replace(/\.[^.]+$/, '')}.${ext}`;
        const finalName = `${fileName.replace(/\.[^.]+$/, '')}.${ext}`;
        
        const file = storage.bucket().file(finalPath);
        await file.save(resizedBuffer, {
            contentType,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            }
        });

        // Hacer el archivo público SIEMPRE
        await file.makePublic();

        // Generar URL según el entorno
        let url;
        if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
            // URL local para el emulador
            url = `http://localhost:9199/v0/b/${storage.bucket().name}/o/${encodeURIComponent(finalPath)}?alt=media`;
        } else {
            // URL pública en producción
            url = `https://storage.googleapis.com/${storage.bucket().name}/${finalPath}`;
        }

        // Borrar imagen temporal
        await tempFile.delete();

        // Retornar CategoryPhoto procesada con el campo name
        return {
            name: finalName,
            path: finalPath,
            url,
            type: contentType,
            processing: false
        };

    } catch (error) {
        console.error(`Error processing category image for ${categoryId}:`, error);
        // En caso de error, retornar la foto original
        return photo;
    }
}