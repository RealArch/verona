/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
// import { onProductCreated } from "./productImageTrigger";
import express from "express";
import { onRequest } from "firebase-functions/v2/https";
//IMPORT RUTAS
import adminRouter from "./routes/admin.router";
import categoriesRouter from "./routes/categories.router";
import productsRouter, { onProductCreated, onProductDeleted, onProductUpdated } from "./routes/products.router";
//importamos la app de firebase
import "./firebase-init";

const app = express();

app.get("/", (req, res) => {

    res.status(200).json({ message: "¡API de Firebase con Express y Router funcionando!" });
});

//RUTAS
app.use("/admin", adminRouter)
app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);

export const api = onRequest(app)
//PRODUCTS TRIGGERS
export { onProductCreated, onProductUpdated, onProductDeleted };
// import {onRequest} from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
