import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Joi from 'joi';
import { CreateOrderRequest, CreateOrderResponse } from '../interfaces/sales.interface';
import { Timestamp } from '@google-cloud/firestore';
import { prepareVariantStockUpdate, prepareSimpleProductStockUpdate } from '../utils/stockManagement';

const ordersRouter: Router = Router();

// Esquema de validación para UserAddress (actualizado según frontend)
const userAddressSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().min(2).max(100).required(),
  address_1: Joi.string().min(5).max(200).required(),
  address_2: Joi.string().allow(null).optional(),
  description: Joi.string().allow(null).optional(),
  municipality: Joi.string().min(2).max(100).optional(),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  postalCode: Joi.string().min(3).max(20).required(),
  country: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(7).max(20).optional(),
  isDefault: Joi.boolean().optional()
});

// Esquema de validación para OrderItem
const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  variantId: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  totalPrice: Joi.number().min(0).required(),
  productName: Joi.string().min(1).max(200).required(),
  variantName: Joi.string().optional(),
  variantColorHex: Joi.string().optional(),
  productImage: Joi.string().optional()
});

// Esquema de validación para OrderTotals
const orderTotalsSchema = Joi.object({
  subtotal: Joi.number().min(0).required(),
  taxAmount: Joi.number().min(0).required(),
  shippingCost: Joi.number().min(0).required(),
  total: Joi.number().min(0).required(),
  itemCount: Joi.number().integer().min(1).required()
});

// Esquema de validación para CreateOrderRequest
const createOrderSchema = Joi.object({
  userId: Joi.string().required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  shippingAddress: userAddressSchema.required(),
  billingAddress: userAddressSchema.optional(),
  paymentMethod: Joi.string().min(1).max(50).required(),
  notes: Joi.string().max(500).optional(),
  totals: orderTotalsSchema.required()
});

// Ruta POST para crear una orden
ordersRouter.post('/createOrder', async (req: Request, res: Response) => {
  try {
    // Validar los datos de entrada
    const { error, value } = createOrderSchema.validate(req.body, { abortEarly: false });
    if (error) {
      console.error('Validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      } as CreateOrderResponse);
    }

    const orderData: CreateOrderRequest = value;

    // Verificar que el usuario existe
    const userDoc = await admin.firestore().collection('users').doc(orderData.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      } as CreateOrderResponse);
    }

    // Usar transacción para garantizar consistencia y evitar condiciones de carrera
    const now = Timestamp.now(); // Generar timestamp de Firestore fuera de la transacción
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const validationErrors: Array<{ field: string; message: string }> = [];
      let calculatedSubtotal = 0;
      const productUpdates: Array<{ ref: any; updates: any }> = [];

      // Leer todos los productos dentro de la transacción
      for (let i = 0; i < orderData.items.length; i++) {
        const item = orderData.items[i];
        const itemPrefix = `items[${i}]`;

        // 1. Leer el producto dentro de la transacción
        const productRef = admin.firestore().collection('products').doc(item.productId);
        const productDoc = await transaction.get(productRef);
        
        if (!productDoc.exists) {
          validationErrors.push({
            field: `${itemPrefix}.productId`,
            message: `El producto '${item.productName}' no existe`
          });
          continue;
        }

        const product = productDoc.data() as any;

        // 2. Verificar que el producto está activo
        if (product.status !== 'active') {
          validationErrors.push({
            field: `${itemPrefix}.productId`,
            message: `El producto '${item.productName}' no está disponible para compra`
          });
          continue;
        }

        let availableStock = 0;
        let correctPrice = 0;
        let stockUpdateData: any = null;

        // 3. Validar y preparar actualización según tipo de producto
        if (item.variantId) {
          // Producto con variantes
          const variantResult = prepareVariantStockUpdate(product, item, itemPrefix, now);
          
          if (variantResult.error) {
            validationErrors.push(variantResult.error);
            continue;
          }

          availableStock = variantResult.availableStock;
          correctPrice = variantResult.correctPrice;
          stockUpdateData = variantResult.stockUpdateData;
        } else {
          // Producto sin variantes
          const productResult = prepareSimpleProductStockUpdate(product, item, now);
          
          availableStock = productResult.availableStock;
          correctPrice = productResult.correctPrice;
          stockUpdateData = productResult.stockUpdateData;
        }

        // 4. Verificar stock disponible (CRÍTICO: se lee dentro de la transacción)
        if (item.quantity > availableStock) {
          validationErrors.push({
            field: `${itemPrefix}.quantity`,
            message: `Stock insuficiente para '${item.productName}'. Disponible: ${availableStock}, solicitado: ${item.quantity}`
          });
          continue;
        }

        // 5. Verificar que el precio unitario es correcto
        const priceDifference = Math.abs(item.unitPrice - correctPrice);
        if (priceDifference > 0.01) {
          validationErrors.push({
            field: `${itemPrefix}.unitPrice`,
            message: `El precio de '${item.productName}' ha cambiado. Precio actual: $${correctPrice.toFixed(2)}, precio enviado: $${item.unitPrice.toFixed(2)}`
          });
          continue;
        }

        // 6. Verificar que el total del item es correcto
        const correctItemTotal = correctPrice * item.quantity;
        const itemTotalDifference = Math.abs(item.totalPrice - correctItemTotal);
        if (itemTotalDifference > 0.01) {
          validationErrors.push({
            field: `${itemPrefix}.totalPrice`,
            message: `El total del item '${item.productName}' es incorrecto. Esperado: $${correctItemTotal.toFixed(2)}, recibido: $${item.totalPrice.toFixed(2)}`
          });
          continue;
        }

        // Acumular subtotal calculado
        calculatedSubtotal += correctItemTotal;

        // Preparar actualización de stock (se aplicará solo si todas las validaciones pasan)
        productUpdates.push({
          ref: productRef,
          updates: stockUpdateData
        });
      }

      // 7. Verificar que el subtotal es correcto
      const subtotalDifference = Math.abs(orderData.totals.subtotal - calculatedSubtotal);
      if (subtotalDifference > 0.01) {
        validationErrors.push({
          field: 'totals.subtotal',
          message: `El subtotal es incorrecto. Esperado: $${calculatedSubtotal.toFixed(2)}, recibido: $${orderData.totals.subtotal.toFixed(2)}`
        });
      }

      // 8. Verificar que el total general es correcto
      const calculatedTotal = calculatedSubtotal + orderData.totals.taxAmount + orderData.totals.shippingCost;
      const totalDifference = Math.abs(orderData.totals.total - calculatedTotal);
      if (totalDifference > 0.01) {
        validationErrors.push({
          field: 'totals.total',
          message: `El total es incorrecto. Esperado: $${calculatedTotal.toFixed(2)}, recibido: $${orderData.totals.total.toFixed(2)}`
        });
      }

      // 9. Verificar que el conteo de items es correcto
      const calculatedItemCount = orderData.items.reduce((sum, item) => sum + item.quantity, 0);
      if (orderData.totals.itemCount !== calculatedItemCount) {
        validationErrors.push({
          field: 'totals.itemCount',
          message: `El conteo de items es incorrecto. Esperado: ${calculatedItemCount}, recibido: ${orderData.totals.itemCount}`
        });
      }

      // Si hay errores de validación, lanzar excepción para abortar la transacción
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors };
      }

      // Todas las validaciones pasaron: crear la orden y actualizar stocks
      const orderDocument = {
        ...orderData,
        status: 'pending',
        createdAt: now, // Usar timestamp generado fuera de la transacción
        updatedAt: now, // Usar timestamp generado fuera de la transacción
      };

      const orderRef = admin.firestore().collection('orders').doc();
      transaction.set(orderRef, orderDocument);

      // Actualizar stocks de todos los productos/variantes
      for (const update of productUpdates) {
        transaction.update(update.ref, update.updates);
      }

      console.log(`Order will be created with ID: ${orderRef.id}`);
      return { success: true, orderId: orderRef.id };
    });

    // Verificar el resultado de la transacción
    if (!result.success) {
      console.error('Order validation errors:', result.errors);
      return res.status(400).json({
        success: false,
        message: 'La orden contiene errores de validación',
        errors: result.errors
      } as CreateOrderResponse);
    }

    console.log(`Order created successfully with ID: ${result.orderId}`);

    // Responder con éxito
    return res.status(201).json({
      success: true,
      orderId: result.orderId,
      message: 'Orden creada exitosamente'
    } as CreateOrderResponse);

  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear la orden'
    } as CreateOrderResponse);
  }
});

export default ordersRouter;