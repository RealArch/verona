import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },

  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.page').then(m => m.AuthPage),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/auth/login/login.page').then(m => m.LoginPage)
      },
      {
        path: 'admin-setup',
        loadComponent: () => import('./pages/auth/admin-setup/admin-setup.page').then(m => m.AdminSetupPage)
      },
    ]
  },
  {
    path: '',
    loadComponent: () => import('./pages/user/user.page').then(m => m.UserPage),
    // canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/user/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'categories',
        loadComponent: () => import('./pages/user/category-manager/category-manager.page').then(m => m.CategoryManagerPage)
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/user/products/products.page').then(m => m.ProductsPage)
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./pages/user/products/products-form/products-form.page').then(m => m.ProductFormPage)
      },
      {
        path: 'products/add',
        loadComponent: () => import('./pages/user/products/products-form/products-form.page').then(m => m.ProductFormPage)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]

  },
  // {
  //   path: '**',
  //   redirectTo: 'dashboard'
  // },





];
