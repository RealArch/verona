import * as admin from 'firebase-admin';

/**
 * Interface para la configuración de impuestos en la tienda
 */
export interface StoreTaxSettings {
  taxPercentage: number;
  enabled: boolean;
}

/**
 * Interface para la configuración de métodos de entrega
 */
export interface StoreDeliverySettings {
  storeEnabled: boolean; // Control global de la tienda
  deliveryMethods: {
    arrangeWithSellerEnabled: boolean;
    homeDeliveryEnabled: boolean;
    pickupEnabled: boolean;
    shippingEnabled: boolean;
  };
}

/**
 * Obtiene la configuración de métodos de entrega de la tienda desde Firestore
 * @returns La configuración de métodos de entrega o null si no existe
 */
export async function getStoreDeliverySettings(): Promise<StoreDeliverySettings | null> {
  try {
    const settingsDoc = await admin.firestore()
      .collection('store')
      .doc('settings')
      .get();

    if (!settingsDoc.exists) {
      console.warn('Store settings document does not exist');
      return null;
    }

    const data = settingsDoc.data();

    // Validar que tenga los campos necesarios
    if (!data?.deliveryMethods || typeof data.deliveryMethods !== 'object') {
      console.warn('Store settings does not have valid deliveryMethods object');
      return null;
    }

    // Retornar configuración con storeEnabled como hermano de deliveryMethods
    return {
      storeEnabled: data.storeEnabled === true, // Control global de la tienda
      deliveryMethods: {
        arrangeWithSellerEnabled: data.deliveryMethods.arrangeWithSellerEnabled === true,
        homeDeliveryEnabled: data.deliveryMethods.homeDeliveryEnabled === true,
        pickupEnabled: data.deliveryMethods.pickupEnabled === true,
        shippingEnabled: data.deliveryMethods.shippingEnabled === true
      }
    };
  } catch (error) {
    console.error('Error fetching store delivery settings:', error);
    return null;
  }
}

/**
 * Valida que el método de entrega seleccionado esté habilitado en la tienda
 * @param deliveryMethod El método de entrega seleccionado
 * @param deliverySettings La configuración de métodos de entrega de la tienda
 * @returns Un objeto con el resultado de la validación
 */
export function validateDeliveryMethod(
  deliveryMethod: string,
  deliverySettings: StoreDeliverySettings | null
): {
  isValid: boolean;
  error?: string;
} {
  // Si no hay configuración, rechazar (no permitir nada por defecto)
  if (!deliverySettings) {
    console.error('No delivery settings found in store/settings, rejecting order');
    return { 
      isValid: false, 
      error: 'La configuración de métodos de entrega no está disponible. Por favor, contacte al administrador.' 
    };
  }

  // PRIMERO: Verificar si la tienda está habilitada globalmente
  if (!deliverySettings.storeEnabled) {
    console.warn('Store is globally disabled (storeEnabled: false)');
    return {
      isValid: false,
      error: 'La tienda está temporalmente cerrada. Por favor, intente más tarde.'
    };
  }

  // Mapear el método de entrega a su campo booleano correspondiente
  const methodToFieldMap: Record<string, keyof StoreDeliverySettings['deliveryMethods']> = {
    'arrangeWithSeller': 'arrangeWithSellerEnabled',
    'homeDelivery': 'homeDeliveryEnabled',
    'pickup': 'pickupEnabled',
    'shipping': 'shippingEnabled'
  };

  const fieldName = methodToFieldMap[deliveryMethod];

  // Si el método no está mapeado, considerarlo inválido
  if (!fieldName) {
    const availableMethods = Object.keys(methodToFieldMap).filter(method => 
      deliverySettings.deliveryMethods[methodToFieldMap[method]]
    );
    
    if (availableMethods.length === 0) {
      return {
        isValid: false,
        error: `No hay métodos de entrega habilitados en este momento. Por favor, contacte al administrador.`
      };
    }
    
    return {
      isValid: false,
      error: `El método de entrega '${deliveryMethod}' no es válido. Métodos disponibles: ${availableMethods.join(', ')}`
    };
  }

  // Verificar si el método está habilitado
  const isValid = deliverySettings.deliveryMethods[fieldName];

  if (!isValid) {
    // Obtener lista de métodos habilitados para el mensaje de error
    const availableMethods = Object.keys(methodToFieldMap).filter(method => 
      deliverySettings.deliveryMethods[methodToFieldMap[method]]
    );
    
    if (availableMethods.length === 0) {
      return {
        isValid: false,
        error: `No hay métodos de entrega habilitados en este momento. Por favor, contacte al administrador.`
      };
    }
    
    return {
      isValid: false,
      error: `El método de entrega '${deliveryMethod}' no está disponible. Métodos disponibles: ${availableMethods.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Obtiene la configuración de impuestos de la tienda desde Firestore
 * @returns La configuración de impuestos o null si no existe
 */
export async function getStoreTaxSettings(): Promise<StoreTaxSettings | null> {
  try {
    const settingsDoc = await admin.firestore()
      .collection('store')
      .doc('settings')
      .get();
    
    if (!settingsDoc.exists) {
      console.warn('Store settings document does not exist');
      return null;
    }

    const data = settingsDoc.data();
    
    // Validar que tenga los campos necesarios
    if (typeof data?.taxPercentage !== 'number') {
      console.warn('Store settings does not have valid taxPercentage');
      return null;
    }

    return {
      taxPercentage: data.taxPercentage,
      enabled: data.taxEnabled ?? true // Por defecto habilitado si no está especificado
    };
  } catch (error) {
    console.error('Error fetching store tax settings:', error);
    return null;
  }
}

/**
 * Calcula el monto de impuestos basado en el subtotal y el porcentaje configurado
 * @param subtotal El subtotal de la orden (antes de impuestos)
 * @param taxPercentage El porcentaje de impuestos (por ejemplo, 16 para 16%)
 * @returns El monto de impuestos calculado
 */
export function calculateTaxAmount(subtotal: number, taxPercentage: number): number {
  return Math.round((subtotal * (taxPercentage / 100)) * 100) / 100; // Redondear a 2 decimales
}

/**
 * Valida que el monto de impuestos enviado coincida con el configurado en la tienda
 * @param subtotal El subtotal de la orden
 * @param taxAmountSent El monto de impuestos enviado por el cliente
 * @param taxPercentageSent El porcentaje de impuestos enviado por el cliente
 * @param taxSettings La configuración de impuestos de la tienda
 * @returns Un objeto con el resultado de la validación
 */
export function validateTaxAmount(
  subtotal: number,
  taxAmountSent: number,
  taxPercentageSent: number,
  taxSettings: StoreTaxSettings | null
): {
  isValid: boolean;
  expectedTaxAmount: number;
  error?: string;
} {
  // Si no hay configuración, asumir que todos los porcentajes son válidos
  if (!taxSettings) {
    console.warn('No tax settings found, allowing any tax percentage');
    return { isValid: true, expectedTaxAmount: taxAmountSent };
  }

  // Validar que el porcentaje enviado coincida con el configurado
  const percentageDifference = Math.abs(taxPercentageSent - taxSettings.taxPercentage);
  if (percentageDifference > 0.01) {
    return {
      isValid: false,
      expectedTaxAmount: taxAmountSent, // No calculamos expected ya que el porcentaje es incorrecto
      error: `El porcentaje de impuestos es incorrecto. Esperado: ${taxSettings.taxPercentage}%, recibido: ${taxPercentageSent}%`
    };
  }

  // Si los impuestos están deshabilitados, debe ser 0
  if (!taxSettings.enabled) {
    const expectedTaxAmount = 0;
    const isValid = Math.abs(taxAmountSent - expectedTaxAmount) <= 0.01;
    
    return {
      isValid,
      expectedTaxAmount,
      error: isValid ? undefined : `Los impuestos están deshabilitados. El monto debe ser $0.00. Recibido: $${taxAmountSent.toFixed(2)}`
    };
  }

  // Calcular el monto de impuestos esperado basado en el porcentaje validado
  const expectedTaxAmount = calculateTaxAmount(subtotal, taxSettings.taxPercentage);
  
  // Validar con una tolerancia de 1 centavo para errores de redondeo
  const difference = Math.abs(taxAmountSent - expectedTaxAmount);
  const isValid = difference <= 0.01;

  return {
    isValid,
    expectedTaxAmount,
    error: isValid ? undefined : `El monto de impuestos es incorrecto. Esperado: $${expectedTaxAmount.toFixed(2)} (${taxSettings.taxPercentage}% de $${subtotal.toFixed(2)}). Recibido: $${taxAmountSent.toFixed(2)}`
  };
}
