import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    provideAuth(() => {
      const auth = getAuth(getApp());
      if (environment.useEmulators) {
        // console.log("using auth emulator");
        connectAuthEmulator(auth, 'http://localhost:9099');
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore(getApp());
      if (environment.useEmulators) {
        // console.log("using firestore emulator");
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),

    provideStorage(() => {
      const storage = getStorage(getApp());
      if (environment.useEmulators) {
        // console.log("using storage emulator");
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    }),

    provideAnalytics(() => getAnalytics()),
    ScreenTrackingService,
    UserTrackingService,
  ]
};