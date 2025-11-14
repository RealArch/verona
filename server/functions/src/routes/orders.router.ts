import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import Joi from 'joi';
import { CreateOrderRequest, CreateOrderResponse } from '../interfaces/sales.interface';
import { Timestamp, FieldValue } from '@google-cloud/firestore';
import { prepareVariantStockUpdate, prepareSimpleProductStockUpdate } from '../utils/stockManagement';
import { getStoreTaxSettings, validateTaxAmount, getStoreDeliverySettings, validateDeliveryMethod } from '../utils/taxValidation';

const ordersRouter: Router = Router();

// Esquema de validación para UserAddress (actualizado según frontend)
const userAddressSchema = Joi.object({
  id: Joi.string().max(50).optional().allow(null).allow(''), // ID opcional
  name: Joi.string().min(2).max(100).trim().required(), // Nombre completo del destinatario
  address_1: Joi.string().min(5).max(200).trim().required(), // Dirección principal
  address_2: Joi.string().allow(null, '').max(200).trim().optional(), // Dirección secundaria (departamento, piso, etc.)
  description: Joi.string().allow(null, '').max(500).trim().optional(), // Referencias adicionales para encontrar la dirección
  municipality: Joi.string().min(2).max(100).trim().optional(), // Municipio o delegación
  city: Joi.string().min(2).max(100).trim().required(), // Ciudad
  state: Joi.string().min(2).max(100).trim().required(), // Estado, provincia o región
  postalCode: Joi.string().min(3).max(15).trim().required(), // Código postal (hasta 15 caracteres para formatos internacionales)
  country: Joi.string().min(2).max(100).trim().required(), // País
  phone: Joi.string().min(7).max(20).trim(), // Teléfono de contacto
  isDefault: Joi.boolean().optional() // Indica si es la dirección predeterminada
});

// Esquema de validación para OrderItem
const orderItemSchema = Joi.object({
  productId: Joi.string().min(1).max(50).required(), // ID del producto
  variantId: Joi.string().min(1).max(50).optional(), // ID de la variante (si aplica)
  quantity: Joi.number().integer().min(1).max(1000).required(), // Cantidad (máximo 1000 unidades por producto)
  unitPrice: Joi.number().min(0).max(9999999.99).precision(2).required(), // Precio unitario (hasta 7 dígitos)
  totalPrice: Joi.number().min(0).max(9999999.99).precision(2).required(), // Total del item (cantidad × precio unitario)
  productName: Joi.string().min(1).max(200).trim().required(), // Nombre del producto
  variantName: Joi.string().allow(null, '').max(150).trim().optional(), // Nombre de la variante
  variantColorHex: Joi.string().allow(null, '').pattern(/^#[0-9A-Fa-f]{6}$/).optional(), // Color en formato hexadecimal
  productImage: Joi.string().allow(null, '').uri().max(500).optional() // URL de la imagen del producto
});

// Esquema de validación para OrderTotals
const orderTotalsSchema = Joi.object({
  subtotal: Joi.number().min(0).max(9999999.99).precision(2).required(), // Subtotal antes de impuestos y envío
  taxAmount: Joi.number().min(0).max(9999999.99).precision(2).required(), // Monto total de impuestos
  taxPercentage: Joi.number().min(0).max(100).precision(2).required(), // Porcentaje de impuestos aplicado
  shippingCost: Joi.number().min(0).max(999999.99).precision(2).required(), // Costo de envío
  total: Joi.number().min(0).max(9999999.99).precision(2).required(), // Total final (subtotal + impuestos + envío)
  itemCount: Joi.number().integer().min(1).max(10000).required() // Cantidad total de productos en la orden
});

// Esquema de validación para CreateOrderRequest
// La dirección de envío es condicional según el método de entrega
const createOrderSchema = Joi.object({
  userId: Joi.string().min(1).max(50).required(), // ID del usuario que realiza la orden
  items: Joi.array().items(orderItemSchema).min(1).max(100).required(), // Lista de productos (máximo 100 productos diferentes)
  shippingAddress: Joi.alternatives().conditional('deliveryMethod', {
    is: Joi.valid('pickup', 'arrangeWithSeller'),
    then: Joi.allow(null), // No requerida para pickup o acuerdo con vendedor
    otherwise: userAddressSchema.required() // Requerida para shipping y homeDelivery
  }),
  billingAddress: userAddressSchema.allow(null).optional(), // Dirección de facturación (opcional)
  deliveryMethod: Joi.string().valid('pickup', 'homeDelivery', 'shipping', 'arrangeWithSeller').required(), // Método de entrega
  paymentMethod: Joi.string().min(1).max(50).trim().required(), // Método de pago (por ejemplo: "card", "cash", "transfer")
  notes: Joi.string().allow(null, '').max(1000).trim().optional(), // Notas adicionales del cliente
  totals: orderTotalsSchema.required() // Totales de la orden
});

// Ruta POST para crear una orden
ordersRouter.post('/createOrder', async (req: Request, res: Response) => {
  try {
    console.log(req.body)
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

    // Obtener datos completos del usuario desde Firestore
    const userDoc = await admin.firestore().collection('users').doc(orderData.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      } as CreateOrderResponse);
    }

    const userDataFromDB = userDoc.data();

    // Construir objeto userData para guardar en la orden
    const userData = {
      uid: orderData.userId,
      firstName: userDataFromDB?.firstName || '',
      lastName: userDataFromDB?.lastName || '',
      email: userDataFromDB?.email || ''
    };

    // Validar que los datos del usuario existan
    if (!userData.firstName || !userData.lastName || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene datos completos (firstName, lastName, email)'
      } as CreateOrderResponse);
    }

    // Obtener la configuración de impuestos de la tienda
    const taxSettings = await getStoreTaxSettings();

    // Obtener la configuración de métodos de entrega de la tienda
    const deliverySettings = await getStoreDeliverySettings();

    // Validar que el método de entrega esté habilitado
    const deliveryValidation = validateDeliveryMethod(orderData.deliveryMethod, deliverySettings);
    if (!deliveryValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: deliveryValidation.error
      } as CreateOrderResponse);
    }

    // Usar transacción para garantizar consistencia y evitar condiciones de carrera
    const now = Timestamp.now(); // Generar timestamp de Firestore fuera de la transacción
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const validationErrors: Array<{ field: string; message: string }> = [];
      let calculatedSubtotal = 0;
      const productUpdates: Array<{ ref: any; updates: any }> = [];

      // Leer todos los productos dentro de la transacción
      const enrichedItems: any[] = [];
      
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
        
        // Obtener SKU del producto o variante
        let itemSku = '';
        if (item.variantId) {
          // Producto con variantes: obtener SKU de la variante
          const variant = product.variants?.find((v: any) => v.id === item.variantId);
          itemSku = variant?.sku || product.sku || '';
        } else {
          // Producto sin variantes: obtener SKU del producto
          itemSku = product.sku || '';
        }

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

        // Enriquecer el item con el SKU
        enrichedItems.push({
          ...item,
          sku: itemSku
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

      // 7.5. Validar que el monto de impuestos coincida con la configuración de la tienda
      const taxValidation = validateTaxAmount(calculatedSubtotal, orderData.totals.taxAmount, orderData.totals.taxPercentage, taxSettings);
      if (!taxValidation.isValid) {
        validationErrors.push({
          field: 'totals.taxAmount',
          message: taxValidation.error!
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
        items: enrichedItems, // Usar items enriquecidos con SKU
        userData, // Agregar userData obtenido de Firestore
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

    // Incrementar el contador de compras del usuario
    try {
      const userRef = admin.firestore()
        .collection('users')
        .doc(orderData.userId);
      
      await userRef.update({
        'counters.purchases': FieldValue.increment(1)
      });
      
      console.log(`Purchase counter incremented for user: ${orderData.userId}`);
    } catch (counterError) {
      console.error('Error updating purchase counter:', counterError);
      // No fallar la orden por error en contador, solo loggear
    }

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