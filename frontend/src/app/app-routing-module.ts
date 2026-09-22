import { inject, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { authGuard, guestGuard, roleGuard } from './core/auth.guards';
import { Shell } from './layout/shell';

const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth-module').then(m => m.AuthModule)
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).homePath },
      {
        path: 'admin', data: { role: 'Admin' }, canMatch: [roleGuard],
        loadChildren: () => import('./features/admin/admin-module').then(m => m.AdminModule)
      },
      {
        path: 'dealer', data: { role: 'Dealer' }, canMatch: [roleGuard],
        loadChildren: () => import('./features/dealer/dealer-module').then(m => m.DealerModule)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
