import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
    },
    {
        path: '',
        loadComponent: () => import('./pages/public/public').then(m => m.Public),
        children: [
            {
                path: 'home',
                loadComponent: () => import('./pages/public/home/home').then(m => m.Home)
            }
        ]
    }
];
