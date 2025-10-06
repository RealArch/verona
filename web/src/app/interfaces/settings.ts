export interface StoreSettings {
  storeEnabled: boolean;
  deliveryMethods: {
    pickupEnabled: boolean;
    homeDeliveryEnabled: boolean;
    shippingEnabled: boolean;
    arrangeWithSellerEnabled: boolean;
  };
}