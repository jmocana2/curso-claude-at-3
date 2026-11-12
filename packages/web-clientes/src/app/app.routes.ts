import { Routes, Router, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { LoginComponent, RegisterComponent, authGuard } from '@resttek/web-shared';
import { CartStore } from './core/store/cart.store';

/**
 * Redirige a la selección de mesa si no hay mesa elegida para el restaurante de la ruta.
 */
const tableSelectedGuard: CanActivateFn = (route) => {
  const id = route.paramMap.get('id')!;
  if (inject(CartStore).table()?.restaurantId === id) return true;
  return inject(Router).createUrlTree(['/restaurants', id, 'mesa']);
};

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'restaurants', pathMatch: 'full' },
      {
        path: 'restaurants',
        loadComponent: () => import('./features/restaurants/restaurant-list.component').then(m => m.RestaurantListComponent)
      },
      {
        path: 'restaurants/:id/mesa',
        loadComponent: () => import('./features/tables/table-selection.component').then(m => m.TableSelectionComponent)
      },
      {
        path: 'restaurants/:id',
        canActivate: [tableSelectedGuard],
        loadComponent: () => import('./features/menu/restaurant-menu.component').then(m => m.RestaurantMenuComponent)
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/my-orders.component').then(m => m.MyOrdersComponent)
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./features/orders/order-detail.component').then(m => m.OrderDetailComponent)
      }
    ]
  }
];
