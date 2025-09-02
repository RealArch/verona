import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectFirestoreEmulator, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';
import { environment } from './environments/environment';
import { enableProdMode } from '@angular/core';
import {  provideHttpClient } from '@angular/common/http';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

defineCustomElements(window);
if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules)),
    provideFirebaseApp(() => initializeApp({
      projectId: "verona-ffbcd",
      appId: "1:239775263543:web:243d857b55e950be84c8b2",
      storageBucket: "verona-ffbcd.firebasestorage.app",
      apiKey: "AIzaSyDi6D9v8goytB6YSA8whytSvJvtLFLXmNc",
      authDomain: "verona-ffbcd.firebaseapp.com",
      messagingSenderId: "239775263543", measurementId: "G-T9PV4YQBEC"
    })),
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        console.log('Using Auth Emulator');
        connectAuthEmulator(auth, 'http://localhost:9099');
      }
      return auth;
    }),
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        console.log('Using Firestore Emulator');
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),
    provideStorage(() => {
      const storage = getStorage();
      if (environment.useEmulators) {
        console.log('Using Storage Emulator');
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    })
  ],
});
