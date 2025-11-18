export const environment = {
  production: true,
  useEmulators: false,
  api: 'https://us-central1-verona-ffbcd.cloudfunctions.net/api',
  algolia: {
    appId: "WG205GJU2V",
    apiKey: "00f922c2b509c3ccb44dc0ac7bf56d26",
    indexes: {
      products: 'products_prod',
      categories: 'categories_prod',
      orders: 'orders_prod'
    }
  },
  version: '1.0.4'

};
