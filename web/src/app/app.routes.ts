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
            },
            {
                path: 'product/:slug/:id',
                loadComponent: () => import('./pages/public/product/product').then(m => m.Product)
            },
            {
                path: 'user',
                loadComponent: () => import('./pages/user/user').then(m => m.User),
                children: [
                    {
                        path: 'profile',
                        loadComponent: () => import('./pages/user/profile/profile').then(m => m.Profile)
                    }
                ]
            },
        ]
    },
    {
        path: 'auth/login',
        loadComponent: () => import('./pages/auth/login/login').then(m => m.Login)
    },
        {
        path: 'auth/register',
        loadComponent: () => import('./pages/auth/register/register').then(m => m.Register)
    }
    // /user/profile

];
