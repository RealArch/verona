export interface StoreSettings {
  storeEnabled: boolean;
  deliveryMethods: {
    pickupEnabled: boolean;
    homeDeliveryEnabled: boolean;
    shippingEnabled: boolean;
    arrangeWithSellerEnabled: boolean;
  };
  taxPercentage: number;
  headerImages: {
    largeScreen: HeaderImage | null;
    smallScreen: HeaderImage | null;
  };
}

export interface HeaderImage {
    name?: string;
    path: string;
    processing: boolean;
    type: string;
    url: string;
}