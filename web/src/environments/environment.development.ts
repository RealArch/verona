
export const environment = {
    useEmulators: true,
    api: "http://127.0.0.1:5001/verona-ffbcd/us-central1/api",
    firebase: {
        projectId: "verona-ffbcd",
        appId: "1:239775263543:web:e132aa664b508b7184c8b2",
        storageBucket: "verona-ffbcd.firebasestorage.app",
        apiKey: "AIzaSyDi6D9v8goytB6YSA8whytSvJvtLFLXmNc",
        authDomain: "verona-ffbcd.firebaseapp.com",
        messagingSenderId: "239775263543",
        measurementId: "G-V2H4JHJMXJ"
    },
    algolia: {
        appId: "WG205GJU2V",
        apiKey: "00f922c2b509c3ccb44dc0ac7bf56d26",
        indexes: {
            products: 'products_dev',
            categories: 'categories_dev',
            orders: 'orders_dev'

        }
    }
};
